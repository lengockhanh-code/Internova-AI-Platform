from __future__ import annotations

import logging
import re
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Literal, cast
from zoneinfo import ZoneInfo

from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from src.config import get_settings
from src.observability.instrumentation import langfuse_callbacks, observed_call
from src.rag.evidence import (
    EvidenceCheckResult,
    _can_use_deterministic_fast_path,
    check_evidence_legacy,
    evaluate_semantic_evidence_combined,
    validate_semantic_evidence_selection,
)
from src.rag.generation.answer_generator import (
    AnswerLanguage,
    StreamingCancelled,
    build_context,
    generate_answer_from_evidence,
    generate_conversation_answer,
    generate_general_support_answer,
    get_selected_chunk_ids,
)
from src.rag.generation.validation import (
    apply_groundedness_gate,
    calculate_rag_confidence,
    check_groundedness,
    check_input,
    make_fallback_result,
)
from src.rag.memory import ConversationMemory
from src.rag.prompts import (
    QUERY_TRANSLATION_SYSTEM_PROMPT,
    QUERY_TRANSLATION_USER_TEMPLATE,
    SEMANTIC_QUERY_PLANNER_SYSTEM_PROMPT,
    SEMANTIC_QUERY_PLANNER_USER_TEMPLATE,
    SEMANTIC_ROUTER_SYSTEM_PROMPT,
    SEMANTIC_ROUTER_USER_TEMPLATE,
)
from src.rag.retrieval.reranker import rerank_hits
from src.rag.retrieval.retriever import (
    HybridRetriever,
    RetrievalHit,
    RetrievalResult,
)
from src.rag.schemas import QueryResult
from src.services.redis_cache_service import (
    fingerprint_paths,
    redis_cache,
)

logger = logging.getLogger(__name__)


@lru_cache(maxsize=16)
def _get_chat_llm(
    model_name: str,
    temperature: float,
) -> ChatOpenAI:
    """Reuse LangChain/OpenAI clients and their HTTP connection pools."""
    settings = get_settings()
    return ChatOpenAI(
        model=model_name,
        api_key=settings.openai_api_key,
        temperature=temperature,
    )


def _stage_ms(started_at: float) -> float:
    return round((time.perf_counter() - started_at) * 1000.0, 1)


# =============================================================================
# Query translation / expansion
# =============================================================================

QueryLanguage = Literal[
    "vi",
    "en",
    "unsupported",
    "unknown",
]

VIETNAMESE_CHAR_RE = re.compile(
    r"[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩị"
    r"óòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]",
    flags=re.IGNORECASE,
)

VIETNAMESE_WORDS = {
    "thực",
    "tập",
    "sinh",
    "viên",
    "cần",
    "bao",
    "nhiêu",
    "giờ",
    "biểu",
    "mẫu",
    "đăng",
    "ký",
    "tín",
    "chỉ",
    "khiếu",
    "nại",
    "đánh",
    "giá",
}


class QueryExpansionResult(BaseModel):
    original_query: str
    normalized_query: str
    query_language: QueryLanguage
    query_vi: str | None = None
    query_en: str | None = None
    search_queries: list[str] = Field(default_factory=list)
    used_openai: bool = False
    warnings: list[str] = Field(default_factory=list)

class SemanticQueryPlan(BaseModel):
    """Structured retrieval-query plan produced by the semantic LLM."""

    query_en: str
    search_queries: list[str] = Field(default_factory=list)

def normalize_query(query: str) -> str:
    """Normalize whitespace in a user query."""
    return " ".join((query or "").strip().split())


def detect_query_language(query: str) -> QueryLanguage:
    """Detect Vietnamese, English, or unknown query language."""
    normalized = normalize_query(query)

    if not normalized:
        return "unknown"

    if VIETNAMESE_CHAR_RE.search(normalized):
        return "vi"

    tokens = {
        token.lower()
        for token in re.findall(r"\w+", normalized)
    }

    if len(tokens & VIETNAMESE_WORDS) >= 2:
        return "vi"

    if re.search(r"[a-zA-Z]", normalized):
        return "en"

    return "unknown"


def build_bilingual_queries(
    query: str,
    use_openai: bool = True,
    conversation_context: str = "",
) -> QueryExpansionResult:
    """Build Vietnamese/English retrieval queries."""
    normalized = normalize_query(query)
    language = detect_query_language(normalized)

    warnings: list[str] = []
    query_vi = normalized if language == "vi" else None
    query_en = normalized if language == "en" else None
    used_openai = False

    if language == "vi":
        if use_openai:
            try:
                query_en = translate_query_to_english(
                    normalized,
                    conversation_context=conversation_context,
                )
                used_openai = True

            except Exception as exc:
                warnings.append(
                    "OpenAI translation failed; "
                    f"using original query only. {exc}"
                )
                query_en = None

        elif language == "unknown":
            warnings.append(
                "Could not confidently detect query language."
            )


    search_queries = dedupe_queries(
    [
        normalized,
        query_vi,
        query_en,
    ]
)

    return QueryExpansionResult(
        original_query=query,
        normalized_query=normalized,
        query_language=language,
        query_vi=query_vi,
        query_en=query_en,
        search_queries=search_queries,
        used_openai=used_openai,
        warnings=warnings,
    )


def plan_semantic_retrieval_queries(
    query: str,
    conversation_context: str = "",
) -> SemanticQueryPlan:
    """Create semantic English retrieval queries with structured LLM output."""

    normalized = normalize_query(query)

    if not normalized:
        raise ValueError("Query must not be empty")

    settings = get_settings()

    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    llm = _get_chat_llm(
        settings.openai_chat_model or settings.model_name,
        0.0,
    )

    structured_planner = llm.with_structured_output(
        SemanticQueryPlan
    )

    user_prompt = SEMANTIC_QUERY_PLANNER_USER_TEMPLATE.format(
        query=query,
        conversation_context=(
            conversation_context
            or "No previous conversation."
        ),
    )

    result = structured_planner.invoke(
        [
            (
                "system",
                SEMANTIC_QUERY_PLANNER_SYSTEM_PROMPT,
            ),
            (
                "human",
                user_prompt,
            ),
        ],
        config={"callbacks": langfuse_callbacks()},
    )

    if isinstance(result, dict):
        result = SemanticQueryPlan.model_validate(result)

    query_en = normalize_query(result.query_en)

    if not query_en:
        raise RuntimeError(
            "Semantic query planner returned an empty query_en"
        )

    search_queries = dedupe_queries(
        result.search_queries
    )[:4]

    return SemanticQueryPlan(
        query_en=query_en,
        search_queries=search_queries,
    )

def _build_retrieval_queries_uncached(
    query: str,
    conversation_context: str = "",
    use_semantic_planner: bool = True,
    use_openai_translation: bool = False,
) -> QueryExpansionResult:
    """Build retrieval queries using semantic planning with legacy fallback."""

    normalized = normalize_query(query)
    language = detect_query_language(normalized)

    if use_semantic_planner:
        try:
            plan = plan_semantic_retrieval_queries(
                query=query,
                conversation_context=conversation_context,
            )

            query_vi = (
                normalized
                if language == "vi"
                else None
            )

            search_queries = dedupe_queries(
                [
                    normalized,
                    plan.query_en,
                    *plan.search_queries,
                ]
            )

            return QueryExpansionResult(
                original_query=query,
                normalized_query=normalized,
                query_language=language,
                query_vi=query_vi,
                query_en=plan.query_en,
                search_queries=search_queries,
                used_openai=True,
                warnings=[],
            )

        except Exception as exc:
            logger.warning(
                "Semantic query planner failed; "
                "using legacy query expansion: %s",
                exc,
            )

            fallback = build_bilingual_queries(
                query=query,
                use_openai=use_openai_translation,
                conversation_context=conversation_context,
            )

            return fallback.model_copy(
                update={
                    "warnings": [
                        *fallback.warnings,
                        (
                            "Semantic query planner failed; "
                            "used legacy query expansion."
                        ),
                    ]
                }
            )

    return build_bilingual_queries(
        query=query,
        use_openai=use_openai_translation,
        conversation_context=conversation_context,
    )


def build_retrieval_queries(
    query: str,
    conversation_context: str = "",
    use_semantic_planner: bool = True,
    use_openai_translation: bool = False,
) -> QueryExpansionResult:
    """Redis-cached semantic retrieval-query planner."""
    settings = get_settings()

    cache_payload = {
        "query": redis_cache.normalize_query(query),
        "conversation_context": conversation_context or "",
        "use_semantic_planner": use_semantic_planner,
        "use_openai_translation": use_openai_translation,
        "model": settings.openai_chat_model or settings.model_name,
    }

    cached = redis_cache.get_json(
        "planner",
        cache_payload,
    )

    if cached is not None:
        try:
            result = QueryExpansionResult.model_validate(cached)
            logger.debug("Redis planner cache HIT")
            return result
        except Exception as exc:
            logger.warning(
                "Ignoring invalid Redis planner cache entry: %s",
                exc,
            )

    result = _build_retrieval_queries_uncached(
        query=query,
        conversation_context=conversation_context,
        use_semantic_planner=use_semantic_planner,
        use_openai_translation=use_openai_translation,
    )

    # Do not freeze a transient LLM failure in Redis. When semantic planning
    # was requested, only cache a successful semantic/LLM result.
    should_cache_planner = (
        result.used_openai
        if use_semantic_planner
        else True
    )

    if should_cache_planner:
        redis_cache.set_json(
            "planner",
            cache_payload,
            result.model_dump(mode="json"),
            settings.redis_planner_cache_ttl_seconds,
        )

    return result

def translate_query_to_english(
    query: str,
    conversation_context: str = "",
) -> str:
    """Translate a Vietnamese query to concise English for retrieval."""
    settings = get_settings()

    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    llm = _get_chat_llm(
        settings.openai_chat_model or settings.model_name,
        settings.openai_temperature,
    )

    user_prompt = QUERY_TRANSLATION_USER_TEMPLATE.format(
        query=query,
        conversation_context=conversation_context,
    )

    response = llm.invoke(
        [
            ("system", QUERY_TRANSLATION_SYSTEM_PROMPT),
            ("human", user_prompt),
        ],
        config={"callbacks": langfuse_callbacks()},
    )

    translated = normalize_query(
        _extract_llm_text(response.content)
    )

    if not translated:
        raise RuntimeError("OpenAI returned an empty translation")

    return strip_wrapping_quotes(translated)


def _extract_llm_text(content: object) -> str:
    """Safely extract text from LangChain response content."""
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        parts: list[str] = []

        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict):
                text = block.get("text")
                if isinstance(text, str):
                    parts.append(text)

        return "\n".join(parts)

    return str(content) if content is not None else ""


def dedupe_queries(queries: list[str | None]) -> list[str]:
    """Remove duplicated queries while preserving order."""
    seen: set[str] = set()
    result: list[str] = []

    for query in queries:
        normalized = normalize_query(query or "")
        key = normalized.lower()

        if normalized and key not in seen:
            seen.add(key)
            result.append(normalized)

    return result


def strip_wrapping_quotes(value: str) -> str:
    """Remove wrapping quote characters."""
    return value.strip().strip('"').strip("'").strip()


