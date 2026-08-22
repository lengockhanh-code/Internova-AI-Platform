from __future__ import annotations

import logging
import os
import re
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from contextvars import copy_context
from functools import lru_cache
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Literal

from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from src.config import get_settings
from src.observability.instrumentation import observed_call, langfuse_callbacks
from src.rag.evidence import check_evidence
from src.rag.generation.answer_generator import (
    AnswerLanguage,
    build_context,
    generate_answer_from_evidence,
    generate_conversation_answer,
    generate_general_support_answer,
    get_selected_chunk_ids,
    StreamingCancelled,
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
from src.services.redis_cache_service import (
    fingerprint_paths,
    redis_cache,
)
from src.rag.schemas import QueryResult

logger = logging.getLogger(__name__)


# Shared bounded executor for speculative semantic preprocessing.
# Router and planner are independent network calls for RAG-like queries, so
# overlapping them reduces cold-request wall-clock without changing either
# model prompt or result.
_SEMANTIC_PREPROCESS_WORKERS = max(
    2,
    int(os.getenv("RAG_SEMANTIC_PREPROCESS_WORKERS", "8")),
)
_ENABLE_SPECULATIVE_PREPROCESS = (
    os.getenv("RAG_SPECULATIVE_PREPROCESS", "1").strip().lower()
    not in {"0", "false", "no", "off"}
)

_SEMANTIC_PREPROCESS_EXECUTOR = ThreadPoolExecutor(
    max_workers=_SEMANTIC_PREPROCESS_WORKERS,
    thread_name_prefix="rag-semantic",
)


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
        "use_semantic_planner": bool(use_semantic_planner),
        "use_openai_translation": bool(use_openai_translation),
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
        float(settings.openai_temperature),
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
    "out_of_scope",
]

SourceScope = Literal[
    "conversation",
    "general_support",
    "internship",
    "career",
    "capstone",
    "out_of_scope",
]