# =============================================================================
# Intent routing
# =============================================================================

IntentName = Literal[
    "personal_data",
    "conversation",
    "general_support",
    "internship_eligibility",
    "internship_registration",
    "internship_duration",
    "internship_credit",
    "internship_withdrawal",
    "internship_dismissal",
    "internship_grievance",
    "internship_evaluation",
    "student_responsibility",
    "health_requirement",
    "form_guidance",
    "career_opportunity",
    "capstone",
    "knowledge_base",
    "out_of_scope",
]

SourceScope = Literal[
    "personal",
    "conversation",
    "general_support",
    "internship",
    "career",
    "capstone",
    "knowledge",
    "out_of_scope",
]

FormRequestMode = Literal[
    "none",
    "content",
    "resource",
    "list",
]

EvidenceMode = Literal[
    "none",
    "fast",
    "semantic",
]


AssistantAction = Literal[
    "none",
    "eligibility_checker",
    "internship_checklist",
    "process_guide",
    "form_assistant",
    "deadline_timeline",
    "internship_matching",
    "cv_improvement",
    "jd_analyzer",
    "interview_preparation",
    "internship_progress",
    "weekly_reflection",
    "evaluation_preparation",
    "skill_gap_analysis",
    "career_recommendation",
    "grievance_assistant",
    "policy_compliance",
    "document_finder",
    "smart_notifications",
    "personalized_dashboard",
    "human_escalation",
]

ActionMode = Literal[
    "inform",
    "preview",
    "execute",
    "cancel",
]


FollowUpRelation = Literal[
    "new_request",
    "continuation",
    "reference",
    "correction",
    "revision",
    "confirmation",
    "cancellation",
    "question_about_previous",
    "topic_switch",
]

DataSourceChoice = Literal[
    "conversation",
    "rag",
    "personal_db",
    "write_action",
    "none",
]

ResponseLanguageChoice = Literal[
    "vi",
    "en",
]


ResponseStyleChoice = Literal[
    "shorter",
    "simpler",
]


SpeechActChoice = Literal[
    "social",
    "ask_information",
    "ask_capability",
    "request_action",
    "read_personal_data",
    "rewrite_or_transform",
    "other",
]


PendingTransition = Literal[
    "none",
    "new_write",
    "confirm_pending",
    "cancel_pending",
    "revise_pending",
    "question_pending",
    "topic_switch",
]


class CopilotActionPayload(BaseModel):
    """Write payload extracted by the EXISTING semantic-router call.

    This object is behavioral data only. It never authorizes persistence by itself;
    backend validation + preview + explicit confirmation are still required.
    """

    # Progress
    progress_work_summary: str | None = None
    progress_hours: float | None = None
    progress_week: int | None = None

    # Weekly reflection
    reflection_week: int | None = None

    # Reminder / notification preference
    reminder_kind: Literal["REMINDER", "PREFERENCE"] | None = None
    reminder_content: str | None = None
    reminder_time_expression: str | None = None
    reminder_scheduled_at: str | None = None
    reminder_days_before: int | None = None
    reminder_deadline_reference: str | None = None
    notification_preference_key: Literal[
        "report_deadline",
        "lecturer_feedback",
        "internship_status",
        "email_notifications",
    ] | None = None
    notification_preference_enabled: bool | None = None

    # Human escalation / grievance
    escalation_incident_description: str | None = None
    escalation_subject: str | None = None
    escalation_type: Literal[
        "SAFETY",
        "SUPERVISION",
        "WORKLOAD",
        "HARASSMENT",
        "ROLE_MISMATCH",
        "WITHDRAWAL",
        "OTHER",
    ] | None = None
    escalation_severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] | None = None
    escalation_target: Literal["FACULTY_MENTOR", "CAID_QUEUE"] | None = None

class SemanticRouteOutput(BaseModel):
    """Structured output returned by the semantic LLM router."""

    intent: IntentName = Field(
        description=(
            "Semantic intent of the current user message."
        )
    )

    scope: SourceScope = Field(
        description=(
            "Top-level scope chosen semantically from the REAL requested outcome. "
            "Backend code must not infer scope from keywords."
        )
    )

    language: QueryLanguage = Field(
        description=(
            "Primary language of the CURRENT user message. "
            "Use 'vi' for Vietnamese, including Vietnamese "
            "without diacritics and natural Vietnamese-English "
            "code-switching. Use 'en' for English. "
            "Use 'unsupported' when the message is primarily "
            "another natural language. Use 'unknown' ONLY when "
            "there is not enough meaningful linguistic content "
            "to determine a language."
        )
    )

    entity: str | None = Field(
        default=None,
        description=(
            "Important entity explicitly mentioned or clearly "
            "resolved from context, if any."
        ),
    )


    followup_relation: FollowUpRelation = Field(
        default=cast(FollowUpRelation, "new_request"),
        description=(
            "Relationship of the CURRENT user message to recent conversation. "
            "A correction means the user rejects/replaces something previously assumed; "
            "rejected entities must not remain active merely because they are mentioned "
            "inside the correction. A topic_switch means answer the new request normally."
        ),
    )

    data_source: DataSourceChoice = Field(
        default=cast(DataSourceChoice, "none"),
        description=(
            "What kind of information/operation is actually needed: conversation for "
            "rewriting/translating/referring to text already in chat; rag for indexed "
            "document-backed information, including active Admin Knowledge Base documents; "
            "personal_db only for explicit current/stored own-account data; write_action for "
            "a persistent Copilot side effect; none otherwise."
        ),
    )

    response_language: ResponseLanguageChoice = Field(
        description=(
            "EFFECTIVE language the assistant should use for THIS response. "
            "Choose semantically from the explicit current request, persistent preference, "
            "and ongoing conversation language. Short/social/code-like turns normally inherit "
            "the established conversation language instead of switching on isolated tokens."
        ),
    )

    session_language_update: bool = Field(
        default=False,
        description=(
            "Whether this turn should establish/change the ongoing conversation language. "
            "True for a substantive supported-language turn or explicit persistent preference; "
            "false for short/social/code-like turns that inherit the session language and for "
            "one-turn translation/rewrite requests."
        ),
    )

    conversation_target: str | None = Field(
        default=None,
        description=(
            "Short description of the prior conversational text/entity the user is referring "
            "to, revising, translating, correcting, or asking about. Null for unrelated/new turns."
        ),
    )


    user_goal: str = Field(
        default="",
        description=(
            "One concise semantic paraphrase of what the CURRENT user actually wants. "
            "Describe the requested outcome, not keywords and not a stale previous topic."
        ),
    )


    speech_act: SpeechActChoice = Field(
        default=cast(SpeechActChoice, "other"),
        description=(
            "The pragmatic speech act of the CURRENT message. This is semantic, not "
            "grammatical. A question-shaped utterance such as 'Can you remind me to "
            "submit the report this afternoon?' is request_action, while 'Do you have "
            "a reminder feature?' is ask_capability."
        ),
    )


    pending_transition: PendingTransition = Field(
        default=cast(PendingTransition, "none"),
        description=(
            "Semantic relationship to structured pending write state. "
            "confirm_pending authorizes the existing draft; cancel_pending rejects it; "
            "revise_pending changes draft fields; question_pending asks about it; "
            "topic_switch starts another request; new_write requests a new persistent "
            "action; none otherwise. Never use exact phrase matching."
        ),
    )

    response_style: ResponseStyleChoice | None = Field(
        default=None,
        description=(
            "One-turn presentation preference when the user explicitly asks for a shorter "
            "or simpler response. Null otherwise."
        ),
    )

    persist_response_language: bool = Field(
        default=False,
        description=(
            "True ONLY when the user explicitly asks to keep using response_language for "
            "future turns. One-turn translation/rewrite requests must be false."
        ),
    )

    persist_response_style: bool = Field(
        default=False,
        description=(
            "True ONLY when the user explicitly asks to keep response_style for future turns."
        ),
    )

    form_request_mode: FormRequestMode = Field(
        default=cast(FormRequestMode, "none"),
        description=(
            "For form_guidance only. Use 'content' when the user asks what a form "
            "means, contains, is used for, how to complete it, or who signs it. "
            "Use 'resource' when the user wants the actual form/template/file, "
            "preview, open/download link, or a conversational follow-up such as "
            "'mẫu form cơ mà' that clearly asks for the file rather than an explanation. "
            "Use 'list' when the user asks which form resources are available. "
            "Use 'none' for every non-form intent."
        ),
    )

    referenced_form_number: str | None = Field(
        default=None,
        description=(
            "For form_guidance only: the Form number explicitly mentioned in the "
            "current message or confidently resolved from recent conversation context. "
            "Examples: '1', '2', '3', '4'. Never guess a form number."
        ),
    )

    retrieval_query: str | None = Field(
        default=None,
        description=(
            "For document-backed RAG intents only: ONE concise English retrieval query "
            "that preserves the user's exact information need, important entities, form "
            "numbers, dates, and numeric constraints. Use recent context only to resolve "
            "a genuine follow-up. Null for non-RAG, clarification, form resource/list, "
            "personal-data, conversation, general-support, and out-of-scope requests."
        ),
    )

    evidence_mode: EvidenceMode = Field(
        default=cast(EvidenceMode, "none"),
        description=(
            "Evidence strategy. Use 'fast' for direct factual document questions that can "
            "be supported by explicit passages. Use 'semantic' for exceptions, conditional "
            "eligibility, comparisons, multi-part/composite policy questions, or cases where "
            "the relationship between multiple facts must be interpreted. Use 'none' when "
            "no RAG answer generation is required."
        ),
    )

    assistant_action: AssistantAction = Field(
        default=cast(AssistantAction, "none"),
        description=(
            "Fine-grained internship-copilot capability requested by the user. "
            "This is behavioral metadata only and MUST NOT broaden the top-level scope, "
            "authorize personal-data access, or replace official-document retrieval."
        ),
    )

    action_mode: ActionMode = Field(
        default=cast(ActionMode, "inform"),
        description=(
            "Semantic state of the CURRENT message. A pending preview is context, not a forced menu. "
            "Use 'preview' for a first supported write or a semantic revision of a pending write; use 'execute' "
            "only when the current message semantically accepts carrying out the matching pending preview; use "
            "'cancel' only when it semantically rejects that matching preview; otherwise use 'inform' and classify "
            "the user's new question/topic normally. Never depend on exact confirmation/cancel phrases and never "
            "execute a new write request in the same turn it is first proposed."
        ),
    )

    action_payload: CopilotActionPayload = Field(
        default_factory=CopilotActionPayload,
        description=(
            "Structured domain payload for confirmation-gated Copilot writes, extracted in THIS SAME semantic-router "
            "call. Leave unrelated fields null. Operation words, language/style instructions, and confirmation wording "
            "must never be copied into domain payload fields."
        ),
    )

    missing_action_fields: list[str] = Field(
        default_factory=list,
        description=(
            "For a persistent Copilot write only: required domain fields still missing after using the current message "
            "plus genuine recent user context. For revision turns, unchanged values may be reconstructed from the "
            "matching pending preview because it represents the already pending draft. Empty when complete or non-write."
        ),
    )

    personal_sections: list[Literal[
        "profile", "internship", "deadlines", "checklist", "reports",
        "applications", "documents", "evaluations", "progress",
        "opportunities", "reminders", "escalations",
    ]] = Field(
        default_factory=list,
        description=(
            "For personal_data only: exact DB sections explicitly requested by the user. "
            "Must be empty for every non-personal intent."
        ),
    )

    personal_profile_fields: list[Literal[
        "full_name", "email", "student_code", "faculty", "major", "cohort", "gpa", "skills"
    ]] = Field(default_factory=list)

    personal_internship_fields: list[Literal[
        "company_name", "position_title", "lecturer_name", "semester", "start_date", "end_date", "status"
    ]] = Field(default_factory=list)

    personal_reports_pending_only: bool = False

    needs_clarification: bool = Field(
        default=False,
        description=(
            "True when a missing/unresolved detail materially changes the answer or a supported write payload "
            "and cannot be resolved from the current message plus conversation context. For ALL persistent Copilot "
            "writes, operation/language/style/recipient instructions do not count as the domain payload. Progress needs "
            "actual work details; reflection save needs a specific/resolvable week; reminders need content plus a time/"
            "specific deadline (or a clear preference category plus enable/disable state); escalation needs the actual incident."
        ),
    )

    clarification_question: str | None = Field(
        default=None,
        description=(
            "Exactly one concise clarification question in the user's language when "
            "needs_clarification=True; otherwise null."
        ),
    )

    reason: str = Field(
        description=(
            "Brief explanation of the routing and language decision."
        )
    )

INTERNSHIP_DOCUMENT_TYPES = [
    "policy",
    "form",
    "agreement",
]

CAREER_DOCUMENT_TYPES = [
    "talent_handbook",
]

CAPSTONE_DOCUMENT_TYPES = [
    "capstone_booklet",
]

KNOWLEDGE_DOCUMENT_TYPES = [
    "knowledge",
]

ALL_ROUTED_DOCUMENT_TYPES = [
    *INTERNSHIP_DOCUMENT_TYPES,
    *CAREER_DOCUMENT_TYPES,
    *CAPSTONE_DOCUMENT_TYPES,
    *KNOWLEDGE_DOCUMENT_TYPES,
]


class RouteDecision(BaseModel):
    intent: IntentName
    scope: SourceScope
    language: QueryLanguage = "unknown"
    allowed_document_types: list[str] = Field(default_factory=list)
    blocked_document_types: list[str] = Field(default_factory=list)
    personal_sections: list[str] = Field(default_factory=list)
    personal_profile_fields: list[str] = Field(default_factory=list)
    personal_internship_fields: list[str] = Field(default_factory=list)
    personal_reports_pending_only: bool = False
    needs_clarification: bool = False
    clarification_question: str | None = None
    form_request_mode: FormRequestMode = "none"
    referenced_form_number: str | None = None
    retrieval_query: str | None = None
    evidence_mode: EvidenceMode = "none"
    assistant_action: AssistantAction = "none"
    action_mode: ActionMode = "inform"
    action_payload: CopilotActionPayload = Field(default_factory=CopilotActionPayload)
    missing_action_fields: list[str] = Field(default_factory=list)

    # Follow-up/data-source fields produced by the SAME semantic classifier.
    # Defaults are important so old Redis route-cache entries and old persisted
    # pending-action metadata still validate safely after deployment.
    followup_relation: FollowUpRelation = "new_request"
    data_source: DataSourceChoice = "none"
    response_language: ResponseLanguageChoice | None = None
    session_language_update: bool = False
    conversation_target: str | None = None
    user_goal: str = ""
    speech_act: SpeechActChoice = "other"
    pending_transition: PendingTransition = "none"
    response_style: ResponseStyleChoice | None = None
    persist_response_language: bool = False
    persist_response_style: bool = False

    reason: str

    @property
    def allowed_sources(self) -> list[str]:
        return self.allowed_document_types

    @property
    def blocked_sources(self) -> list[str]:
        return self.blocked_document_types



_ROUTER_WRITE_ACTIONS = {
    "internship_progress",
    "weekly_reflection",
    "smart_notifications",
    "human_escalation",
    "grievance_assistant",
}

_ROUTER_RAG_SCOPES = {"internship", "career", "capstone", "knowledge"}


def normalize_route_contract(route: RouteDecision) -> RouteDecision:
    """Safety-normalize metadata without re-interpreting user intent.

    The ONE semantic LLM owns intent, scope, data_source, assistant_action,
    action_mode, and response language. This layer only removes unauthorized
    payloads/DB selections; it never maps words or actions to another route.
    """
    update: dict[str, object] = {}

    if not (
        route.intent == "personal_data"
        and route.scope == "personal"
        and route.data_source == "personal_db"
    ):
        update.update(
            {
                "personal_sections": [],
                "personal_profile_fields": [],
                "personal_internship_fields": [],
                "personal_reports_pending_only": False,
            }
        )

    if route.data_source != "write_action":
        update["missing_action_fields"] = []

    return route.model_copy(update=update) if update else route


_FORM_CONTEXT_ROUTING_INSTRUCTIONS = """
FORM RESOURCE / CONTENT ROUTING (IMPORTANT)

When intent=form_guidance, also decide form_request_mode from the user's REAL
requested outcome, using both the CURRENT message and recent conversation.

- content: the user asks for information ABOUT a form: purpose, meaning, fields,
  requirements, instructions, when to use it, or who must sign it.
- resource: the user wants the ACTUAL form/template/file, wants to open/preview/
  download it, asks for a copy/link, or corrects the assistant because they wanted
  the form itself. Natural follow-ups such as "mẫu form cơ mà", "ý tôi là file",
  "gửi mẫu đó", or "cho tôi cái form đó" can be resource requests.
- list: the user asks which forms/files are available.
- none: every non-form intent.

Resolve referenced_form_number from recent conversation when the current message
uses a contextual reference such as "form đó", "mẫu đó", "cái đó", "nó".
Never guess a Form number.

A Form can also be identified by PURPOSE, problem, procedure, or intended use.
When the purpose is clear enough for official-document retrieval to identify the
matching form, DO NOT ask the user to already know the Form number. Instead:
- intent=form_guidance
- form_request_mode="resource" when the user wants the actual file/template
- referenced_form_number=null
- needs_clarification=false
- retrieval_query = a concise semantic query describing the requested purpose.

CORRECTION RULE:
If the current user explicitly corrects/rejects a previous form/entity, the
rejected item is NOT the target even if its name/number appears in the sentence.
Use followup_relation="correction" and resolve the NEW target from the user's
replacement description.

Examples:
History: user asked about Form 1; current: "mẫu form cơ mà"
=> intent=form_guidance, form_request_mode=resource,
   referenced_form_number="1", needs_clarification=false.

Current: "Form 2 cần ai ký?"
=> form_request_mode=content, referenced_form_number="2".

Current: "cho tôi mẫu form đó", with no resolvable form AND no described purpose
=> form_request_mode=resource, referenced_form_number=null,
   needs_clarification=true.

History/assistant showed Form 1; current:
"không phải Form 1, form để báo cáo tôi bị xâm hại"
=> followup_relation="correction", intent=form_guidance,
   form_request_mode="resource", referenced_form_number=null,
   needs_clarification=false, retrieval_query describes the official form used
   to report the stated grievance/harm concern. Do NOT keep Form 1 as the target.

RETRIEVAL QUERY (IMPORTANT)
For a document-backed RAG intent, produce exactly ONE concise English
retrieval_query. Preserve the exact requested fact, Form number/name, entity,
date, number, and constraint. Resolve a genuine follow-up from recent context,
but never add facts. Do not produce multiple paraphrases.

Set retrieval_query=null when the request is conversation, general_support,
personal_data, out_of_scope, needs clarification, or requests a Form resource/list
that can be returned directly without RAG.

EVIDENCE MODE (IMPORTANT)
- fast: direct factual lookup from official documents, e.g. a required duration,
  credit count, Form purpose, who signs a Form, a single explicit procedure fact.
- semantic: conditional/exception questions, case-specific eligibility or approval,
  comparisons, conflicting conditions, broad/composite questions asking several
  policy aspects, or questions whose answer depends on interpreting relationships
  across multiple facts/chunks.
- none: no document-backed answer generation is needed.

Prefer fast for ordinary single-fact RAG questions. Do not mark a simple lookup
semantic merely because the topic is official policy.
""".strip()


def _semantic_router_failure_route(reason: str) -> RouteDecision:
    """Fail closed instead of guessing intent/language with keyword rules."""
    return RouteDecision(
        intent="out_of_scope",
        scope="out_of_scope",
        language="unknown",
        allowed_document_types=[],
        blocked_document_types=list(ALL_ROUTED_DOCUMENT_TYPES),
        data_source="none",
        response_language=None,
        assistant_action="none",
        action_mode="inform",
        reason=f"semantic_router_unavailable: {reason}",
    )


def _semantic_router_clock_context() -> tuple[str, str]:
    """Supply current product-local time; never interpret user text here."""
    settings = get_settings()
    tz_name = getattr(settings, "copilot_timezone", "Asia/Ho_Chi_Minh")
    try:
        now = datetime.now(ZoneInfo(tz_name))
    except Exception:
        tz_name = "Asia/Ho_Chi_Minh"
        # Windows does not ship the IANA timezone database by default. Keep
        # semantic routing available with Vietnam's fixed UTC+7 offset when
        # ZoneInfo data is missing instead of retrying the same failing lookup.
        now = datetime.now(timezone(timedelta(hours=7), name=tz_name))
    return now.isoformat(timespec="seconds"), tz_name