class SemanticRouteOutput(BaseModel):
    """Structured output returned by the semantic LLM router."""

    intent: IntentName = Field(
        description=(
            "Semantic intent of the current user message."
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

ALL_ROUTED_DOCUMENT_TYPES = [
    *INTERNSHIP_DOCUMENT_TYPES,
    *CAREER_DOCUMENT_TYPES,
    *CAPSTONE_DOCUMENT_TYPES,
]

# Bump this whenever routing policy/prompt semantics change. Including it in
# the Redis route-cache key prevents old broad general_support decisions from
# surviving after a deployment that tightens the supported domain.
ROUTER_POLICY_VERSION = "internship-domain-v2"


class RouteDecision(BaseModel):
    intent: IntentName
    scope: SourceScope
    language: QueryLanguage = "unknown"
    allowed_document_types: list[str] = Field(default_factory=list)
    blocked_document_types: list[str] = Field(default_factory=list)
    reason: str

    @property
    def allowed_sources(self) -> list[str]:
        return self.allowed_document_types

    @property
    def blocked_sources(self) -> list[str]:
        return self.blocked_document_types


def route_query_rules(query: str) -> RouteDecision:
    """Fallback router using the legacy deterministic keyword rules."""
    normalized = normalize_for_routing(query)

    intent, reason = classify_intent(normalized)
    scope = scope_for_intent(intent)
    allowed = allowed_document_types_for_scope(scope)

    blocked = [
        document_type
        for document_type in ALL_ROUTED_DOCUMENT_TYPES
        if document_type not in allowed
    ]

    return RouteDecision(
        intent=intent,
        scope=scope,
        language="unknown",
        allowed_document_types=allowed,
        blocked_document_types=blocked,
        reason=f"rule_fallback: {reason}",
    )

def _route_query_uncached(
    query: str,
    conversation_context: str = "",
) -> RouteDecision:
    """Route semantically with LLM and fall back to legacy rules on failure."""

    normalized = normalize_query(query)

    if not normalized:
        return route_query_rules(query)

    settings = get_settings()

    if not settings.openai_api_key:
        logger.debug(
            "OPENAI_API_KEY is unavailable; using rule router fallback."
        )
        return route_query_rules(query)

    try:
        llm = _get_chat_llm(
            settings.openai_chat_model or settings.model_name,
            0.0,
        )

        structured_router = llm.with_structured_output(
            SemanticRouteOutput
        )

        user_prompt = SEMANTIC_ROUTER_USER_TEMPLATE.format(
            query=query,
            conversation_context=(
                conversation_context
                or "No previous conversation."
            ),
        )

        semantic_result = structured_router.invoke(
            [
                (
                    "system",
                    SEMANTIC_ROUTER_SYSTEM_PROMPT,
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
                reason=(
                    "semantic_language_gate: "
                    f"{semantic_result.reason}"
                ),
            )

        intent = semantic_result.intent
        scope = scope_for_intent(intent)

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

        return RouteDecision(
            intent=intent,
            scope=scope,
            language=semantic_result.language,
            allowed_document_types=allowed,
            blocked_document_types=blocked,
            reason=(
                "semantic_router: "
                f"{semantic_result.reason}"
            ),
        )

    except Exception as exc:
        logger.warning(
            "Semantic router failed; using rule fallback: %s",
            exc,
        )

        return route_query_rules(query)



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
        "router_policy_version": ROUTER_POLICY_VERSION,
    }

    cached = redis_cache.get_json(
        "route",
        cache_payload,
    )

    if cached is not None:
        try:
            result = RouteDecision.model_validate(cached)
            logger.debug("Redis route cache HIT")
            return result
        except Exception as exc:
            logger.warning(
                "Ignoring invalid Redis route cache entry: %s",
                exc,
            )

    result = _route_query_uncached(
        query=query,
        conversation_context=conversation_context,
    )

    # A rule_fallback may be caused by a temporary LLM/API failure.
    # Do not cache that degraded result for 30 minutes.
    if not result.reason.startswith("rule_fallback:"):
        redis_cache.set_json(
            "route",
            cache_payload,
            result.model_dump(mode="json"),
            settings.redis_route_cache_ttl_seconds,
        )

    return result


def _should_speculate_rag_preprocessing(
    query: str,
) -> bool:
    """
    Conservative latency-only hint.

    This NEVER decides the final route. It only decides whether the existing
    semantic planner may start in parallel with the existing semantic router.
    Final routing still comes from route_query(), so answer behavior is
    unchanged even when this hint is wrong.
    """
    try:
        hint = route_query_rules(query)
    except Exception:
        return False

    return hint.scope in {
        "internship",
        "career",
        "capstone",
    }


def classify_intent(
    normalized_query: str,
) -> tuple[IntentName, str]:
    """Classify a normalized query using deterministic keyword rules."""
    if not normalized_query:
        return "out_of_scope", "empty query"

    if contains_any(normalized_query, CAPSTONE_PATTERNS):
        return "capstone", "matched capstone keywords"

    if contains_any(normalized_query, CAREER_PATTERNS):
        return (
            "career_opportunity",
            "matched career or opportunity keywords",
        )

    if contains_any(normalized_query, GRIEVANCE_PATTERNS):
        return (
            "internship_grievance",
            "matched grievance keywords",
        )

    if contains_any(normalized_query, EVALUATION_PATTERNS):
        return (
            "internship_evaluation",
            "matched evaluation keywords",
        )

    if contains_any(normalized_query, WITHDRAWAL_PATTERNS):
        return (
            "internship_withdrawal",
            "matched withdrawal keywords",
        )

    if contains_any(normalized_query, DISMISSAL_PATTERNS):
        return (
            "internship_dismissal",
            "matched dismissal keywords",
        )

    if contains_any(normalized_query, HEALTH_PATTERNS):
        return (
            "health_requirement",
            "matched health requirement keywords",
        )

    if contains_any(normalized_query, DURATION_PATTERNS):
        return (
            "internship_duration",
            "matched duration keywords",
        )

    if contains_any(normalized_query, CREDIT_PATTERNS):
        return (
            "internship_credit",
            "matched credit or grading keywords",
        )

    if contains_any(normalized_query, ELIGIBILITY_PATTERNS):
        return (
            "internship_eligibility",
            "matched eligibility keywords",
        )

    if contains_any(normalized_query, REGISTRATION_PATTERNS):
        return (
            "internship_registration",
            "matched registration keywords",
        )

    if contains_any(normalized_query, RESPONSIBILITY_PATTERNS):
        return (
            "student_responsibility",
            "matched student responsibility keywords",
        )

    if contains_any(normalized_query, FORM_PATTERNS):
        return (
            "form_guidance",
            "matched form keywords",
        )

# Conversation — chỉ kiểm tra sau các intent tài liệu cụ thể.
# Nhờ vậy câu "Chào bạn, cần bao nhiêu giờ thực tập?"
# vẫn được route thành internship_duration.
    if (
        normalized_query in CONVERSATION_EXACT
        or contains_any(normalized_query, CONVERSATION_PATTERNS)
    ):
        return (
            "conversation",
            "matched conversational message",
            )
        


# General support — lời khuyên, viết email/CV, giải thích,
# hỗ trợ thực tế không cần tra tài liệu chính thức.
    if contains_any(normalized_query, GENERAL_SUPPORT_PATTERNS):
        return (
            "general_support",
            "matched general support request",
        )


# Generic internship để sau general_support.
# Ví dụ "Tôi sắp đi thực tập và hơi lo, nên chuẩn bị gì?"
# không nên bị ép vào RAG chỉ vì có chữ "thực tập".
    if contains_any(normalized_query, INTERNSHIP_PATTERNS):
        return (
            "internship_registration",
            "matched generic internship keywords",
        )

    return (
        "out_of_scope",
        "no supported routing keywords matched",
    )


def scope_for_intent(intent: IntentName) -> SourceScope:
    if intent == "conversation":
        return "conversation"

    if intent == "general_support":
        return "general_support"

    if intent == "career_opportunity":
        return "career"

    if intent == "capstone":
        return "capstone"

    if intent == "out_of_scope":
        return "out_of_scope"   

    return "internship"


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

    if scope in {"conversation", "general_support", "out_of_scope"}:
        return []

    return []


def normalize_for_routing(query: str) -> str:
    """Normalize text for deterministic routing."""
    without_accents = strip_accents(query or "")
    lowered = without_accents.lower()

    return " ".join(
        re.findall(r"[a-z0-9.]+", lowered)
    )


def strip_accents(value: str) -> str:
    """Remove Vietnamese accents and normalize đ/Đ."""
    value = value.replace("đ", "d").replace("Đ", "D")

    normalized = unicodedata.normalize("NFKD", value)

    return "".join(
        char
        for char in normalized
        if not unicodedata.combining(char)
    )

def contains_any(
    text: str,
    patterns: tuple[str, ...],
) -> bool:
    return any(pattern in text for pattern in patterns)


## pattern
CAPSTONE_PATTERNS = (
    "capstone",
    "final project",
    "graduation project",
)

CAREER_PATTERNS = (
    "career",
    "talent handbook",
    "opportunity",
    "job",
    "recruitment",
    "employer event",
    "networking",
)

GRIEVANCE_PATTERNS = (
    "grievance",
    "complaint",
    "incident",
    "form 3",
    "khieu nai",
    "su co",
    # Tiếng Việt mô tả form theo chức năng
    "khieu nai thuc tap",
    "phan anh su co",
    "bao cao su co",
    "to cao",
    "report incident",
    "unsafe",
    "khong an toan",
)

EVALUATION_PATTERNS = (
    "evaluation",
    "evaluate",
    "form 4",
    "danh gia",
    # Tiếng Việt
    "nhan xet cuoi ky",
    "employer evaluation",
    "danh gia sinh vien",
    "danh gia nha tuyen dung",
    "danh gia giang vien",
)

WITHDRAWAL_PATTERNS = (
    "withdrawal",
    "withdraw",
    "rut thuc tap",
    "rut khoi thuc tap",
    # Tiếng Việt bổ sung
    "nghi thuc tap",
    "nghi giua chung",
    "huy thuc tap",
    "xin rut",
)

DISMISSAL_PATTERNS = (
    "dismissal",
    "dismiss",
    "terminate",
    "termination",
    "cham dut",
    # Bổ sung
    "bi duoi",
    "bi cho nghi",
    "cho nghi viec",
    "cty cho nghi",
)

HEALTH_PATTERNS = (
    "health",
    "medical",
    "illness",
    "suc khoe",
    "benh",
    # Bổ sung
    "tiem chung",
    "vaccination",
    "kiem tra suc khoe",
    "health screening",
    "bao hiem",
    "insurance",
)

DURATION_PATTERNS = (
    "duration",
    "hour",
    "hours",
    "week",
    "weeks",
    "full time",
    "part time",
    "bao nhieu gio",
    "thoi luong",
    "thoi gian thuc tap",
    # Bổ sung
    "so gio",
    "gio thuc tap",
    "tuan thuc tap",
    "thoi gian lam viec",
    "full-time",
    "part-time",
    "ban thoi gian",
    "toan thoi gian",
)

CREDIT_PATTERNS = (
    "credit",
    "credits",
    "grading",
    "pass fail",
    "tin chi",
    "diem",
    # Bổ sung
    "credit-bearing",
    "bang diem",
    "ket qua hoc tap",
    "xet tin chi",
)

ELIGIBILITY_PATTERNS = (
    "eligibility",
    "eligible",
    "requirement",
    "requirements",
    "prerequisite",
    "gpa",
    "qualify",
    "dieu kien",
    # Bổ sung
    "dieu kien tham gia",
    "dieu kien dang ky",
    "tieu chuan",
    "du dieu kien",
    "foundation course",
    "orientation",
)

REGISTRATION_PATTERNS = (
    "registration",
    "register",
    "request form",
    "irf",
    "form 1",
    "approval",
    "application",
    "dang ky",
    # Bổ sung
    "dang ky thuc tap",
    "nop don",
    "xin phep thuc tap",
    "internship request",
)

RESPONSIBILITY_PATTERNS = (
    "responsibility",
    "responsibilities",
    "duty",
    "duties",
    "faculty mentor",
    "supervisor",
    "academic supervisor",
    "industry supervisor",
    "student must",
    "student should",
    "trach nhiem",
    # Bổ sung
    "nhiem vu sinh vien",
    "giang vien huong dan",
    "nguoi giam sat",
)

FORM_PATTERNS = (
    "form",
    "agreement",
    "liability",
    "hold harmless",
    "form 2",
    "bieu mau",
    # Bổ sung: câu hỏi về form theo chức năng/mô tả
    "mau don",
    "to khai",
    "don tu",
    "ho so",
    "nop form",
    "dien form",
    "bieu mau nao",
    "form nao",
    "su dung form",
    "release of liability",
    "hold harmless agreement",
)

INTERNSHIP_PATTERNS = (
    "internship",
    "intern",
    "thuc tap",
)
CONVERSATION_PATTERNS = (
    "xin chao",
    "chao ban",
    "chao chatbot",
    "chao bot",
    "hello",
    "hello there",
    "hey there",
    "good morning",
    "good afternoon",
    "good evening",
    "cam on",
    "thank you",
    "thanks",
    "tam biet",
    "goodbye",
    "see you",

    # Hỏi về chatbot / khả năng hỗ trợ
    "ban la ai",
    "ban lam duoc gi",
    "ban co the lam gi",
    "ban ho tro gi",
    "ban co the ho tro gi",
    "toi co the hoi gi",
    "what can you do",
    "what can you help with",
    "how can you help",
)

CONVERSATION_EXACT = {
    "hi",
    "hey",
    "hello",
    "chao",
    "alo",
    "bye",
    "thanks",
}
GENERAL_SUPPORT_PATTERNS = (
    # CV / resume
    "viet cv",
    "sua cv",
    "review cv",
    "chuan bi cv",
    "help with my cv",
    "review my cv",
    "resume",

    # Internship/career preparation
    "lan dau di thuc tap",
    "chua di thuc tap",
    "chuan bi tim noi thuc tap",
    "nen biet gi ve thuc tap",
    "moi truong lam viec",
    "van hoa cong ty",
    "kinh nghiem thuc tap",
    "loi khuyen thuc tap",
    "chuan bi phong van",
    "phong van thuc tap",
    "internship interview",
    "internship preparation",
    "career advice",
    "job interview",

    # Company / opportunity matching
    "matching cong ty",
    "match cong ty",
    "cong ty phu hop",
    "vi tri phu hop",
    "co hoi thuc tap phu hop",
    "company matching",
    "matching company",
    "suitable company",
    "suitable internship",

    # Workplace / recruiter / supervisor communication
    "email recruiter",
    "email cong ty",
    "email supervisor",
    "email lecturer",
    "tin nhan recruiter",
    "tin nhan cong ty",
    "workplace communication",
    "communicate with recruiter",
    "communicate with supervisor",
)


def _serialize_retrieval_result(
    result: RetrievalResult,
) -> dict:
    """Store only IDs/ranks/scores; chunk text remains in the local index."""

    def serialize_hits(hits: list[RetrievalHit]) -> list[dict]:
        return [
            {
                "chunk_id": hit.chunk_id,
                "score": float(hit.score),
                "source": hit.source,
                "rank": int(hit.rank),
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
    ) -> QueryResult:
        """Execute the full online RAG query pipeline."""
        opts = options_override or self.options
        t0 = time.perf_counter()

        def raise_if_cancelled() -> None:
            if should_cancel is not None and should_cancel():
                raise StreamingCancelled("Streaming client disconnected")

        def emit_status(phase: str, route_decision=None) -> None:
            if on_status is None:
                return
            metadata = {
                "route_intent": getattr(route_decision, "intent", None),
                "route_scope": getattr(route_decision, "scope", None),
                "needs_retrieval": (
                    getattr(route_decision, "scope", None)
                    in {"internship", "career", "capstone"}
                ),
            }
            on_status(phase, metadata)

        raise_if_cancelled()
        query_language = detect_query_language(query)

        answer_language: AnswerLanguage = (
            opts.answer_language
            if opts.answer_language is not None
            else (
                "en"
                if query_language == "en"
                else "vi"
            )
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

        # ------------------------------------------------------------------
        # Conversation history
        # ------------------------------------------------------------------
        conversation_history = (
            memory.get_context_window()
            if memory
            else ""
        )

        # Resolve conversational references for routing/retrieval only.
        # The original `query` is still used when generating the answer.
        contextual_query = (
            memory.resolve_followup_query(query)
            if memory
            else query
        )

        # Explicit Form-N requests are self-contained. Do not let previous
        # conversation context rewrite "Form 1" into another document/template.
        current_explicit_form_match = re.search(
            r"\bform\s*[-_#:]?\s*(\d+(?:\.\d+)?)\b",
            query or "",
            flags=re.IGNORECASE,
        )

        explicit_form_match = re.search(
            r"\bform\s*[-_#:]?\s*(\d+(?:\.\d+)?)\b",
            contextual_query or "",
            flags=re.IGNORECASE,
        )
        explicit_form_request = explicit_form_match is not None
        current_explicit_form_request = (
            current_explicit_form_match is not None
        )

        normalized_form_query = unicodedata.normalize(
            "NFKD",
            (contextual_query or "").lower(),
        )
        normalized_form_query = "".join(
            char
            for char in normalized_form_query
            if not unicodedata.combining(char)
        )
        normalized_form_query = (
            normalized_form_query
            .replace("đ", "d")
        )
        normalized_form_query = " ".join(
            normalized_form_query.split()
        )

        generic_form_listing_request = (
            "form" in normalized_form_query
            and any(
                phrase in normalized_form_query
                for phrase in (
                    "tat ca form",
                    "tat ca cac form",
                    "toan bo form",
                    "toan bo cac form",
                    "cac form",
                    "danh sach form",
                    "liet ke form",
                    "nhung form nao",
                    "nhung form gi",
                    "co nhung form gi",
                    "cac form nao",
                    "form gi",
                    "bao nhieu form",
                    "all forms",
                    "all the forms",
                    "list forms",
                    "which forms",
                    "what forms",
                )
            )
        )

        isolated_form_request = (
            current_explicit_form_request
            or generic_form_listing_request
        )

        # ------------------------------------------------------------------
        # Deterministic form inventory
        # ------------------------------------------------------------------
        # "Bạn có thông tin về những form gì?" asks WHICH FILE RESOURCES exist.
        # That is an inventory operation, not a semantic RAG question.
        #
        # Do not let vector search / reranker / evidence selection accidentally
        # return only Form 1 and then claim that no other forms exist.
        if generic_form_listing_request:
            form_resources = self.retriever.list_form_resources()

            if form_resources:
                form_lines: list[str] = []
                source_dicts: list[dict] = []

                for hit in form_resources:
                    form_number = _document_form_number(
                        hit.chunk.document_name
                    )
                    if not form_number:
                        continue

                    display_title = _form_display_title(
                        hit.chunk.document_name,
                        form_number,
                    )

                    form_lines.append(
                        f"- **Form {form_number} — {display_title}**"
                    )

                    form_id = f"form-{form_number}"
                    source_dicts.append(
                        {
                            "document_name": hit.chunk.document_name,
                            "document_type": hit.chunk.document_type,
                            "page": hit.chunk.page,
                            "section": hit.chunk.section,
                            "chunk_id": hit.chunk_id,
                            "quote_original": (
                                hit.chunk.content_original[:1200]
                            ),
                            "file_name": hit.chunk.document_name,
                            "preview_url": (
                                f"/api/v1/documents/forms/"
                                f"{form_id}/preview"
                            ),
                            "download_url": (
                                f"/api/v1/documents/forms/"
                                f"{form_id}/download"
                            ),
                        }
                    )

                if answer_language == "en":
                    inventory_answer = (
                        "## Internship forms available\n\n"
                        + "\n".join(form_lines)
                        + (
                            "\n\nYou can open or download each form "
                            "from the source cards below."
                        )
                    )
                else:
                    inventory_answer = (
                        "## Các biểu mẫu thực tập hiện có\n\n"
                        + "\n".join(form_lines)
                        + (
                            "\n\nBạn có thể **xem trước** hoặc **tải xuống** "
                            "từng biểu mẫu ở phần nguồn bên dưới."
                        )
                    )

                if memory:
                    memory.add_turn(
                        query=query,
                        answer=inventory_answer,
                        answer_status="answered",
                    )

                return QueryResult(
                    query=query,
                    answer=inventory_answer,
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
                    groundedness_reason=(
                        "deterministic_form_inventory"
                    ),
                    latency_ms=_elapsed_ms(t0),
                )

        # ------------------------------------------------------------------
        # Step 2: Route + speculative planner overlap
        # ------------------------------------------------------------------
        # On cold RAG-like requests, semantic routing and semantic query
        # planning are independent calls using the same immutable query/context.
        # Start them concurrently, but ALWAYS use the same route_query() and
        # build_retrieval_queries() results as the original sequential path.
        # This changes wall-clock only, not routing/retrieval behavior.
        planner_context = (
            ""
            if isolated_form_request
            else conversation_history
        )

        speculative_planner_future = None
        route_started = time.perf_counter()

        if (
            _ENABLE_SPECULATIVE_PREPROCESS
            and opts.use_semantic_query_planner
            and _should_speculate_rag_preprocessing(contextual_query)
            and not generic_form_listing_request
        ):
            speculative_planner_future = (
                _SEMANTIC_PREPROCESS_EXECUTOR.submit(
                    copy_context().run,
                    observed_call,
                    "rag.query_plan",
                    build_retrieval_queries,
                    contextual_query,
                    planner_context,
                    opts.use_semantic_query_planner,
                    opts.use_openai_translation,
                )
            )

        route = observed_call(
            "rag.route",
            route_query,
            query=contextual_query,
            conversation_context=conversation_history,
        )
        route_ms = _stage_ms(route_started)

        # Form requests are a deterministic internship-domain operation.
        # Do not allow a vague follow-up or inventory request to be routed to
        # conversation/general_support/out_of_scope before retrieval can run.
        if explicit_form_request or generic_form_listing_request:
            route = RouteDecision(
                intent="form_guidance",
                scope="internship",
                language=(
                    route.language
                    if route.language in {"vi", "en"}
                    else detect_query_language(query)
                ),
                allowed_document_types=list(
                    INTERNSHIP_DOCUMENT_TYPES
                ),
                blocked_document_types=[
                    document_type
                    for document_type in ALL_ROUTED_DOCUMENT_TYPES
                    if document_type not in INTERNSHIP_DOCUMENT_TYPES
                ],
                reason=(
                    "deterministic_form_context: explicit/list/follow-up form request"
                ),
            )

        if (
            speculative_planner_future is not None
            and route.scope not in {"internship", "career", "capstone"}
        ):
            speculative_planner_future.cancel()

        logger.debug(
            "Route: intent=%s scope=%s",
            route.intent,
            route.scope,
        )

        raise_if_cancelled()
        emit_status(
            "retrieving"
            if route.scope in {"internship", "career", "capstone"}
            else "thinking",
            route,
        )

# ------------------------------------------------------------------
# Conversation: trả lời trực tiếp, không chạy RAG
# ------------------------------------------------------------------
# ------------------------------------------------------------------
# Conversation: trả lời trực tiếp, không chạy RAG
# ------------------------------------------------------------------
        # ------------------------------------------------------------------
# Semantic language gate
# ------------------------------------------------------------------
        if route.language == "unsupported":
            return QueryResult(
                query=query,
                answer=(
                    "Hiện tại tôi chỉ hỗ trợ tiếng Việt hoặc tiếng Anh. "
                    "Vui lòng đặt lại câu hỏi bằng một trong hai ngôn ngữ này.\n\n"
                    "Internova AI currently supports Vietnamese and English only. "
                    "Please ask your question again in one of these languages."
                ),
                answer_status="out_of_scope",
                answer_language="vi",
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

        if route.language == "unknown":
            route.language = "vi"
        if (
            opts.answer_language is None
            and route.language in {"vi", "en"}
        ):
            answer_language = route.language

        if route.scope == "conversation":
            raise_if_cancelled()
            emit_status("answering", route)
            conversational = generate_conversation_answer(
                query=query,
                answer_language=answer_language,
                conversation_history=conversation_history,
                on_token=on_token,
                should_cancel=should_cancel,
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
        if route.scope == "general_support":
            raise_if_cancelled()
            emit_status("answering", route)
            support_answer = generate_general_support_answer(
                query=query,
                answer_language=answer_language,
                conversation_history=conversation_history,
                on_token=on_token,
                should_cancel=should_cancel,
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
# Step 3: Query translation / expansion
# ------------------------------------------------------------------
        raise_if_cancelled()
        planner_started = time.perf_counter()

        if speculative_planner_future is not None:
            try:
                expanded = speculative_planner_future.result()
            except Exception as exc:
                logger.warning(
                    "Speculative planner failed; retrying normal planner path: %s",
                    exc,
                )
                expanded = observed_call(
                    "rag.query_plan",
                    build_retrieval_queries,
                    query=contextual_query,
                    conversation_context=planner_context,
                    use_semantic_planner=opts.use_semantic_query_planner,
                    use_openai_translation=opts.use_openai_translation,
                )
        else:
            expanded = observed_call(
                "rag.query_plan",
                build_retrieval_queries,
                query=contextual_query,
                conversation_context=planner_context,
                use_semantic_planner=opts.use_semantic_query_planner,
                use_openai_translation=opts.use_openai_translation,
            )

        planner_wait_ms = _stage_ms(planner_started)

        logger.debug(
            "Search queries: %s",
            expanded.search_queries,
        )
        logger.debug(
            "Query processing mode=%s",
            "semantic" if expanded.used_openai else "legacy_fallback",
        )


        retrieval_query = (
            (
                expanded.normalized_query
                or query
            )
            if isolated_form_request
            else (
                expanded.query_en
                or expanded.normalized_query
                or query
            )
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

        # ------------------------------------------------------------------
        # Step 5: Rerank
        # ------------------------------------------------------------------
        rerank_result = observed_call(
            "rag.rerank",
            rerank_hits,
            # For an explicit Form-N request, rank against the user's current
            # wording instead of an LLM-planned query that may inherit stale
            # entities from previous turns.
            query=(
                contextual_query
                if explicit_form_request or generic_form_listing_request
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
        if explicit_form_request and explicit_form_match is not None:
            requested_form_number = explicit_form_match.group(1)
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

        elif generic_form_listing_request:
            form_listing_hits = _one_hit_per_form(
                fused_hits,
                max_hits=opts.top_k_rerank,
            )
            if form_listing_hits:
                final_hits = form_listing_hits

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
        evidence = observed_call(
            "rag.evidence",
            check_evidence,
            query=query,
            hits=final_hits,
            route=route,
            # A CURRENT explicit/list request is self-contained. A Form
            # resolved from memory is not: keep history for evidence planning.
            conversation_context=(
                ""
                if isolated_form_request
                else conversation_history
            ),
        )

        evidence_ms = _stage_ms(evidence_started)
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
        emit_status("answering", route)
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
        )

        generation_ms = _stage_ms(generation_started)
        raise_if_cancelled()

        # ------------------------------------------------------------------
        # Step 9: Groundedness
        # ------------------------------------------------------------------
        groundedness_started = time.perf_counter()
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

        # Internally, groundedness may need multiple chunks from one file.
        # The user-facing source list should represent files, not chunks.
        # Therefore:
        # - Form 2 with two supporting chunks => 1 source card (Form 2 file)
        # - "all forms" => one source card per Form 1/2/3/4 file
        # This runs only after groundedness has passed, so validation quality is
        # not weakened by the UI deduplication.
        if explicit_form_request and explicit_form_match is not None:
            sources_dicts = _collapse_form_sources_for_ui(
                sources_dicts,
                requested_form_number=explicit_form_match.group(1),
                all_forms=False,
            )
        elif generic_form_listing_request:
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



def _form_display_title(
    document_name: str,
    form_number: str,
) -> str:
    """Build a readable title directly from the indexed filename."""
    name = Path(document_name or "").stem

    name = re.sub(
        rf"^form[-_ ]?{re.escape(str(form_number))}[-_ ]*",
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