def _route_query_uncached(
    query: str,
    conversation_context: str = "",
) -> RouteDecision:
    """Route semantically with LLM and fall back to legacy rules on failure."""

    normalized = normalize_query(query)

    if not normalized:
        return _semantic_router_failure_route("empty_query")

    settings = get_settings()

    if not settings.openai_api_key:
        logger.warning(
            "OPENAI_API_KEY is unavailable; semantic routing cannot run."
        )
        return _semantic_router_failure_route("openai_api_key_unavailable")

    try:
        llm = _get_chat_llm(
            settings.openai_chat_model or settings.model_name,
            0.0,
        )

        structured_router = llm.with_structured_output(
            SemanticRouteOutput
        )

        current_local_datetime, current_timezone = _semantic_router_clock_context()
        user_prompt = SEMANTIC_ROUTER_USER_TEMPLATE.format(
            query=query,
            conversation_context=(
                conversation_context
                or "No previous conversation."
            ),
            current_local_datetime=current_local_datetime,
            current_timezone=current_timezone,
        )

        semantic_result = structured_router.invoke(
            [
                (
                    "system",
                    SEMANTIC_ROUTER_SYSTEM_PROMPT
                    + "\n\n"
                    + _FORM_CONTEXT_ROUTING_INSTRUCTIONS,
                ),
                (
                    "human",
                    user_prompt,
                ),
            ],
            config={"callbacks": langfuse_callbacks()},
        )

        if isinstance(semantic_result, dict):
            semantic_result = SemanticRouteOutput.model_validate(
                semantic_result
            )
        if semantic_result.language == "unsupported":
            return RouteDecision(
                intent="out_of_scope",
                scope="out_of_scope",
                language="unsupported",
                allowed_document_types=[],
                blocked_document_types=list(ALL_ROUTED_DOCUMENT_TYPES),
                data_source="none",
                response_language=semantic_result.response_language,
                session_language_update=False,
                assistant_action="none",
                action_mode="inform",
                reason=(
                    "semantic_language_gate: "
                    f"{semantic_result.reason}"
                ),
            )

        intent = semantic_result.intent
        scope = semantic_result.scope

        allowed = allowed_document_types_for_scope(
            scope
        )

        blocked = [
            document_type
            for document_type in ALL_ROUTED_DOCUMENT_TYPES
            if document_type not in allowed
        ]

        logger.debug(
            "Semantic route: intent=%s language=%s entity=%s",
            semantic_result.intent,
            semantic_result.language,
            semantic_result.entity,
        )

        route = RouteDecision(
            intent=intent,
            scope=scope,
            language=semantic_result.language,
            allowed_document_types=allowed,
            blocked_document_types=blocked,
            personal_sections=(semantic_result.personal_sections if intent == "personal_data" else []),
            personal_profile_fields=(semantic_result.personal_profile_fields if intent == "personal_data" else []),
            personal_internship_fields=(semantic_result.personal_internship_fields if intent == "personal_data" else []),
            personal_reports_pending_only=(semantic_result.personal_reports_pending_only if intent == "personal_data" else False),
            needs_clarification=bool(semantic_result.needs_clarification),
            clarification_question=(
                (semantic_result.clarification_question or "").strip() or None
                if semantic_result.needs_clarification
                else None
            ),
            form_request_mode=(
                semantic_result.form_request_mode
                if intent == "form_guidance"
                else "none"
            ),
            referenced_form_number=(
                _canonical_form_number(semantic_result.referenced_form_number)
                if intent == "form_guidance"
                else None
            ),
            retrieval_query=(
                normalize_query(semantic_result.retrieval_query or "") or None
                if scope in _ROUTER_RAG_SCOPES
                and not semantic_result.needs_clarification
                and not (
                    intent == "form_guidance"
                    and (
                        semantic_result.form_request_mode == "list"
                        or (
                            semantic_result.form_request_mode == "resource"
                            and _canonical_form_number(
                                semantic_result.referenced_form_number
                            ) is not None
                        )
                    )
                )
                else None
            ),
            evidence_mode=(
                semantic_result.evidence_mode
                if scope in _ROUTER_RAG_SCOPES
                and not semantic_result.needs_clarification
                and not (
                    intent == "form_guidance"
                    and (
                        semantic_result.form_request_mode == "list"
                        or (
                            semantic_result.form_request_mode == "resource"
                            and _canonical_form_number(
                                semantic_result.referenced_form_number
                            ) is not None
                        )
                    )
                )
                else "none"
            ),
            assistant_action=semantic_result.assistant_action,
            action_mode=semantic_result.action_mode,
            action_payload=semantic_result.action_payload,
            missing_action_fields=list(semantic_result.missing_action_fields or []),
            followup_relation=semantic_result.followup_relation,
            data_source=semantic_result.data_source,
            response_language=semantic_result.response_language,
            session_language_update=bool(
                semantic_result.session_language_update
            ),
            conversation_target=(
                (semantic_result.conversation_target or "").strip() or None
            ),
            user_goal=(semantic_result.user_goal or "").strip(),
            speech_act=semantic_result.speech_act,
            pending_transition=semantic_result.pending_transition,
            response_style=semantic_result.response_style,
            persist_response_language=bool(
                semantic_result.persist_response_language
            ),
            persist_response_style=bool(
                semantic_result.persist_response_style
            ),
            reason=(
                "semantic_router: "
                f"{semantic_result.reason}"
            ),
        )
        return normalize_route_contract(route)

    except Exception as exc:
        logger.warning(
            "Semantic router failed; failing closed without keyword routing: %s",
            exc,
        )
        return _semantic_router_failure_route(type(exc).__name__)



def route_query(
    query: str,
    conversation_context: str = "",
) -> RouteDecision:
    """Redis-cached semantic router with safe deterministic fallback."""
    settings = get_settings()

    cache_payload = {
        "query": redis_cache.normalize_query(query),
        "conversation_context": conversation_context or "",
        "model": settings.openai_chat_model or settings.model_name,
        # Bump when routing/domain policy changes so stale Redis decisions cannot
        # bypass a newly tightened scope policy.
        "routing_policy_version": 46,
    }

    cached = redis_cache.get_json(
        "route",
        cache_payload,
    )

    if cached is not None:
        try:
            result = normalize_route_contract(
                RouteDecision.model_validate(cached)
            )
            logger.debug("Redis route cache HIT")
            return result
        except Exception as exc:
            logger.warning(
                "Ignoring invalid Redis route cache entry: %s",
                exc,
            )

    result = normalize_route_contract(
        _route_query_uncached(
            query=query,
            conversation_context=conversation_context,
        )
    )

    # Never cache a transient semantic-router failure.
    if not result.reason.startswith("semantic_router_unavailable:"):
        redis_cache.set_json(
            "route",
            cache_payload,
            result.model_dump(mode="json"),
            settings.redis_route_cache_ttl_seconds,
        )

    return result


def allowed_document_types_for_scope(
    scope: SourceScope,
) -> list[str]:
    """Return allowed document types for a route scope."""

    if scope == "internship":
        return list(INTERNSHIP_DOCUMENT_TYPES)

    if scope == "career":
        return list(CAREER_DOCUMENT_TYPES)

    if scope == "capstone":
        return list(CAPSTONE_DOCUMENT_TYPES)

    if scope == "knowledge":
        return list(KNOWLEDGE_DOCUMENT_TYPES)

    if scope in {"personal", "conversation", "general_support", "out_of_scope"}:
        return []

    return []


def _serialize_retrieval_result(
    result: RetrievalResult,
) -> dict:
    """Store only IDs/ranks/scores; chunk text remains in the local index."""

    def serialize_hits(hits: list[RetrievalHit]) -> list[dict]:
        return [
            {
                "chunk_id": hit.chunk_id,
                "score": hit.score,
                "source": hit.source,
                "rank": hit.rank,
            }
            for hit in hits
        ]

    return {
        "query": result.query,
        "search_queries": list(result.search_queries),
        "vector_hits": serialize_hits(result.vector_hits),
        "bm25_hits": serialize_hits(result.bm25_hits),
        "fused_hits": serialize_hits(result.fused_hits),
    }


def _deserialize_retrieval_result(
    payload: dict,
    retriever: HybridRetriever,
) -> RetrievalResult | None:
    """Rebuild RetrievalHit objects from cached IDs and the current index."""

    def restore_hits(items: list[dict]) -> list[RetrievalHit]:
        restored: list[RetrievalHit] = []

        for item in items:
            chunk_id = str(item.get("chunk_id") or "")
            chunk = retriever._chunks_by_id.get(chunk_id)

            if chunk is None:
                # Index changed or cache entry is stale/corrupt.
                continue

            try:
                restored.append(
                    RetrievalHit(
                        chunk_id=chunk_id,
                        chunk=chunk,
                        score=float(item.get("score", 0.0)),
                        source=str(item.get("source") or "redis_cache"),
                        rank=int(item.get("rank", len(restored) + 1)),
                    )
                )
            except (TypeError, ValueError):
                continue

        return restored

    try:
        return RetrievalResult(
            query=str(payload.get("query") or ""),
            search_queries=[
                str(value)
                for value in payload.get("search_queries", [])
            ],
            vector_hits=restore_hits(
                list(payload.get("vector_hits", []))
            ),
            bm25_hits=restore_hits(
                list(payload.get("bm25_hits", []))
            ),
            fused_hits=restore_hits(
                list(payload.get("fused_hits", []))
            ),
        )
    except Exception:
        return None


# =============================================================================
# Pipeline options
# =============================================================================

@dataclass
class PipelineOptions:
    """Configurable options for the online RAG query pipeline."""

    top_k_vector: int = 10
    top_k_bm25: int = 10
    top_k_fused: int = 8
    top_k_rerank: int = 5

    use_reranker: bool = True
    use_semantic_query_planner: bool = True
    use_openai_translation: bool = True

    max_context_chars: int = 6000
    answer_language: AnswerLanguage | None = None


# =============================================================================
# Main Query Pipeline
# =============================================================================

class QueryPipeline:
    """Full RAG query pipeline without query-result caching."""

    def __init__(
        self,
        chroma_dir: Path,
        bm25_path: Path,
        options: PipelineOptions | None = None,
    ) -> None:
        self.retriever = HybridRetriever(
            chroma_dir=chroma_dir,
            bm25_path=bm25_path,
        )
        self.options = options or PipelineOptions()

        # Any ingestion rebuild changes BM25/index_manifest mtime/size, so old
        # result/retrieval cache entries automatically become unreachable.
        self.cache_version = fingerprint_paths(
            [
                Path(bm25_path),
                Path(bm25_path).parent / "index_manifest.json",
            ]
        )

    def run(
        self,
        query: str,
        memory: ConversationMemory | None = None,
        options_override: PipelineOptions | None = None,
        on_token: Callable[[str], None] | None = None,
        on_status: Callable[[str, dict], None] | None = None,
        should_cancel: Callable[[], bool] | None = None,
        precomputed_route: RouteDecision | None = None,
    ) -> QueryResult:
        """Execute the full online RAG query pipeline."""
        opts = options_override or self.options
        t0 = time.perf_counter()
        runtime_settings = get_settings()

        def raise_if_cancelled() -> None:
            if should_cancel is not None and should_cancel():
                raise StreamingCancelled("Streaming client disconnected")

        def emit_status(
            phase: str,
            route_decision=None,
            *,
            step_id: str | None = None,
            step_status: str = "running",
            engine: str | None = None,
            model: str | None = None,
            detail: str | None = None,
            metrics: dict | None = None,
        ) -> None:
            if on_status is None:
                return
            metadata = {
                "route_intent": getattr(route_decision, "intent", None),
                "route_scope": getattr(route_decision, "scope", None),
                "needs_retrieval": (
                    getattr(route_decision, "scope", None)
                    in _ROUTER_RAG_SCOPES
                ),
            }
            if step_id is not None:
                metadata["step"] = {
                    "id": step_id,
                    "status": step_status,
                    "engine": engine,
                    "model": model,
                    "detail": detail,
                    "metrics": metrics or {},
                }
            on_status(phase, metadata)

        raise_if_cancelled()

        session_language = (
            memory.get_response_language_hint()
            if memory is not None
            else None
        )
        answer_language: AnswerLanguage = (
            opts.answer_language
            if opts.answer_language is not None
            else session_language
            if session_language in {"vi", "en"}
            else "vi"
        )

        # ------------------------------------------------------------------
        # Step 1: Guardrails
        # ------------------------------------------------------------------
        guardrail = observed_call("rag.guardrail", check_input, query)

        if not guardrail.passed:
            logger.info(
                "Guardrail blocked: %s",
                guardrail.reason,
            )

            return make_fallback_result(
                query=query,
                reason="guardrail_blocked",
                language=answer_language,
                guardrail_reason=guardrail.reason,
                latency_ms=_elapsed_ms(t0),
            )

        emit_status(
            "thinking",
            step_id="safety",
            step_status="completed",
            engine="Internova Guardrails",
            detail="input_safe",
        )

        # ------------------------------------------------------------------
        # Conversation history
        # ------------------------------------------------------------------
        conversation_history = (
            memory.get_context_window()
            if memory
            else ""
        )
        # Semantic routing owns follow-up/reference resolution.
        contextual_query = query

        # ------------------------------------------------------------------
        # Step 2: Semantic brain (one classifier call)
        # ------------------------------------------------------------------
        # The semantic router owns intent, scope, language, follow-up relation,
        # Form identity/purpose, datasource, Copilot action, retrieval query,
        # clarification, and write payload. No regex/entity rule rewrites it.
        route_started = time.perf_counter()

        route = (
            precomputed_route
            if precomputed_route is not None
            else observed_call(
                "rag.route",
                route_query,
                query=query,
                conversation_context=conversation_history,
            )
        )

        route_ms = _stage_ms(route_started)
        planner_wait_ms = 0.0

        semantic_form_number = (
            _canonical_form_number(route.referenced_form_number)
            if route.intent == "form_guidance"
            else None
        )
        semantic_explicit_form_request = bool(
            route.intent == "form_guidance"
            and route.form_request_mode in {"content", "resource"}
            and semantic_form_number
        )
        semantic_form_listing_request = bool(
            route.intent == "form_guidance"
            and route.form_request_mode == "list"
        )
        isolated_form_request = (
            semantic_explicit_form_request
            or semantic_form_listing_request
        )

        logger.debug(
            "Route: intent=%s scope=%s",
            route.intent,
            route.scope,
        )

        raise_if_cancelled()
        emit_status(
            "thinking",
            route,
            step_id="routing",
            step_status="completed",
            engine="Semantic Router",
            model=(
                runtime_settings.openai_chat_model
                or runtime_settings.model_name
            ),
            detail="route_selected",
            metrics={
                "intent": route.intent,
                "scope": route.scope,
            },
        )
        emit_status(
            "retrieving"
            if route.scope in _ROUTER_RAG_SCOPES
            else "thinking",
            route,
            step_id=(
                "query_planning"
                if route.scope in _ROUTER_RAG_SCOPES
                else "generation"
            ),
            step_status="running",
            engine=(
                "RAG Query Planner"
                if route.scope in _ROUTER_RAG_SCOPES
                else "Answer Generator"
            ),
            model=(
                runtime_settings.openai_chat_model
                or runtime_settings.model_name
            ),
            detail=(
                "planning_search"
                if route.scope in _ROUTER_RAG_SCOPES
                else "generating_direct_answer"
            ),
        )

# ------------------------------------------------------------------
# Conversation: trả lời trực tiếp, không chạy RAG
# ------------------------------------------------------------------
# ------------------------------------------------------------------
# Conversation: trả lời trực tiếp, không chạy RAG
# ------------------------------------------------------------------
        # ------------------------------------------------------------------
        # Personal DB access is dispatched only by the authenticated API layer.
        # The RAG pipeline itself has no DB authorization context, so fail closed.
        # ------------------------------------------------------------------
        if route.scope == "personal":
            return QueryResult(
                query=query,
                answer=(
                    "Không thể truy cập dữ liệu cá nhân trong ngữ cảnh này."
                    if answer_language == "vi"
                    else "Personal account data cannot be accessed in this context."
                ),
                answer_status="out_of_scope",
                answer_language=answer_language,
                confidence=0.0,
                sources=[],
                route_intent=route.intent,
                route_scope=route.scope,
                guardrail_passed=True,
                guardrail_reason="personal_requires_authenticated_dispatch",
                cache_hit=False,
                groundedness_status="skip",
                groundedness_reason="personal_requires_authenticated_dispatch",
                latency_ms=_elapsed_ms(t0),
            )

        # ------------------------------------------------------------------
# Semantic language/session gate
# ------------------------------------------------------------------
        if (
            opts.answer_language is None
            and getattr(route, "response_language", None) in {"vi", "en"}
        ):
            answer_language = getattr(route, "response_language")

        if memory is not None:
            memory.apply_semantic_route(route)

        if route.reason.startswith("semantic_router_unavailable:"):
            answer = (
                "Mình chưa thể hiểu yêu cầu này vì bộ phân loại ngữ nghĩa đang tạm thời không khả dụng. "
                "Hệ thống đã dừng an toàn và không tự đoán ý định bằng từ khóa."
                if answer_language == "vi"
                else
                "I can't understand this request right now because semantic routing is temporarily unavailable. "
                "The system stopped safely instead of guessing intent from keywords."
            )
            return QueryResult(
                query=query,
                answer=answer,
                answer_status="out_of_scope",
                answer_language=answer_language,
                confidence=0.0,
                sources=[],
                route_intent=route.intent,
                route_scope=route.scope,
                guardrail_passed=True,
                guardrail_reason="semantic_router_unavailable",
                cache_hit=False,
                groundedness_status="skip",
                groundedness_reason="semantic_router_unavailable",
                latency_ms=_elapsed_ms(t0),
            )

        if route.language == "unsupported":
            return QueryResult(
                query=query,
                answer=(
                    "Hiện tại mình hỗ trợ hội thoại bằng tiếng Việt và tiếng Anh."
                    if answer_language == "vi"
                    else "I currently support conversations in Vietnamese and English."
                ),
                answer_status="out_of_scope",
                answer_language=answer_language,
                confidence=0.0,
                sources=[],
                route_intent="out_of_scope",
                route_scope="out_of_scope",
        guardrail_passed=True,
        guardrail_reason="ok",
        cache_hit=False,
        vector_hits=[],
        bm25_hits=[],
        reranked_hits=[],
        groundedness_status="skip",
        groundedness_reason="unsupported_language",
        latency_ms=_elapsed_ms(t0),
    )


        # ------------------------------------------------------------------
        # Semantic Form resource routing
        # ------------------------------------------------------------------
        # The LLM decides the user's requested outcome from current message +
        # conversation context. Deterministic code only executes that decision.
        semantic_form_number = _canonical_form_number(
            route.referenced_form_number
        )

        # Resource requests may identify a Form by purpose instead of number.
        # Clarification is controlled by the semantic router; do not force the
        # student to know a Form number when official documents can identify it.

        # ------------------------------------------------------------------
        # Clarification gate: if the semantic router cannot safely resolve a
        # materially important detail, ask one concise question BEFORE any
        # RAG retrieval, personal-data handling, or answer generation.
        # ------------------------------------------------------------------
        if route.needs_clarification:
            raise_if_cancelled()
            emit_status("answering", route)

            clarification = (
                (route.clarification_question or "").strip()
                or (
                    "Bạn có thể nói rõ thêm ý bạn muốn hỏi không?"
                    if answer_language == "vi"
                    else "Could you clarify what you mean?"
                )
            )

            if on_token is not None:
                on_token(clarification)

            if memory:
                memory.add_turn(
                    query=query,
                    answer=clarification,
                    answer_status="answered",
                )

            return QueryResult(
                query=query,
                answer=clarification,
                answer_status="answered",
                answer_language=answer_language,
                # No evidence has been evaluated for a clarification response.
                # QueryResult requires a float, so represent that as zero.
                confidence=0.0,
                sources=[],
                route_intent=route.intent,
                route_scope=route.scope,
                guardrail_passed=True,
                guardrail_reason="clarification_required",
                cache_hit=False,
                groundedness_status="skip",
                groundedness_reason="clarification_required",
                latency_ms=_elapsed_ms(t0),
            )

        # ------------------------------------------------------------------
        # Direct form resource/list return
        # ------------------------------------------------------------------
        # Do NOT run planner/embedding/vector/rerank/evidence/generation when the
        # semantic router has already established that the user wants the file.
        if (
            route.intent == "form_guidance"
            and (
                route.form_request_mode == "list"
                or (
                    route.form_request_mode == "resource"
                    and semantic_form_number is not None
                )
            )
        ):
            raise_if_cancelled()
            emit_status("answering", route)

            form_resources = _list_form_resources_from_index(self.retriever)

            if route.form_request_mode == "resource":
                requested_form_number = _canonical_form_number(
                    route.referenced_form_number
                )
                form_resources = [
                    hit
                    for hit in form_resources
                    if _document_form_number(
                        hit.chunk.document_name
                    ) == requested_form_number
                ]
            else:
                requested_form_number = None

            # One source card per actual form file.
            form_resources = _one_hit_per_form(
                form_resources,
                max_hits=max(
                    len(form_resources),
                    opts.top_k_rerank,
                ),
            )

            if form_resources:
                source_dicts = [
                    _form_resource_source_dict(
                        hit,
                        _document_form_number(
                            hit.chunk.document_name
                        ) or "",
                    )
                    for hit in form_resources
                    if _document_form_number(
                        hit.chunk.document_name
                    )
                ]

                if route.form_request_mode == "resource":
                    display_number = requested_form_number or ""
                    answer = (
                        f"Đây là **Form {display_number}** bạn đang cần. "
                        "Bạn có thể xem trước hoặc tải xuống ở phần nguồn bên dưới."
                        if answer_language == "vi"
                        else (
                            f"Here is **Form {display_number}**. "
                            "You can preview or download it from the source card below."
                        )
                    )
                else:
                    form_lines = [
                        (
                            f"- **Form {_document_form_number(hit.chunk.document_name)}"
                            f" — {_form_display_title(hit.chunk.document_name, _document_form_number(hit.chunk.document_name) or '')}**"
                        )
                        for hit in form_resources
                        if _document_form_number(hit.chunk.document_name)
                    ]
                    answer = (
                        "## Các biểu mẫu thực tập hiện có\n\n"
                        + "\n".join(form_lines)
                        + "\n\nBạn có thể **xem trước** hoặc **tải xuống** "
                        "từng biểu mẫu ở phần nguồn bên dưới."
                        if answer_language == "vi"
                        else (
                            "## Internship forms available\n\n"
                            + "\n".join(form_lines)
                            + "\n\nYou can preview or download each form "
                            "from the source cards below."
                        )
                    )

                if memory:
                    memory.add_turn(
                        query=query,
                        answer=answer,
                        answer_status="answered",
                    )

                return QueryResult(
                    query=query,
                    answer=answer,
                    answer_status="answered",
                    answer_language=answer_language,
                    confidence=1.0,
                    sources=source_dicts,
                    route_intent="form_guidance",
                    route_scope="internship",
                    guardrail_passed=True,
                    guardrail_reason="ok",
                    cache_hit=False,
                    vector_hits=[],
                    bm25_hits=[],
                    reranked_hits=[
                        hit.to_dict()
                        for hit in form_resources
                    ],
                    groundedness_status="skip",
                    groundedness_reason="semantic_form_resource",
                    latency_ms=_elapsed_ms(t0),
                )

            # The router resolved a concrete Form resource, but it does not exist
            # in the current index. Never substitute a different Form.
            answer = (
                (
                    f"Mình chưa tìm thấy tệp Form {requested_form_number} "
                    "trong kho tài liệu hiện tại."
                )
                if answer_language == "vi"
                else (
                    f"I couldn't find Form {requested_form_number} "
                    "in the current document index."
                )
            )
            return QueryResult(
                query=query,
                answer=answer,
                answer_status="answered",
                answer_language=answer_language,
                confidence=0.0,
                sources=[],
                route_intent="form_guidance",
                route_scope="internship",
                guardrail_passed=True,
                guardrail_reason="form_resource_not_found",
                cache_hit=False,
                groundedness_status="skip",
                groundedness_reason="form_resource_not_found",
                latency_ms=_elapsed_ms(t0),
            )

        route_data_source = getattr(route, "data_source", "none")

        if (
            (
                route.scope == "conversation"
                and route_data_source in {"none", "conversation"}
            )
            or (
                route.scope == "general_support"
                and route_data_source == "conversation"
            )
        ):
            raise_if_cancelled()
            emit_status("answering", route)
            conversational = generate_conversation_answer(
                query=query,
                answer_language=answer_language,
                conversation_history=conversation_history,
                on_token=on_token,
                should_cancel=should_cancel,
                user_goal=getattr(route, "user_goal", ""),
                response_style=getattr(route, "response_style", None),
            )

            if memory:
                memory.add_turn(
                    query=query,
                    answer=conversational.answer,
                    answer_status=conversational.answer_status,
                )

            return QueryResult(
                query=query,
                answer=conversational.answer,
                answer_status=conversational.answer_status,
                answer_language=conversational.answer_language,
                confidence=conversational.confidence,
                sources=[],
                route_intent=route.intent,
                route_scope=route.scope,
                guardrail_passed=True,
                guardrail_reason="ok",
                cache_hit=False,
                groundedness_status="skip",
                groundedness_reason="conversation_no_rag",
                latency_ms=_elapsed_ms(t0),
    )
# ------------------------------------------------------------------
# General support: trả lời trực tiếp, không chạy RAG
# ------------------------------------------------------------------
        if (
            route.scope == "general_support"
            and route_data_source == "none"
        ):
            raise_if_cancelled()
            emit_status("answering", route)
            support_answer = generate_general_support_answer(
                query=query,
                answer_language=answer_language,
                conversation_history=conversation_history,
                assistant_action=route.assistant_action,
                on_token=on_token,
                should_cancel=should_cancel,
                user_goal=getattr(route, "user_goal", ""),
                response_style=getattr(route, "response_style", None),
            )

            if memory:
                memory.add_turn(
                    query=query,
                    answer=support_answer.answer,
                    answer_status=support_answer.answer_status,
                )

            return QueryResult(
                query=query,
                answer=support_answer.answer,
                answer_status=support_answer.answer_status,
                answer_language=support_answer.answer_language,
                confidence=support_answer.confidence,
                sources=[],
                route_intent=route.intent,
                route_scope=route.scope,
                guardrail_passed=True,
                guardrail_reason="ok",
                cache_hit=False,
                groundedness_status="skip",
                groundedness_reason="general_support_no_rag",
                latency_ms=_elapsed_ms(t0),
            )

# ------------------------------------------------------------------
# Out of scope — trả lời thân thiện, giải thích phạm vi hỗ trợ
# ------------------------------------------------------------------
        if route.scope == "out_of_scope":
            if answer_language == "en":
                out_of_scope_answer = (
                    "I'm sorry, that question is outside the topics I can help with directly. "
                    "I specialize in:\n\n"
                    "- 📋 **VinUniversity internship policies** — eligibility, registration, duration, "
                    "forms (Form 1–4), evaluation, withdrawal, grievances\n"
                    "- 💼 **Career & Talent Handbook** — job search, CV, career development\n"
                    "- 🎓 **Capstone projects** — requirements and guidelines\n\n"
                    "If your question is about one of the above, feel free to ask again "
                    "with more detail and I'll do my best to help!"
                )
            else:
                out_of_scope_answer = (
                    "Xin lỗi, câu hỏi này nằm ngoài phạm vi mình có thể hỗ trợ trực tiếp. "
                    "Mình chuyên về:\n\n"
                    "- 📋 **Chính sách thực tập VinUni** — điều kiện, đăng ký, thời lượng, "
                    "biểu mẫu (Form 1–4), đánh giá, rút lui, khiếu nại\n"
                    "- 💼 **Cẩm nang nghề nghiệp (Talent Handbook)** — tìm việc, CV, phát triển nghề nghiệp\n"
                    "- 🎓 **Dự án Capstone** — yêu cầu và hướng dẫn\n\n"
                    "Nếu câu hỏi của bạn liên quan đến một trong các chủ đề trên, "
                    "hãy hỏi lại với thêm thông tin cụ thể và mình sẽ cố gắng hỗ trợ nhé!"
                )
            return QueryResult(
                query=query,
                answer=out_of_scope_answer,
                answer_status="out_of_scope",
                answer_language=answer_language,
                confidence=0.0,
                sources=[],
                route_intent=route.intent,
                route_scope=route.scope,
                guardrail_passed=True,
                guardrail_reason="ok",
                cache_hit=False,
                vector_hits=[],
                bm25_hits=[],
                reranked_hits=[],
                groundedness_status="skip",
                groundedness_reason="out_of_scope",
                latency_ms=_elapsed_ms(t0),
            )

# ------------------------------------------------------------------
# Step 3: Build ONE retrieval query from the semantic brain
# ------------------------------------------------------------------
        if not (
            getattr(route, "data_source", "none") == "rag"
            and route.scope in _ROUTER_RAG_SCOPES
        ):
            answer = (
                "Mình chưa thể hoàn tất yêu cầu này ở lượt hiện tại. "
                "Chưa có thao tác hoặc thay đổi dữ liệu nào được thực hiện."
                if answer_language == "vi"
                else
                "I couldn't complete this request on the current turn. "
                "No action or data change was performed."
            )
            return QueryResult(
                query=query,
                answer=answer,
                answer_status="out_of_scope",
                answer_language=answer_language,
                confidence=0.0,
                sources=[],
                route_intent=route.intent,
                route_scope=route.scope,
                guardrail_passed=True,
                guardrail_reason="semantic_route_inconsistent",
                cache_hit=False,
                groundedness_status="skip",
                groundedness_reason="semantic_route_inconsistent",
                latency_ms=_elapsed_ms(t0),
            )

        raise_if_cancelled()
        planner_started = time.perf_counter()
        expanded = observed_call(
            "rag.query_plan",
            _build_route_retrieval_expansion,
            query=query,
            contextual_query=contextual_query,
            route=route,
            conversation_context=(
                ""
                if isolated_form_request
                else conversation_history
            ),
            use_semantic_planner=opts.use_semantic_query_planner,
            use_openai_translation=opts.use_openai_translation,
        )

        planner_wait_ms = _stage_ms(planner_started)

        emit_status(
            "retrieving",
            route,
            step_id="query_planning",
            step_status="completed",
            engine="RAG Query Planner",
            model=(
                runtime_settings.openai_chat_model
                or runtime_settings.model_name
                if expanded.used_openai
                else None
            ),
            detail="search_plan_ready",
            metrics={
                "query_count": len(expanded.search_queries),
                "duration_ms": round(planner_wait_ms, 1),
            },
        )

        logger.debug(
            "Search queries: %s",
            expanded.search_queries,
        )

        retrieval_query = (
            (
                expanded.normalized_query
                or contextual_query
                or query
            )
            if isolated_form_request
            else (
                expanded.query_en
                or expanded.normalized_query
                or contextual_query
                or query
            )
        )

        logger.debug(
            "Retrieval query mode=%s query=%s",
            "semantic_brain" if route.retrieval_query else "fallback",
            retrieval_query,
        )
        logger.debug(
            "Query processing mode=%s",
            "semantic" if expanded.used_openai else "legacy_fallback",
        )

        # ------------------------------------------------------------------
        # Step 4: Retrieve
        # ------------------------------------------------------------------
        settings = get_settings()

        retrieval_cache_payload = {
            "index_version": self.cache_version,
            "query": redis_cache.normalize_query(retrieval_query),
            "search_queries": [
                redis_cache.normalize_query(value)
                for value in expanded.search_queries
            ],
            "allowed_document_types": sorted(
                route.allowed_document_types
            ),
            "top_k_vector": opts.top_k_vector,
            "top_k_bm25": opts.top_k_bm25,
            "top_k_fused": opts.top_k_fused,
        }

        retrieval_started = time.perf_counter()
        emit_status(
            "retrieving",
            route,
            step_id="retrieval",
            step_status="running",
            engine="Hybrid Search (Vector + BM25)",
            model=runtime_settings.openai_embedding_model,
            detail="searching_knowledge_base",
        )
        cached_retrieval = redis_cache.get_json(
            "retrieval",
            retrieval_cache_payload,
        )

        retrieval_result = None

        if cached_retrieval is not None:
            retrieval_result = _deserialize_retrieval_result(
                cached_retrieval,
                self.retriever,
            )

            if retrieval_result is not None:
                logger.debug("Redis retrieval cache HIT")

        if retrieval_result is None:
            raise_if_cancelled()
            retrieval_result = observed_call(
                "rag.retrieve",
                self.retriever.retrieve,
                query=retrieval_query,
                top_k_vector=opts.top_k_vector,
                top_k_bm25=opts.top_k_bm25,
                top_k_fused=opts.top_k_fused,
                allowed_document_types=route.allowed_document_types,
                search_queries=expanded.search_queries,
            )

            # Avoid caching an empty retrieval caused by a transient vector/
            # BM25 problem. Successful no-answer handling still happens later.
            if (
                retrieval_result.vector_hits
                or retrieval_result.bm25_hits
                or retrieval_result.fused_hits
            ):
                redis_cache.set_json(
                    "retrieval",
                    retrieval_cache_payload,
                    _serialize_retrieval_result(
                        retrieval_result
                    ),
                    settings.redis_retrieval_cache_ttl_seconds,
                )

        fused_hits = retrieval_result.fused_hits

        retrieval_ms = _stage_ms(retrieval_started)

        emit_status(
            "retrieving",
            route,
            step_id="retrieval",
            step_status="completed",
            engine="Hybrid Search (Vector + BM25)",
            model=runtime_settings.openai_embedding_model,
            detail=(
                "retrieval_cache_hit"
                if cached_retrieval is not None
                else "knowledge_matches_found"
            ),
            metrics={
                "vector_hits": len(retrieval_result.vector_hits),
                "bm25_hits": len(retrieval_result.bm25_hits),
                "combined_hits": len(fused_hits),
                "duration_ms": round(retrieval_ms, 1),
            },
        )

        # ------------------------------------------------------------------
        # Step 5: Rerank
        # ------------------------------------------------------------------
        emit_status(
            "retrieving",
            route,
            step_id="reranking",
            step_status="running",
            engine=(
                "Semantic Reranker"
                if opts.use_reranker
                else "Local Relevance Ranker"
            ),
            model=(runtime_settings.rerank_model if opts.use_reranker else None),
            detail="ranking_relevant_passages",
        )
        rerank_result = observed_call(
            "rag.rerank",
            rerank_hits,
            # For an explicit Form-N request, rank against the user's current
            # wording instead of an LLM-planned query that may inherit stale
            # entities from previous turns.
            query=(
                contextual_query
                if semantic_explicit_form_request or semantic_form_listing_request
                else retrieval_query
            ),
            hits=fused_hits,
            top_k=opts.top_k_rerank,
            use_llm=opts.use_reranker,
        )

        final_hits = (
            rerank_result.hits
            or fused_hits[:opts.top_k_rerank]
        )

        # Form resources are deterministic documents, not fuzzy semantic topics.
        # For an explicit "Form N" request, never allow another form to survive
        # into evidence/generation. For an "all forms" request, keep one
        # representative chunk per form so the UI can show one source per file.
        if semantic_explicit_form_request and semantic_form_number is not None:
            requested_form_number = semantic_form_number
            exact_form_hits = _filter_hits_for_form_number(
                final_hits,
                requested_form_number,
            )

            # If the dedicated reranker happened to drop the exact form, recover
            # it from the fused set that already contains the deterministic pin.
            if not exact_form_hits:
                exact_form_hits = _filter_hits_for_form_number(
                    fused_hits,
                    requested_form_number,
                )

            if exact_form_hits:
                final_hits = exact_form_hits[:opts.top_k_rerank]

        elif semantic_form_listing_request:
            form_listing_hits = _one_hit_per_form(
                fused_hits,
                max_hits=opts.top_k_rerank,
            )
            if form_listing_hits:
                final_hits = form_listing_hits

        emit_status(
            "retrieving",
            route,
            step_id="reranking",
            step_status="completed",
            engine=(
                "Semantic Reranker"
                if opts.use_reranker
                else "Local Relevance Ranker"
            ),
            model=(runtime_settings.rerank_model if opts.use_reranker else None),
            detail="relevant_passages_selected",
            metrics={"selected_passages": len(final_hits)},
        )

        if on_status is not None:
            on_status(
                "retrieving",
                {
                    "route_intent": route.intent,
                    "route_scope": route.scope,
                    "needs_retrieval": True,
                    "step": {
                        "id": "references",
                        "status": "completed",
                        "engine": "Reference Selector",
                        "model": None,
                        "detail": "candidate_references_selected",
                        "metrics": {"references": len(final_hits)},
                        "references": [
                            {
                                "document_name": hit.chunk.document_name,
                                "document_type": hit.chunk.document_type,
                                "page": hit.chunk.page,
                                "section": hit.chunk.section,
                                "chunk_id": hit.chunk_id,
                            }
                            for hit in final_hits[:5]
                        ],
                    },
                },
            )

        raise_if_cancelled()

        # ------------------------------------------------------------------
        # Step 6: Build context
        # ------------------------------------------------------------------
        context_text = build_context(
            final_hits,
            max_chars=opts.max_context_chars,
        )

        selected_chunk_ids = get_selected_chunk_ids(
            final_hits,
            max_chunks=opts.top_k_rerank,
        )

        logger.debug(
            "Selected context chunk IDs: %s",
            selected_chunk_ids,
        )

        # ------------------------------------------------------------------
        # Step 7: Check evidence
        # ------------------------------------------------------------------
        raise_if_cancelled()
        evidence_started = time.perf_counter()
        emit_status(
            "thinking",
            route,
            step_id="evidence",
            step_status="running",
            engine="Evidence Validator",
            model=(
                runtime_settings.openai_chat_model
                or runtime_settings.model_name
            ),
            detail="checking_source_support",
        )
        requested_evidence_mode = (
            route.evidence_mode
            if route.evidence_mode in {"fast", "semantic"}
            else "semantic"
        )

        evidence_conversation_context = (
            ""
            if isolated_form_request
            else conversation_history
        )

        if requested_evidence_mode == "fast":
            # Ordinary RAG: local deterministic validation first. This removes an
            # entire LLM call from the common path. Fail-safe behavior is kept:
            # if deterministic evidence cannot support the request, fall through
            # to the existing semantic evidence checker rather than guessing.
            evidence = observed_call(
                "rag.evidence_fast",
                check_evidence_legacy,
                query=query,
                hits=final_hits,
                route=route,
            )

            allowed_evidence_types = set(
                route.allowed_document_types
            )

            allowed_evidence_hits = [
                hit
                for hit in final_hits
                if hit.chunk.document_type
                in allowed_evidence_types
            ]

            deterministic_fast_ok = (
                _can_use_deterministic_fast_path(
                    query=query,
                    route=route,
                    allowed_hits=allowed_evidence_hits,
                    result=evidence,
                )
            )

            if not deterministic_fast_ok:
                evidence = observed_call(
                    "rag.evidence_semantic_fallback",
                    _check_semantic_evidence_once,
                    query=query,
                    hits=final_hits,
                    route=route,
                    conversation_context=evidence_conversation_context,
                )
        else:
            # Complex RAG keeps exactly ONE semantic evidence call. If that call
            # fails technically, fail closed instead of falling through to the old
            # two-call planner+selector path that inflates tail latency.
            evidence = observed_call(
                "rag.evidence",
                _check_semantic_evidence_once,
                query=query,
                hits=final_hits,
                route=route,
                conversation_context=evidence_conversation_context,
            )

        evidence_ms = _stage_ms(evidence_started)
        emit_status(
            "thinking",
            route,
            step_id="evidence",
            step_status="completed",
            engine="Evidence Validator",
            model=(
                runtime_settings.openai_chat_model
                or runtime_settings.model_name
            ),
            detail="source_support_checked",
            metrics={
                "evidence_status": evidence.evidence_status,
                "supported_passages": len(evidence.used_chunk_ids),
                "duration_ms": round(evidence_ms, 1),
            },
        )
        evidence_chunk_ids = set(evidence.used_chunk_ids)

        evidence_hits = [
            hit
            for hit in final_hits
            if hit.chunk_id in evidence_chunk_ids
        ]

        context_text = build_context(
    evidence_hits,
    max_chars=opts.max_context_chars,
)

        # ------------------------------------------------------------------
        # Step 8: Generate answer
        # ------------------------------------------------------------------
        raise_if_cancelled()
        emit_status(
            "answering",
            route,
            step_id="generation",
            step_status="running",
            engine="Answer Generator",
            model=(
                runtime_settings.openai_chat_model
                or runtime_settings.model_name
            ),
            detail="generating_grounded_answer",
        )
        # Production safety: stream document-backed RAG text only after the
        # existing pre-generation evidence gate reports sufficient support.
        # Partial-evidence answers keep the exact same final behavior but are
        # buffered until validation completes instead of exposing provisional
        # policy claims early.
        rag_on_token = (
            on_token
            if evidence.evidence_status == "sufficient"
            else None
        )

        generation_started = time.perf_counter()
        generated = observed_call(
            "rag.generation",
            generate_answer_from_evidence,
            query=query,
            evidence=evidence,
            hits=final_hits,
            answer_language=answer_language,
            context_text=context_text,
            conversation_history=conversation_history,
            on_token=rag_on_token,
            should_cancel=should_cancel,
            user_goal=getattr(route, "user_goal", ""),
            response_style=getattr(route, "response_style", None),
        )

        generation_ms = _stage_ms(generation_started)
        raise_if_cancelled()

        emit_status(
            "thinking",
            route,
            step_id="generation",
            step_status="completed",
            engine="Answer Generator",
            model=(
                runtime_settings.openai_chat_model
                or runtime_settings.model_name
            ),
            detail="draft_answer_ready",
            metrics={"duration_ms": round(generation_ms, 1)},
        )

        # ------------------------------------------------------------------
        # Step 9: Groundedness
        # ------------------------------------------------------------------
        groundedness_started = time.perf_counter()
        emit_status(
            "thinking",
            route,
            step_id="verification",
            step_status="running",
            engine="Groundedness Checker",
            model=(
                runtime_settings.openai_chat_model
                or runtime_settings.model_name
            ),
            detail="verifying_answer_against_sources",
        )
        groundedness = observed_call(
            "rag.groundedness",
            check_groundedness,
            answer=generated,
            hits=final_hits,
            route=route,
        )
        final_answer = observed_call(
            "rag.validation",
            apply_groundedness_gate,
            generated,
            groundedness,
        )
        groundedness_ms = _stage_ms(groundedness_started)
        emit_status(
            "answering",
            route,
            step_id="verification",
            step_status="completed",
            engine="Groundedness Checker",
            model=(
                runtime_settings.openai_chat_model
                or runtime_settings.model_name
            ),
            detail="answer_verification_complete",
            metrics={
                "groundedness_status": groundedness.status,
                "duration_ms": round(groundedness_ms, 1),
            },
        )

        # Nếu groundedness fail thì trả fallback luôn.
        if final_answer.answer_status != "answered":
            result = make_fallback_result(
                query=query,
                reason="insufficient_evidence",
                language=answer_language,
                route=route,
                latency_ms=_elapsed_ms(t0),
            )

            return result.model_copy(
                update={
                    "groundedness_status": groundedness.status,
                    "groundedness_reason": groundedness.reason,
                }
            )


        # ------------------------------------------------------------------
        # Calculate dynamic RAG confidence
        # Chỉ tới đây khi answer đã PASS groundedness.
        # ------------------------------------------------------------------
        rag_confidence = calculate_rag_confidence(
            evidence=evidence,
            groundedness=groundedness,
        )

        logger.debug(
            "RAG confidence evidence_method=%s support_summary=%s confidence=%s",
            evidence.evidence_method,
            evidence.support_summary.model_dump(),
            rag_confidence,
        )

# ------------------------------------------------------------------
# Step 10: Assemble result
# ------------------------------------------------------------------
        sources_dicts = [
            source.model_dump()
            for source in final_answer.sources
        ]

        # If the user requested an actual Form by PURPOSE (not by known number),
        # normal RAG identifies the matching official Form. Expose preview/download
        # only for Form sources actually selected by the grounded answer.
        if (
            route.intent == "form_guidance"
            and route.form_request_mode == "resource"
            and semantic_form_number is None
        ):
            enriched_sources: list[dict] = []
            seen_form_files: set[str] = set()
            for source in sources_dicts:
                item = dict(source)
                form_number = _document_form_number(
                    str(item.get("document_name") or "")
                )
                if form_number:
                    file_key = str(item.get("document_name") or "").lower()
                    if file_key in seen_form_files:
                        continue
                    seen_form_files.add(file_key)
                    form_id = f"form-{form_number}"
                    item["file_name"] = item.get("document_name")
                    item["preview_url"] = (
                        f"/api/v1/documents/forms/{form_id}/preview"
                    )
                    item["download_url"] = (
                        f"/api/v1/documents/forms/{form_id}/download"
                    )
                enriched_sources.append(item)
            sources_dicts = enriched_sources

        # Internally, groundedness may need multiple chunks from one file.
        # The user-facing source list should represent files, not chunks.
        # Therefore:
        # - Form 2 with two supporting chunks => 1 source card (Form 2 file)
        # - "all forms" => one source card per Form 1/2/3/4 file
        # This runs only after groundedness has passed, so validation quality is
        # not weakened by the UI deduplication.
        if semantic_explicit_form_request and semantic_form_number is not None:
            sources_dicts = _collapse_form_sources_for_ui(
                sources_dicts,
                requested_form_number=semantic_form_number,
                all_forms=False,
            )
        elif semantic_form_listing_request:
            sources_dicts = _collapse_form_sources_for_ui(
                sources_dicts,
                requested_form_number=None,
                all_forms=True,
            )

        query_result = QueryResult(
            query=query,
            answer=final_answer.answer,
            answer_status=final_answer.answer_status,
            answer_language=final_answer.answer_language,
            confidence=rag_confidence,
            sources=sources_dicts,
            route_intent=route.intent,
            route_scope=route.scope,
            guardrail_passed=True,
            guardrail_reason="ok",
            cache_hit=False,
            vector_hits=[
                hit.to_dict()
                for hit in retrieval_result.vector_hits[:5]
            ],
            bm25_hits=[
                hit.to_dict()
                for hit in retrieval_result.bm25_hits[:5]
            ],
            reranked_hits=[
                hit.to_dict()
                for hit in final_hits
            ],
            groundedness_status=groundedness.status,
            groundedness_reason=groundedness.reason,
            latency_ms=_elapsed_ms(t0),
        )

        logger.info(
            "RAG latency stages ms route=%s planner_wait=%s retrieval=%s "
            "evidence=%s generation=%s groundedness=%s total=%s",
            route_ms,
            planner_wait_ms,
            retrieval_ms,
            evidence_ms,
            generation_ms,
            groundedness_ms,
            _elapsed_ms(t0),
        )

        # ------------------------------------------------------------------
        # Step 11: Update conversation memory
        # ------------------------------------------------------------------
        if memory:
            memory.add_turn(
                query=query,
                answer=final_answer.answer,
                answer_status=final_answer.answer_status,
            )

        return query_result



def _check_semantic_evidence_once(
    query: str,
    hits: list[RetrievalHit],
    route: RouteDecision,
    conversation_context: str = "",
) -> EvidenceCheckResult:
    """Run exactly one semantic evidence call and fail closed on technical error.

    `evidence.check_evidence()` normally uses the combined one-call path, but on
    failure it falls back to the older split planner + selector flow (two more LLM
    calls). That is safe but creates very large P95/P99 tails. The online pipeline
    instead caps semantic evidence at one call; a technical failure returns
    insufficient evidence rather than spending two more network round trips.
    """
    allowed_types = set(route.allowed_document_types or [])
    allowed_hits = [
        hit
        for hit in hits
        if not allowed_types or hit.chunk.document_type in allowed_types
    ]

    if not allowed_hits:
        return EvidenceCheckResult(
            evidence_status="insufficient",
            reason="No retrieved chunks are from the allowed source scope.",
            used_chunk_ids=[],
            missing_evidence=["allowed source chunk"],
            evidence_method="semantic",
        )

    try:
        combined = evaluate_semantic_evidence_combined(
            query=query,
            route=route,
            hits=allowed_hits,
            conversation_context=conversation_context,
        )
        return validate_semantic_evidence_selection(
            evidence_plan=combined.evidence_plan,
            selection=combined.selection,
            allowed_hits=allowed_hits,
        )
    except Exception as exc:
        logger.warning(
            "Single-call semantic evidence failed; failing closed: %s",
            exc,
        )
        return EvidenceCheckResult(
            evidence_status="insufficient",
            reason="Semantic evidence validation was unavailable.",
            used_chunk_ids=[],
            missing_evidence=["semantic evidence validation"],
            evidence_method="semantic",
        )



def _build_route_retrieval_expansion(
    query: str,
    contextual_query: str,
    route: RouteDecision,
    conversation_context: str,
    use_semantic_planner: bool,
    use_openai_translation: bool,
) -> QueryExpansionResult:
    """Use retrieval intent produced by the SAME semantic-router call."""
    normalized_current = normalize_query(query)
    normalized_contextual = normalize_query(contextual_query) or normalized_current
    semantic_query = normalize_query(route.retrieval_query or "")
    fallback_query = normalize_query(route.user_goal or "") or normalized_contextual
    search_query = semantic_query or fallback_query

    # Preserve both the semantic English retrieval query and the
    # user's original wording. This is especially important for
    # Vietnamese documents: BM25/vector retrieval can otherwise lose
    # an exact Vietnamese passage before RRF/reranking.
    search_queries = dedupe_queries(
        [
            search_query,
            normalized_current,
        ]
    )

    route_language: QueryLanguage = (
        route.language
        if route.language in {"vi", "en", "unsupported", "unknown"}
        else "unknown"
    )

    return QueryExpansionResult(
        original_query=query,
        normalized_query=normalized_contextual,
        query_language=route_language,
        query_vi=(normalized_current if route_language == "vi" else None),
        query_en=(semantic_query if semantic_query else None),
        search_queries=search_queries,
        used_openai=bool(semantic_query),
        warnings=(
            []
            if semantic_query
            else ["Semantic router omitted retrieval_query; used user_goal/current query."]
        ),
    )

def _list_form_resources_from_index(
    retriever: HybridRetriever,
) -> list[RetrievalHit]:
    """Return one representative indexed hit per Form without vector search.

    This intentionally depends only on the in-memory BM25/index chunk map already
    owned by HybridRetriever. It avoids a non-existent `list_form_resources()` API
    and makes Form preview/download requests O(number_of_chunks), entirely local.
    """
    chunks_by_id = getattr(retriever, "_chunks_by_id", {}) or {}
    candidates: list[RetrievalHit] = []

    for chunk_id, chunk in chunks_by_id.items():
        if getattr(chunk, "document_type", "") not in {"form", "agreement"}:
            continue
        if not _document_form_number(getattr(chunk, "document_name", "")):
            continue
        candidates.append(
            RetrievalHit(
                chunk_id=str(chunk_id),
                chunk=chunk,
                score=1.0,
                source="form_index",
                rank=len(candidates) + 1,
            )
        )

    representatives = _one_hit_per_form(
        candidates,
        max_hits=max(len(candidates), 16),
    )
    return [
        RetrievalHit(
            chunk_id=hit.chunk_id,
            chunk=hit.chunk,
            score=hit.score,
            source=hit.source,
            rank=rank,
        )
        for rank, hit in enumerate(representatives, start=1)
    ]



def _canonical_form_number(value: str | None) -> str | None:
    """Normalize an explicit/semantic Form reference to its numeric identifier."""
    raw = (value or "").strip()
    if not raw:
        return None

    match = re.search(
        r"(?:\bform\s*[-_#:]?\s*)?(\d+(?:\.\d+)?)\b",
        raw,
        flags=re.IGNORECASE,
    )
    return match.group(1) if match else None


def _form_resource_source_dict(
    hit: RetrievalHit,
    form_number: str,
) -> dict:
    """Build the source-card payload used by preview/download UI actions."""
    form_id = f"form-{form_number}"
    return {
        "document_name": hit.chunk.document_name,
        "document_type": hit.chunk.document_type,
        "page": hit.chunk.page,
        "section": hit.chunk.section,
        "chunk_id": hit.chunk_id,
        "quote_original": hit.chunk.content_original[:1200],
        "file_name": hit.chunk.document_name,
        "preview_url": f"/api/v1/documents/forms/{form_id}/preview",
        "download_url": f"/api/v1/documents/forms/{form_id}/download",
    }


def _form_display_title(
    document_name: str,
    form_number: str,
) -> str:
    """Build a readable title directly from the indexed filename."""
    name = Path(document_name or "").stem

    name = re.sub(
        rf"^form[-_ ]?{re.escape(form_number)}[-_ ]*",
        "",
        name,
        flags=re.IGNORECASE,
    )

    name = re.sub(r"[-_]+", " ", name)
    name = " ".join(name.split())

    return name or f"Form {form_number}"


def _document_form_number(document_name: str) -> str | None:
    """Extract Form-N number from an indexed document filename."""
    match = re.search(
        r"form[-_ ]?(\d+(?:\.\d+)?)",
        document_name or "",
        flags=re.IGNORECASE,
    )
    return match.group(1) if match else None


def _filter_hits_for_form_number(
    hits: list,
    form_number: str,
) -> list:
    """Keep only retrieval hits belonging to the explicitly requested Form-N."""
    wanted = str(form_number).strip()

    return [
        hit
        for hit in hits
        if _document_form_number(
            getattr(hit.chunk, "document_name", "")
        ) == wanted
    ]


def _one_hit_per_form(
    hits: list,
    max_hits: int,
) -> list:
    """Keep at most one representative retrieval hit per Form-N document."""
    representatives: dict[str, object] = {}

    for hit in hits:
        document_type = getattr(
            hit.chunk,
            "document_type",
            "",
        )
        if document_type not in {"form", "agreement"}:
            continue

        form_number = _document_form_number(
            getattr(hit.chunk, "document_name", "")
        )
        if not form_number:
            continue

        if form_number not in representatives:
            representatives[form_number] = hit

    def form_sort_key(item: tuple[str, object]) -> tuple[int, str]:
        number, hit = item
        try:
            numeric = int(float(number))
        except (TypeError, ValueError):
            numeric = 10**9

        document_name = getattr(
            hit.chunk,
            "document_name",
            "",
        )
        return numeric, document_name.lower()

    ordered = [
        hit
        for _, hit in sorted(
            representatives.items(),
            key=form_sort_key,
        )
    ]

    return ordered[:max_hits]


def _collapse_form_sources_for_ui(
    sources: list[dict],
    requested_form_number: str | None,
    all_forms: bool,
) -> list[dict]:
    """Collapse chunk-level citations into one user-facing source per form file.

    Prefer the citation that carries preview/download URLs so the existing
    frontend can expose the file actions.
    """
    by_document: dict[str, dict] = {}

    for source in sources:
        document_name = str(
            source.get("document_name")
            or source.get("file_name")
            or ""
        )
        form_number = _document_form_number(
            document_name
        )

        if not form_number:
            continue

        if (
            not all_forms
            and requested_form_number is not None
            and form_number != requested_form_number
        ):
            continue

        existing = by_document.get(document_name)

        if existing is None:
            by_document[document_name] = source
            continue

        # Prefer the source object with resource links when duplicate chunks from
        # the same form document exist.
        existing_has_links = bool(
            existing.get("preview_url")
            or existing.get("download_url")
        )
        source_has_links = bool(
            source.get("preview_url")
            or source.get("download_url")
        )

        if source_has_links and not existing_has_links:
            by_document[document_name] = source

    collapsed = list(by_document.values())

    def source_sort_key(source: dict) -> tuple[int, str]:
        document_name = str(
            source.get("document_name")
            or source.get("file_name")
            or ""
        )
        number = _document_form_number(
            document_name
        )

        try:
            numeric = int(float(number or ""))
        except (TypeError, ValueError):
            numeric = 10**9

        return numeric, document_name.lower()

    collapsed.sort(key=source_sort_key)
    return collapsed


def _elapsed_ms(t0: float) -> float:
    """Return elapsed time in milliseconds."""
    return round(
        (time.perf_counter() - t0) * 1000,
        1,
    )
