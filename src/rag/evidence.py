"""evidence.py — Evidence validation for the RAG query pipeline.

Checks whether retrieved chunks contain enough direct evidence
to support the user's question before answer generation.
"""

from __future__ import annotations

import logging
import re
import time
import unicodedata
from functools import lru_cache
from typing import Literal, Protocol
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from src.config import get_settings
from src.rag.prompts import (
    SEMANTIC_EVIDENCE_COMBINED_SYSTEM_PROMPT,
    SEMANTIC_EVIDENCE_COMBINED_USER_TEMPLATE,
    SEMANTIC_EVIDENCE_PLANNER_SYSTEM_PROMPT,
    SEMANTIC_EVIDENCE_PLANNER_USER_TEMPLATE,
    SEMANTIC_EVIDENCE_SELECTOR_SYSTEM_PROMPT,
    SEMANTIC_EVIDENCE_SELECTOR_USER_TEMPLATE,
)

from src.rag.retrieval.retriever import RetrievalHit
logger = logging.getLogger(__name__)
@lru_cache(maxsize=4)
def _get_evidence_llm(model_name: str) -> ChatOpenAI:
    """
    Reuse the Evidence LLM client and its underlying HTTP connection pool.

    This is a latency-only optimization:
    - same model
    - same temperature
    - same prompts
    - same structured output schemas
    """
    settings = get_settings()

    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    return ChatOpenAI(
        model=model_name,
        api_key=settings.openai_api_key,
        temperature=0,
    )


# =============================================================================
# Types
# =============================================================================

EvidenceStatus = Literal[
    "sufficient",
    "insufficient",
]


class RouteLike(Protocol):
    """Minimal route interface required by evidence checking."""

    intent: str
    scope: str
    allowed_document_types: list[str]


# =============================================================================
# Regex patterns
# =============================================================================

NUMBER_RE = re.compile(
    r"\b\d+(?:\.\d+)?\b"
)

EMAIL_RE = re.compile(
    r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
    re.IGNORECASE,
)

MONTH_YEAR_RE = re.compile(
    r"\b(?:"
    r"jan(?:uary)?|"
    r"feb(?:ruary)?|"
    r"mar(?:ch)?|"
    r"apr(?:il)?|"
    r"may|"
    r"jun(?:e)?|"
    r"jul(?:y)?|"
    r"aug(?:ust)?|"
    r"sep(?:tember)?|"
    r"oct(?:ober)?|"
    r"nov(?:ember)?|"
    r"dec(?:ember)?"
    r")\s+\d{4}\b",
    re.IGNORECASE,
)

NUMERIC_DATE_RE = re.compile(
    r"\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b"
)

YEAR_RE = re.compile(
    r"\b20\d{2}\b"
)

FORM_RE = re.compile(
    r"\bform\s*([1-4](?:\.\d+)?)\b",
    re.IGNORECASE,
)


# Maximum evidence sent downstream for broad/composite questions.
MAX_EVIDENCE_CHUNKS = 5

# First pass prefers one chunk per document so citations are document-diverse.
MAX_CHUNKS_PER_DOCUMENT = 1

# Console diagnostics flag for development/testing.
# Set to False in production to avoid verbose console dumps.
DEBUG_EVIDENCE = False
# Temporary optimization switch.
# False = original 2-call semantic evidence flow.
# True  = combined 1-call semantic evidence flow.
USE_COMBINED_SEMANTIC_EVIDENCE = True

# Shadow test only.
# Fast planner is compared with the LLM planner but NEVER used for answering.
ENABLE_FAST_PLAN_SHADOW = True

ENABLE_DETERMINISTIC_EVIDENCE_FAST_PATH = True

# Conservative gate for questions whose correctness depends on semantic
# relationships between multiple conditions, exceptions, eligibility,
# authority, or case-specific adjudication. These questions keep the
# semantic evidence path; they are NOT answered by the fast deterministic path.
_COMPLEX_EVIDENCE_MARKERS = (
    "nếu ",
    "neu ",
    "nếu như",
    "trong khi",
    "nhưng ",
    "tuy nhiên",
    "ngoại lệ",
    "ngoai le",
    "exception",
    "được phép",
    "duoc phep",
    "có được",
    "co duoc",
    "can i ",
    "may i ",
    "am i eligible",
    "eligible",
    "đủ điều kiện",
    "du dieu kien",
    "rút ",
    "rut ",
    "withdraw",
    "withdrawal",
    "khiếu nại",
    "khieu nai",
    "grievance",
    "thẩm quyền",
    "tham quyen",
    "authority",
    "approve",
    "approval",
    "phê duyệt",
    "phe duyet",
    "bệnh",
    "benh",
    "medical",
    "health",
    "muộn",
    "muon",
    "late ",
    "vi phạm",
    "vi pham",
    "conflict",
)


def _can_use_deterministic_fast_path(
    query: str,
    route: RouteLike,
    allowed_hits: list[RetrievalHit],
    result: EvidenceCheckResult,
) -> bool:
    """Return True only for high-confidence direct-evidence questions.

    The fast path is intentionally conservative:
    - it never handles exception/eligibility/adjudication-style questions;
    - it requires at least one explicit deterministic evidence requirement;
    - every hard requirement must have a direct matching retrieved chunk;
    - the legacy checker must already have usable evidence and no missing facts.

    Anything uncertain falls through to the semantic evidence model.
    """
    if not ENABLE_DETERMINISTIC_EVIDENCE_FAST_PATH:
        return False

    normalized = normalize_text(query)

    if any(
        marker in normalized
        for marker in _COMPLEX_EVIDENCE_MARKERS
    ):
        return False

    # Route families where a seemingly simple answer may still require
    # interpreting conditions or an approval procedure.
    risky_intent_terms = (
        "withdraw",
        "grievance",
        "eligibility",
        "exception",
        "appeal",
    )
    route_intent = normalize_text(
        getattr(route, "intent", "") or ""
    )
    if any(term in route_intent for term in risky_intent_terms):
        return False

    if (
        result.evidence_status != "sufficient"
        or not result.used_chunk_ids
        or result.missing_evidence
    ):
        return False

    requirements = infer_required_evidence(
        query=query,
        route=route,
    )

    # Do not trust generic or soft-only legacy topic heuristics as semantic
    # proof. The deterministic fast path is valid only when at least one
    # explicit HARD requirement exists and every hard requirement matches.
    hard_requirements = [
        requirement
        for requirement in requirements
        if requirement.required
    ]

    if not hard_requirements:
        return False

    for requirement in hard_requirements:
        matched_hit = find_matching_hit(
            requirement,
            allowed_hits,
        )

        if matched_hit is None:
            return False

    return True

EvidenceMethod = Literal[
    "semantic",
    "legacy",
]


PARTIAL_SUPPORT_WEIGHT = 0.5


class EvidenceSupportSummary(BaseModel):
    """
    Summary of semantic evidence coverage.

    score:
    - full        = 1.0
    - partial     = 0.5
    - unsupported = 0.0
    """

    total_needs: int = 0

    full_needs: int = 0

    partial_needs: int = 0

    unsupported_needs: int = 0

    score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
    )


# =============================================================================
# Evidence result models
# =============================================================================

class EvidenceCheckResult(BaseModel):
    evidence_status: EvidenceStatus
    reason: str

    used_chunk_ids: list[str] = Field(
        default_factory=list
    )

    missing_evidence: list[str] = Field(
        default_factory=list
    )

    evidence_method: EvidenceMethod = "legacy"

    support_summary: EvidenceSupportSummary = Field(
        default_factory=EvidenceSupportSummary
    )

    @property
    def has_usable_evidence(self) -> bool:
        """True when at least one requested part has validated evidence."""
        return bool(self.used_chunk_ids)

    @property
    def is_partial(self) -> bool:
        """Backward-compatible partial-answer signal.

        We intentionally keep EvidenceStatus as only
        ``sufficient`` / ``insufficient`` so existing downstream schemas do
        not break.  A result is PARTIAL when:
        - some requested evidence is missing; but
        - at least one validated supporting chunk remains available.

        Downstream generation should answer only supported parts and explicitly
        state what remains unsupported.
        """
        return (
            self.evidence_status == "insufficient"
            and bool(self.used_chunk_ids)
        )

    @property
    def answer_status(
        self,
    ) -> Literal["answered", "not_found"]:
        # Partial evidence is still answerable in a bounded way.
        return (
            "answered"
            if (
                self.evidence_status == "sufficient"
                or self.has_usable_evidence
            )
            else "not_found"
        )

class EvidenceRequirement(BaseModel):
    kind: Literal[
        "number",
        "date",
        "email",
        "form_name",
        "topic",
    ]

    label: str

    values: list[str] = Field(
        default_factory=list
    )

    context_terms: list[str] = Field(
        default_factory=list
    )

    # Hard requirements can make evidence insufficient when missing.
    # Soft requirements only guide evidence selection for broad questions.
    required: bool = True

class SemanticEvidenceNeed(BaseModel):
    """One semantic evidence need inferred from the user's actual intent."""

    description: str

    fact_type: Literal[
        "number",
        "date",
        "email",
        "document",
        "procedure",
        "eligibility",
        "duration",
        "credit",
        "evaluation",
        "responsibility",
        "health",
        "grievance",
        "general_fact",
    ]

    explicit_values: list[str] = Field(
        default_factory=list
    )

    referenced_entities: list[str] = Field(
        default_factory=list
    )

    required: bool = True


class SemanticEvidencePlan(BaseModel):
    """Structured semantic plan describing what evidence is needed."""

    evidence_goal: str

    needs: list[SemanticEvidenceNeed] = Field(
        default_factory=list
    )

    referenced_entities: list[str] = Field(
        default_factory=list
    )

    answerable_from_documents: bool = True

    reason: str

class SemanticEvidenceMatch(BaseModel):
    """One retrieved chunk judged semantically relevant to an evidence need."""

    chunk_id: str

    supported_need_indexes: list[int] = Field(
        default_factory=list
    )

    reason: str



class SemanticEvidenceNeedSupport(BaseModel):
    """Completeness of retrieved support for one semantic evidence need."""

    need_index: int

    support_status: Literal[
        "full",
        "partial",
        "unsupported",
    ]

    supporting_chunk_ids: list[str] = Field(
        default_factory=list
    )

    reason: str


class SemanticEvidenceSelection(BaseModel):
    """Structured semantic selection over retrieved evidence candidates."""

    matches: list[SemanticEvidenceMatch] = Field(
        default_factory=list
    )

    need_supports: list[SemanticEvidenceNeedSupport] = Field(
        default_factory=list
    )

    unsupported_need_indexes: list[int] = Field(
        default_factory=list
    )

    sufficient: bool

    reason: str

class SemanticEvidenceCombinedResult(BaseModel):
    """
    Combined output for one-call semantic evidence processing.

    The plan and selection remain separate structured objects so the
    existing deterministic validator can be reused unchanged.
    """

    evidence_plan: SemanticEvidencePlan
    selection: SemanticEvidenceSelection





def summarize_semantic_support(
    evidence_plan: SemanticEvidencePlan,
    support_by_need: dict[
        int,
        SemanticEvidenceNeedSupport,
    ],
) -> EvidenceSupportSummary:
    """
    Calculate semantic evidence coverage.

    Required evidence needs are scored preferentially.
    If a plan contains no required needs, all needs are scored.
    """

    required_indexes = [
        index
        for index, need in enumerate(
            evidence_plan.needs
        )
        if need.required
    ]

    score_indexes = (
        required_indexes
        if required_indexes
        else list(
            range(len(evidence_plan.needs))
        )
    )

    if not score_indexes:
        return EvidenceSupportSummary()

    full_needs = 0
    partial_needs = 0
    unsupported_needs = 0

    for need_index in score_indexes:
        support = support_by_need.get(
            need_index
        )

        if support is None:
            unsupported_needs += 1
            continue

        if support.support_status == "full":
            full_needs += 1

        elif support.support_status == "partial":
            partial_needs += 1

        else:
            unsupported_needs += 1

    score = (
        full_needs
        + (
            PARTIAL_SUPPORT_WEIGHT
            * partial_needs
        )
    ) / len(score_indexes)

    return EvidenceSupportSummary(
        total_needs=len(score_indexes),
        full_needs=full_needs,
        partial_needs=partial_needs,
        unsupported_needs=unsupported_needs,
        score=round(score, 4),
    )


def plan_semantic_evidence(
    query: str,
    route: RouteLike,
    conversation_context: str = "",
) -> SemanticEvidencePlan:
    """Infer evidence needs semantically using structured LLM output."""

    if not (query or "").strip():
        raise ValueError("Query must not be empty")

    settings = get_settings()

    model_name = (
        settings.openai_chat_model
        or settings.model_name
    )

    llm = _get_evidence_llm(model_name)

    structured_planner = llm.with_structured_output(
        SemanticEvidencePlan
    )

    user_prompt = SEMANTIC_EVIDENCE_PLANNER_USER_TEMPLATE.format(
        route_intent=route.intent,
        route_scope=route.scope,
        conversation_context=(
            conversation_context
            or "No previous conversation."
        ),
        query=query,
    )

    result = structured_planner.invoke(
        [
            (
                "system",
                SEMANTIC_EVIDENCE_PLANNER_SYSTEM_PROMPT,
            ),
            (
                "human",
                user_prompt,
            ),
        ]
    )

    if isinstance(result, dict):
        result = SemanticEvidencePlan.model_validate(
            result
        )

    return result


def format_semantic_evidence_candidates(
    hits: list[RetrievalHit],
) -> str:
    """Format retrieved candidates for semantic evidence selection."""

    blocks: list[str] = []

    for index, hit in enumerate(
        hits,
        start=1,
    ):
        content = (
            hit.chunk.content_original
            or ""
        )

        blocks.append(
            "\n".join(
                [
                    f"Candidate {index}",
                    f"chunk_id: {hit.chunk_id}",
                    (
                        "document_name: "
                        f"{hit.chunk.document_name or ''}"
                    ),
                    (
                        "document_type: "
                        f"{hit.chunk.document_type or ''}"
                    ),
                    "content:",
                    content,
                ]
            )
        )

    return "\n\n---\n\n".join(blocks)


def evaluate_semantic_evidence_combined(
    query: str,
    route: RouteLike,
    hits: list[RetrievalHit],
    conversation_context: str = "",
) -> SemanticEvidenceCombinedResult:
    """
    Plan evidence needs and evaluate retrieved candidates in one LLM call.

    The output intentionally preserves the original
    SemanticEvidencePlan + SemanticEvidenceSelection structures so the
    existing deterministic validation layer remains unchanged.
    """

    if not (query or "").strip():
        raise ValueError("Query must not be empty")

    if not hits:
        raise ValueError(
            "Combined semantic evidence evaluation requires candidate hits"
        )

    settings = get_settings()

    model_name = (
        settings.openai_chat_model
        or settings.model_name
    )

    llm = _get_evidence_llm(model_name)

    structured_evaluator = llm.with_structured_output(
        SemanticEvidenceCombinedResult
    )

    candidate_chunks = format_semantic_evidence_candidates(
        hits
    )

    user_prompt = (
        SEMANTIC_EVIDENCE_COMBINED_USER_TEMPLATE.format(
            route_intent=route.intent,
            route_scope=route.scope,
            conversation_context=(
                conversation_context
                or "No previous conversation."
            ),
            query=query,
            candidate_chunks=candidate_chunks,
        )
    )

    result = structured_evaluator.invoke(
        [
            (
                "system",
                SEMANTIC_EVIDENCE_COMBINED_SYSTEM_PROMPT,
            ),
            (
                "human",
                user_prompt,
            ),
        ]
    )

    if isinstance(result, dict):
        result = SemanticEvidenceCombinedResult.model_validate(
            result
        )

    return result

def select_semantic_evidence(
    query: str,
    evidence_plan: SemanticEvidencePlan,
    hits: list[RetrievalHit],
) -> SemanticEvidenceSelection:
    """Select retrieved evidence semantically using structured LLM output."""

    if not hits:
        required_indexes = [
            index
            for index, need
            in enumerate(evidence_plan.needs)
            if need.required
        ]

        need_supports = [
            SemanticEvidenceNeedSupport(
                need_index=index,
                support_status="unsupported",
                supporting_chunk_ids=[],
                reason=(
                    "No retrieved candidate chunks were provided "
                    "for this evidence need."
                ),
            )
            for index, _need in enumerate(
                evidence_plan.needs
            )
        ]

        return SemanticEvidenceSelection(
            matches=[],
            need_supports=need_supports,
            unsupported_need_indexes=required_indexes,
            sufficient=not required_indexes,
            reason="No retrieved candidate chunks were provided.",
        )

    settings = get_settings()

    model_name = (
        settings.openai_chat_model
        or settings.model_name
    )

    llm = _get_evidence_llm(model_name)
    structured_selector = llm.with_structured_output(
        SemanticEvidenceSelection
    )

    candidate_chunks = (
        format_semantic_evidence_candidates(
            hits
        )
    )

    user_prompt = (
        SEMANTIC_EVIDENCE_SELECTOR_USER_TEMPLATE.format(
            query=query,
            evidence_plan=evidence_plan.model_dump_json(
                indent=2
            ),
            candidate_chunks=candidate_chunks,
        )
    )

    result = structured_selector.invoke(
        [
            (
                "system",
                SEMANTIC_EVIDENCE_SELECTOR_SYSTEM_PROMPT,
            ),
            (
                "human",
                user_prompt,
            ),
        ]
    )

    if isinstance(result, dict):
        result = SemanticEvidenceSelection.model_validate(
            result
        )

    return result


def validate_semantic_evidence_selection(
    evidence_plan: SemanticEvidencePlan,
    selection: SemanticEvidenceSelection,
    allowed_hits: list[RetrievalHit],
) -> EvidenceCheckResult:
    """Validate semantic support structure without re-interpreting meaning."""

    allowed_hit_ids = {
        hit.chunk_id
        for hit in allowed_hits
    }

    # ---------------------------------------------------------
    # 1. Validate selector matches structurally.
    # ---------------------------------------------------------
    matched_chunks_by_need: dict[int, list[str]] = {}

    for match in selection.matches:
        if match.chunk_id not in allowed_hit_ids:
            continue

        for need_index in match.supported_need_indexes:
            if not (
                0
                <= need_index
                < len(evidence_plan.needs)
            ):
                continue

            matched_chunks_by_need.setdefault(
                need_index,
                [],
            )

            if (
                match.chunk_id
                not in matched_chunks_by_need[
                    need_index
                ]
            ):
                matched_chunks_by_need[
                    need_index
                ].append(
                    match.chunk_id
                )

    # ---------------------------------------------------------
    # 2. Validate exactly one semantic support assessment
    #    for each evidence need.
    # ---------------------------------------------------------
    support_by_need: dict[
        int,
        SemanticEvidenceNeedSupport,
    ] = {}

    for support in selection.need_supports:
        if not (
            0
            <= support.need_index
            < len(evidence_plan.needs)
        ):
            continue

        # Ignore duplicate assessments after the first valid one.
        if support.need_index in support_by_need:
            continue

        valid_supporting_ids = [
            chunk_id
            for chunk_id
            in support.supporting_chunk_ids
            if (
                chunk_id in allowed_hit_ids
                and chunk_id
                in matched_chunks_by_need.get(
                    support.need_index,
                    [],
                )
            )
        ]

        support_status = support.support_status

        # A claim of full/partial support is structurally invalid
        # when no valid selected chunk actually supports that need.
        if (
            support_status
            in {"full", "partial"}
            and not valid_supporting_ids
        ):
            support_status = "unsupported"

        # Unsupported needs must not carry supporting chunks.
        if support_status == "unsupported":
            valid_supporting_ids = []

        support_by_need[
            support.need_index
        ] = SemanticEvidenceNeedSupport(
            need_index=support.need_index,
            support_status=support_status,
            supporting_chunk_ids=valid_supporting_ids,
            reason=support.reason,
        )

    support_summary = summarize_semantic_support(
        evidence_plan=evidence_plan,
        support_by_need=support_by_need,
    )

    # ---------------------------------------------------------
    # 3. Required needs missing a valid assessment are treated
    #    as unsupported.
    # ---------------------------------------------------------
    missing_required: list[str] = []

    partial_required: list[str] = []

    selected_chunk_ids: list[str] = []

    for need_index, need in enumerate(
        evidence_plan.needs
    ):
        support = support_by_need.get(
            need_index
        )

        if support is None:
            if need.required:
                missing_required.append(
                    need.description
                )
            continue

        if (
            need.required
            and support.support_status
            == "unsupported"
        ):
            missing_required.append(
                need.description
            )
            continue

        if (
            need.required
            and support.support_status
            == "partial"
        ):
            partial_required.append(
                need.description
            )

        if support.support_status in {
            "full",
            "partial",
        }:
            for chunk_id in (
                support.supporting_chunk_ids
            ):
                if (
                    chunk_id
                    not in selected_chunk_ids
                ):
                    selected_chunk_ids.append(
                        chunk_id
                    )

    # ---------------------------------------------------------
    # 4. Unsupported required evidence.
    #
    # IMPORTANT:
    # Do not erase evidence for the parts that ARE supported.
    #
    # Backward-compatible semantics:
    # - insufficient + no used_chunk_ids  => refuse the whole question;
    # - insufficient + used_chunk_ids     => bounded PARTIAL answer.
    #
    # This lets the generator answer only the supported sub-questions while
    # explicitly refusing / qualifying the items in missing_evidence.
    # ---------------------------------------------------------
    if missing_required:
        if selected_chunk_ids:
            return EvidenceCheckResult(
                evidence_status="insufficient",
                reason=(
                    "Some requested parts have validated supporting evidence, "
                    "but one or more required parts remain unsupported. "
                    "Answer only the supported parts and clearly state which "
                    "requested parts cannot be established from the available "
                    "documents."
                ),
                used_chunk_ids=selected_chunk_ids[
                    :MAX_EVIDENCE_CHUNKS
                ],
                missing_evidence=dedupe(
                    missing_required
                ),
                evidence_method="semantic",
                support_summary=support_summary,
            )

        return EvidenceCheckResult(
            evidence_status="insufficient",
            reason=(
                "None of the required requested parts has usable validated "
                "support in the retrieved documents."
            ),
            used_chunk_ids=[],
            missing_evidence=dedupe(
                missing_required
            ),
            evidence_method="semantic",
            support_summary=support_summary,
        )

    # ---------------------------------------------------------
    # 5. We still need at least one real supporting chunk.
    # ---------------------------------------------------------
    if not selected_chunk_ids:
        return EvidenceCheckResult(
            evidence_status="insufficient",
            reason=(
                "Semantic evidence selection did not identify "
                "a valid supporting chunk."
            ),
            used_chunk_ids=[],
            missing_evidence=[
                evidence_plan.evidence_goal
            ],
            evidence_method="semantic",
            support_summary=support_summary,
        )

    # ---------------------------------------------------------
    # 6. Partial support may still produce a bounded,
    #    grounded answer. It must remain visible in the reason.
    # ---------------------------------------------------------
    if partial_required:
        return EvidenceCheckResult(
            evidence_status="sufficient",
            reason=(
                "The required evidence is partially supported. "
                "A grounded answer can be provided, but it must remain "
                "bounded to what the selected documents actually establish "
                "and must identify the unresolved aspects."
            ),
            used_chunk_ids=selected_chunk_ids[
                :MAX_EVIDENCE_CHUNKS
            ],
            # Preserve partial need descriptions so downstream generation can
            # explicitly qualify what remains unresolved.
            missing_evidence=dedupe(
                partial_required
            ),
            evidence_method="semantic",
            support_summary=support_summary,
        )

    return EvidenceCheckResult(
        evidence_status="sufficient",
        reason=(
            "All required semantic evidence needs have "
            "full supporting evidence."
        ),
        used_chunk_ids=selected_chunk_ids[
            :MAX_EVIDENCE_CHUNKS
        ],
        missing_evidence=[],
        evidence_method="semantic",
        support_summary=support_summary,
    )


def check_evidence(
    query: str,
    hits: list[RetrievalHit],
    route: RouteLike,
    conversation_context: str = "",
) -> EvidenceCheckResult:
    """Check evidence semantically with legacy fallback on technical failure."""

    if route.scope == "out_of_scope":
        return EvidenceCheckResult(
            evidence_status="insufficient",
            reason=(
                "Query is outside the supported "
                "document scopes."
            ),
            missing_evidence=[
                "supported scope"
            ],
        )

    allowed_document_types = set(
        route.allowed_document_types
    )

    allowed_hits = [
        hit
        for hit in hits
        if hit.chunk.document_type
        in allowed_document_types
    ]

    if not allowed_hits:
        return EvidenceCheckResult(
            evidence_status="insufficient",
            reason=(
                "No retrieved chunks are from "
                "the allowed source scope."
            ),
            missing_evidence=[
                "allowed source chunk"
            ],
        )

    evidence_total_started = time.perf_counter()

    # =========================================================
    # E0: Deterministic high-confidence fast path
    # =========================================================
    #
    # Run the existing deterministic checker first. It is local Python work
    # (regex/topic/metadata matching) and is normally sub-millisecond to a few
    # milliseconds. We only accept it when the conservative gate proves that
    # every hard requirement has a direct supporting hit.
    #
    # Complex/ambiguous questions fall through unchanged to semantic evidence.
    deterministic_started = time.perf_counter()
    deterministic_result = check_evidence_legacy(
        query=query,
        hits=hits,
        route=route,
    )
    deterministic_ms = round(
        (time.perf_counter() - deterministic_started) * 1000.0,
        1,
    )

    if _can_use_deterministic_fast_path(
        query=query,
        route=route,
        allowed_hits=allowed_hits,
        result=deterministic_result,
    ):
        evidence_total_ms = round(
            (time.perf_counter() - evidence_total_started) * 1000.0,
            1,
        )
        logger.info(
            "Evidence latency stages ms mode=deterministic "
            "deterministic=%s total=%s candidates=%s",
            deterministic_ms,
            evidence_total_ms,
            len(allowed_hits),
        )
        return deterministic_result

    # =========================================================
    # E2: Combined semantic evidence flow
    # =========================================================
    # =========================================================
    if USE_COMBINED_SEMANTIC_EVIDENCE:
        try:
            combined_started = time.perf_counter()

            combined = evaluate_semantic_evidence_combined(
                query=query,
                route=route,
                hits=allowed_hits,
                conversation_context=conversation_context,
            )

            combined_ms = round(
                (time.perf_counter() - combined_started) * 1000.0,
                1,
            )

            evidence_plan = combined.evidence_plan
            selection = combined.selection

            if DEBUG_EVIDENCE:
                print(
                    "\n===== COMBINED SEMANTIC EVIDENCE PLAN =====",
                    flush=True,
                )
                print(
                    evidence_plan.model_dump_json(indent=2),
                    flush=True,
                )

                print(
                    "\n===== COMBINED SEMANTIC EVIDENCE SELECTION =====",
                    flush=True,
                )
                print(
                    selection.model_dump_json(indent=2),
                    flush=True,
                )

            validation_started = time.perf_counter()

            result = validate_semantic_evidence_selection(
                evidence_plan=evidence_plan,
                selection=selection,
                allowed_hits=allowed_hits,
            )

            validation_ms = round(
                (time.perf_counter() - validation_started) * 1000.0,
                1,
            )

            evidence_total_ms = round(
                (time.perf_counter() - evidence_total_started) * 1000.0,
                1,
            )

            logger.info(
                "Evidence latency stages ms mode=combined "
                "combined=%s validation=%s total=%s "
                "candidates=%s needs=%s",
                combined_ms,
                validation_ms,
                evidence_total_ms,
                len(allowed_hits),
                len(evidence_plan.needs),
            )

            return result

        except Exception as combined_exc:
            logger.warning(
                "Combined semantic evidence failed; "
                "falling back to original split semantic flow: %s",
                combined_exc,
            )

    # =========================================================
    # Original split semantic flow
    # =========================================================
    try:
        plan_started = time.perf_counter()

        evidence_plan = plan_semantic_evidence(
            query=query,
            route=route,
            conversation_context=conversation_context,
        )

        plan_ms = round(
            (time.perf_counter() - plan_started) * 1000.0,
            1,
        )

        selection_started = time.perf_counter()

        selection = select_semantic_evidence(
            query=query,
            evidence_plan=evidence_plan,
            hits=allowed_hits,
        )

        selection_ms = round(
            (time.perf_counter() - selection_started) * 1000.0,
            1,
        )

        if DEBUG_EVIDENCE:
            print(
                "\n===== SEMANTIC EVIDENCE PLAN =====",
                flush=True,
            )
            print(
                evidence_plan.model_dump_json(indent=2),
                flush=True,
            )

            print(
                "\n===== SEMANTIC EVIDENCE SELECTION =====",
                flush=True,
            )
            print(
                selection.model_dump_json(indent=2),
                flush=True,
            )

        validation_started = time.perf_counter()

        result = validate_semantic_evidence_selection(
            evidence_plan=evidence_plan,
            selection=selection,
            allowed_hits=allowed_hits,
        )

        validation_ms = round(
            (time.perf_counter() - validation_started) * 1000.0,
            1,
        )

        evidence_total_ms = round(
            (time.perf_counter() - evidence_total_started) * 1000.0,
            1,
        )

        logger.info(
            "Evidence latency stages ms mode=split "
            "plan=%s selection=%s validation=%s total=%s "
            "candidates=%s needs=%s",
            plan_ms,
            selection_ms,
            validation_ms,
            evidence_total_ms,
            len(allowed_hits),
            len(evidence_plan.needs),
        )

        return result

    except Exception as exc:
        logger.warning(
            "Semantic evidence processing failed; "
            "using legacy evidence fallback: %s",
            exc,
        )

    return check_evidence_legacy(
        query=query,
        hits=hits,
        route=route,
    )


def check_evidence_legacy(
    query: str,
    hits: list[RetrievalHit],
    route: RouteLike,
) -> EvidenceCheckResult:
    """Check whether retrieved chunks contain enough direct evidence."""

    # ---------------------------------------------------------------------
    # Out-of-scope query
    # ---------------------------------------------------------------------

    if route.scope == "out_of_scope":
        return EvidenceCheckResult(
            evidence_status="insufficient",
            reason=(
                "Query is outside the supported "
                "document scopes."
            ),
            missing_evidence=[
                "supported scope"
            ],
        )

    # ---------------------------------------------------------------------
    # Keep only sources allowed by router
    # ---------------------------------------------------------------------

    allowed_document_types = set(
        route.allowed_document_types
    )

    allowed_hits = [
        hit
        for hit in hits
        if hit.chunk.document_type
        in allowed_document_types
    ]

    if not allowed_hits:
        return EvidenceCheckResult(
            evidence_status="insufficient",
            reason=(
                "No retrieved chunks are from "
                "the allowed source scope."
            ),
            missing_evidence=[
                "allowed source chunk"
            ],
        )

    # ---------------------------------------------------------------------
    # Determine required evidence
    # ---------------------------------------------------------------------

    requirements = infer_required_evidence(
        query=query,
        route=route,
    )

    debug_evidence_state(
        requirements=requirements,
        allowed_hits=allowed_hits,
    )

    # ---------------------------------------------------------------------
    # No explicit/special requirement:
    # choose document-diverse evidence instead of allowed_hits[0].
    # ---------------------------------------------------------------------

    if not requirements:
        selected_hits = select_diverse_hits(
            hits=allowed_hits,
            max_chunks=MAX_EVIDENCE_CHUNKS,
            max_chunks_per_document=MAX_CHUNKS_PER_DOCUMENT,
        )

        debug_selected_hits(
            "SELECTED EVIDENCE (NO REQUIREMENTS)",
            selected_hits,
        )

        return EvidenceCheckResult(
            evidence_status="sufficient",
            reason=(
                "Retrieved diverse chunks from the "
                "allowed source scope are available."
            ),
            used_chunk_ids=[
                hit.chunk_id
                for hit in selected_hits
            ],
        )

    # ---------------------------------------------------------------------
    # Match evidence requirements against retrieved chunks
    # ---------------------------------------------------------------------

    matched_hits: list[RetrievalHit] = []
    used_chunk_ids: list[str] = []
    missing: list[str] = []

    for requirement in requirements:
        matched_hit = find_matching_hit(
            requirement,
            allowed_hits,
        )

        if matched_hit is None:
            # Missing hard evidence means the answer is not grounded enough.
            # Missing soft topic evidence only means we could not find that
            # aspect among the retrieved candidates; do not fail the whole
            # broad/composite answer for that alone.
            if requirement.required:
                missing.append(
                    requirement.label
                )

            debug_requirement_match(
                requirement=requirement,
                matched_hit=None,
            )
            continue

        debug_requirement_match(
            requirement=requirement,
            matched_hit=matched_hit,
        )

        if (
            matched_hit.chunk_id
            not in used_chunk_ids
        ):
            matched_hits.append(
                matched_hit
            )
            used_chunk_ids.append(
                matched_hit.chunk_id
            )

    if missing:
        if matched_hits:
            return EvidenceCheckResult(
                evidence_status="insufficient",
                reason=(
                    "Some requested parts have direct evidence, while other "
                    "required parts are not established. Answer only the "
                    "supported parts and identify the missing parts."
                ),
                used_chunk_ids=[
                    hit.chunk_id
                    for hit in matched_hits[
                        :MAX_EVIDENCE_CHUNKS
                    ]
                ],
                missing_evidence=dedupe(
                    missing
                ),
                evidence_method="legacy",
            )

        return EvidenceCheckResult(
            evidence_status="insufficient",
            reason=(
                "Required evidence is not directly present in the allowed "
                "chunks, and no requested part has usable direct support."
            ),
            used_chunk_ids=[],
            missing_evidence=dedupe(
                missing
            ),
            evidence_method="legacy",
        )

    # ---------------------------------------------------------------------
    # Broad/composite questions need evidence from multiple documents.
    #
    # Example:
    # - preparation
    # - registration
    # - documents/forms
    # - responsibilities during internship
    # - grievance
    # - final evaluation
    #
    # Preserve requirement matches first, then fill with the strongest
    # document-diverse retrieved chunks. This avoids collapsing a
    # multi-document question back to one citation.
    # ---------------------------------------------------------------------

    if asks_for_comprehensive_answer(
        normalize_text(query)
    ):
        selected_hits = select_diverse_hits(
            hits=allowed_hits,
            max_chunks=MAX_EVIDENCE_CHUNKS,
            max_chunks_per_document=MAX_CHUNKS_PER_DOCUMENT,
            seed_hits=matched_hits,
        )

        debug_selected_hits(
            "SELECTED EVIDENCE (COMPREHENSIVE)",
            selected_hits,
        )

        return EvidenceCheckResult(
            evidence_status="sufficient",
            reason=(
                "All hard evidence requirements are satisfied, "
                "and diverse retrieved evidence was selected "
                "for the composite question."
            ),
            used_chunk_ids=[
                hit.chunk_id
                for hit in selected_hits
            ],
        )

    # ---------------------------------------------------------------------
    # Normal factual question:
    # use only chunks that actually satisfy its evidence requirements.
    # ---------------------------------------------------------------------

    if matched_hits:
        debug_selected_hits(
            "SELECTED EVIDENCE (MATCHED REQUIREMENTS)",
            matched_hits,
        )

        return EvidenceCheckResult(
            evidence_status="sufficient",
            reason=(
                "All required evidence appears directly "
                "in the allowed chunks."
            ),
            used_chunk_ids=[
                hit.chunk_id
                for hit in matched_hits
            ],
        )

    # Only soft requirements existed and none matched.
    # Fall back to strong diverse retrieved evidence rather than failing
    # or silently selecting a single chunk.
    selected_hits = select_diverse_hits(
        hits=allowed_hits,
        max_chunks=MAX_EVIDENCE_CHUNKS,
        max_chunks_per_document=MAX_CHUNKS_PER_DOCUMENT,
    )

    debug_selected_hits(
        "SELECTED EVIDENCE (SOFT REQUIREMENT FALLBACK)",
        selected_hits,
    )

    return EvidenceCheckResult(
        evidence_status="sufficient",
        reason=(
            "No hard evidence requirement was missing; "
            "using diverse retrieved evidence."
        ),
        used_chunk_ids=[
            hit.chunk_id
            for hit in selected_hits
        ],
    )

# =============================================================================
# Infer required evidence
# =============================================================================

def infer_required_evidence(
    query: str,
    route: RouteLike,
) -> list[EvidenceRequirement]:
    """Infer hard facts and soft topic evidence required by the query."""

    normalized = normalize_text(
        query
    )

    requirements: list[
        EvidenceRequirement
    ] = []

    # ---------------------------------------------------------------------
    # Number
    # ---------------------------------------------------------------------

    # Không coi số nằm trong "Form 1", "Form 2", ...
    # là một numeric fact mà người dùng đang yêu cầu.
    query_without_form_ids = FORM_RE.sub(
        " ",
        query,
    )

    query_numbers = NUMBER_RE.findall(
        query_without_form_ids
    )

    if query_numbers:
        requirements.append(
            EvidenceRequirement(
                kind="number",
                label="requested number",
                values=query_numbers,
                required=True,
            )
        )

    elif asks_for_numeric_fact(
        normalized,
        route,
    ):
        requirements.append(
            EvidenceRequirement(
                kind="number",
                label="direct number",
                context_terms=numeric_context_terms(
                    normalized,
                    route,
                ),
                required=True,
            )
        )

    # ---------------------------------------------------------------------
    # Date
    # ---------------------------------------------------------------------

    query_dates = extract_dates(
        query
    )

    if query_dates:
        requirements.append(
            EvidenceRequirement(
                kind="date",
                label="requested date",
                values=query_dates,
                required=True,
            )
        )

    elif asks_for_deadline(
        normalized
    ):
        requirements.append(
            EvidenceRequirement(
                kind="date",
                label="specific deadline",
                required=True,
            )
        )

    # ---------------------------------------------------------------------
    # Email
    # ---------------------------------------------------------------------

    if asks_for_email(
        normalized
    ):
        requirements.append(
            EvidenceRequirement(
                kind="email",
                label="email address",
                required=True,
            )
        )

    # ---------------------------------------------------------------------
    # Explicit forms
    #
    # IMPORTANT:
    # Each inferred form becomes its own requirement. The previous version
    # placed every form alias in one requirement and find_matching_hit()
    # returned after the first matching form, which could collapse
    # multi-form questions to one chunk.
    # ---------------------------------------------------------------------

    form_values = infer_required_forms(
        normalized,
        route,
    )

    for form_value in form_values:
        requirements.append(
            EvidenceRequirement(
                kind="form_name",
                label=(
                    f"form evidence for "
                    f"{form_value}"
                ),
                values=[
                    form_value
                ],
                required=True,
            )
        )

    # ---------------------------------------------------------------------
    # Composite internship topics
    #
    # These are SOFT requirements: they guide selection toward the
    # different aspects explicitly requested by the user, but a missing
    # topic does not automatically turn the whole answer into "not found".
    # This is useful for checklist/summary questions.
    # ---------------------------------------------------------------------

    if (
        route.scope == "internship"
        or route.intent.startswith(
            "internship_"
        )
    ):
        requirements.extend(
            infer_composite_internship_topics(
                normalized
            )
        )

    requirements = dedupe_requirements(
        requirements
    )

    # ---------------------------------------------------------------------
    # Generic internship topic
    # ---------------------------------------------------------------------

    if (
        not requirements
        and route.intent.startswith(
            "internship_"
        )
    ):
        # Relax topic requirement for a generic internship query routed
        # to registration when the query does not actually mention
        # registration concepts.
        if route.intent == "internship_registration":
            registration_keywords = (
                "dang ky",
                "registration",
                "register",
                "irf",
                "form 1",
                "application",
            )

            if not any(
                keyword in normalized
                for keyword
                in registration_keywords
            ):
                return requirements

        requirements.append(
            EvidenceRequirement(
                kind="topic",
                label=(
                    f"topic evidence for "
                    f"{route.intent}"
                ),
                values=[
                    route.intent
                ],
                required=True,
            )
        )

    return requirements

# =============================================================================
# Evidence matching
# =============================================================================

def find_matching_hit(
    requirement: EvidenceRequirement,
    hits: list[RetrievalHit],
) -> RetrievalHit | None:
    """Find the strongest retrieved chunk satisfying one requirement."""
    # Với câu hỏi về biểu mẫu cụ thể, ưu tiên chính file form
# trước các policy chỉ nhắc tới tên biểu mẫu.
    if requirement.kind == "form_name":
        # Pass 1: ưu tiên document_type == "form"
        for hit in hits:
            content = hit.chunk.content_original or ""
            normalized_content = normalize_text(content)

            if (
                hit.chunk.document_type == "form"
                and form_requirement_matches(
                    requirement,
                    normalized_content,
                )
            ):
                return hit

        # Pass 2: nếu không tìm thấy file form thật,
        # mới cho phép policy/agreement làm evidence fallback.
        for hit in hits:
            content = hit.chunk.content_original or ""
            normalized_content = normalize_text(content)

            if form_requirement_matches(
                requirement,
                normalized_content,
            ):
                return hit

        return None

    for hit in hits:
        content = (
            hit.chunk.content_original
            or ""
        )

        normalized_content = normalize_text(
            content
        )

        document_name = normalize_text(
            hit.chunk.document_name
            or ""
        )

        searchable_text = " ".join(
            [
                normalized_content,
                document_name,
            ]
        )

        # Number
        if (
            requirement.kind == "number"
            and number_requirement_matches(
                requirement,
                content,
            )
        ):
            return hit

        # Date
        if (
            requirement.kind == "date"
            and date_requirement_matches(
                requirement,
                content,
            )
        ):
            return hit

        # Email
        if (
            requirement.kind == "email"
            and EMAIL_RE.search(content)
        ):
            return hit

        # Form
        if (
            requirement.kind == "form_name"
            and form_requirement_matches(
                requirement,
                searchable_text,
            )
        ):
            return hit

        # Topic
        if requirement.kind == "topic":
            chunk_topic = normalize_text(
                hit.chunk.topic
                or ""
            )

            normalized_values = [
                normalize_text(value)
                for value
                in requirement.values
            ]

            if (
                chunk_topic
                and chunk_topic
                in normalized_values
            ):
                return hit

            if any(
                value.replace(
                    "_",
                    " ",
                )
                in searchable_text
                for value
                in normalized_values
                if value
            ):
                return hit

            if any(
                normalize_text(term)
                in searchable_text
                for term
                in requirement.context_terms
                if normalize_text(term)
            ):
                return hit

    return None

# =============================================================================
# Number matching
# =============================================================================

def number_requirement_matches(
    requirement: EvidenceRequirement,
    content: str,
) -> bool:
    """Check whether required numeric evidence exists."""

    content_numbers = set(
        NUMBER_RE.findall(
            content
        )
    )

    # Query contains explicit number.
    if requirement.values:
        return any(
            value in content_numbers
            for value in requirement.values
        )

    if not content_numbers:
        return False

    normalized_content = normalize_text(
        content
    )

    if requirement.context_terms:
        return any(
            term in normalized_content
            for term
            in requirement.context_terms
        )

    return True


# =============================================================================
# Date matching
# =============================================================================

def date_requirement_matches(
    requirement: EvidenceRequirement,
    content: str,
) -> bool:
    """Check whether required date evidence exists."""

    normalized_content = normalize_text(
        content
    )

    if requirement.values:
        return any(
            normalize_text(value)
            in normalized_content
            for value
            in requirement.values
        )

    return bool(
        extract_dates(
            content
        )
    )


# =============================================================================
# Form matching
# =============================================================================

def form_requirement_matches(
    requirement: EvidenceRequirement,
    normalized_content: str,
) -> bool:
    """Check whether required form evidence exists, including form aliases."""

    form_aliases = {
        "form 1": [
            "form 1",
            "internship request form",
            "irf",
        ],
        "form 2": [
            "form 2",
            "release of liability",
            "hold harmless",
            "internship agreement",
        ],
        "form 3": [
            "form 3",
            "statement of internship grievance",
            "internship grievance",
            "grievance",
        ],
        "form 4": [
            "form 4",
            "sample evaluations",
            "evaluation of intern",
            "student evaluation of internship experience",
            "employer evaluation of intern",
            "faculty mentor evaluation of intern",
        ],
    }

    for value in requirement.values:
        normalized_value = normalize_text(value)

        aliases = form_aliases.get(
            normalized_value,
            [normalized_value],
        )

        if any(
            normalize_text(alias) in normalized_content
            for alias in aliases
        ):
            return True

    return False


def infer_required_forms(
    normalized_query: str,
    route: RouteLike,
) -> list[str]:
    """Infer explicitly requested internship forms/documents."""

    forms = [
        f"form {match}"
        for match in FORM_RE.findall(
            normalized_query
        )
    ]

    asks_about_form = any(
        keyword in normalized_query
        for keyword in (
            "form",
            "bieu mau",
            "don",
            "mau don",
            "nop don",
        )
    )

    if asks_about_form:
        if route.intent == "internship_registration":
            forms.append(
                "form 1"
            )

        if route.intent == "internship_grievance":
            forms.extend(
                [
                    "form 3",
                    "statement of internship grievance",
                ]
            )

        if route.intent == "internship_evaluation":
            forms.extend(
                [
                    "form 4",
                    "evaluation",
                ]
            )

    # Agreement / documents that must be signed.
    if any(
        keyword in normalized_query
        for keyword in (
            "liability",
            "hold harmless",
            "release of liability",
            "internship agreement",
        )
    ):
        forms.extend(
            [
                "form 2",
                "release of liability",
                "hold harmless",
                "internship agreement",
            ]
        )

    return dedupe(
        forms
    )


def infer_composite_internship_topics(
    normalized_query: str,
) -> list[EvidenceRequirement]:
    """Infer multiple internship aspects explicitly requested in one query.

    These requirements are soft selection hints. They are designed for
    broad questions such as a full internship checklist, where one router
    intent alone is not enough to represent every requested subtopic.
    """

    topic_specs = [
        {
            "value": "internship_preparation",
            "label": "internship preparation",
            "query_terms": (
                "chuan bi truoc",
                "truoc internship",
                "truoc khi thuc tap",
                "before internship",
                "preparation",
                "readiness",
                "orientation",
            ),
            "context_terms": (
                "fundamental internship readiness",
                "internship orientation",
                "pre-requisite",
                "prerequisite",
                "before beginning",
                "before commencing",
            ),
        },
        {
            "value": "internship_registration",
            "label": "internship registration",
            "query_terms": (
                "dang ky",
                "registration",
                "register",
                "irf",
                "internship request form",
                "application",
            ),
            "context_terms": (
                "internship request form",
                "irf",
                "host company",
                "approval",
                "academic credit",
                "registration",
            ),
        },
        {
            "value": "internship_agreement",
            "label": "internship documents and agreement",
            "query_terms": (
                "giay to",
                "can ky",
                "ky giay",
                "agreement",
                "hold harmless",
                "liability",
            ),
            "context_terms": (
                "internship agreement",
                "release of liability",
                "hold harmless",
                "student signature",
                "agreement",
            ),
        },
        {
            "value": "internship_responsibilities",
            "label": "requirements during internship",
            "query_terms": (
                "trong qua trinh thuc tap",
                "yeu cau trong qua trinh",
                "during internship",
                "student responsibilities",
                "tuan thu",
                "quy dinh",
            ),
            "context_terms": (
                "student responsibilities",
                "code of conduct",
                "professional conduct",
                "dress code",
                "punctuality",
                "host organization",
            ),
        },
        {
            "value": "internship_grievance",
            "label": "internship grievance",
            "query_terms": (
                "xu ly su co",
                "su co",
                "khieu nai",
                "grievance",
                "incident",
                "misconduct",
                "harassment",
            ),
            "context_terms": (
                "statement of internship grievance",
                "grievance",
                "incident",
                "witness",
                "misconduct",
                "career services",
            ),
        },
        {
            "value": "internship_evaluation",
            "label": "internship evaluation",
            "query_terms": (
                "danh gia cuoi ky",
                "danh gia",
                "evaluation",
                "cuoi ky",
                "end of internship",
            ),
            "context_terms": (
                "evaluation of intern",
                "student evaluation",
                "faculty mentor evaluation",
                "employer evaluation",
                "end of the internship",
                "performance",
            ),
        },
    ]

    requirements: list[
        EvidenceRequirement
    ] = []

    for spec in topic_specs:
        if any(
            term in normalized_query
            for term
            in spec["query_terms"]
        ):
            requirements.append(
                EvidenceRequirement(
                    kind="topic",
                    label=spec["label"],
                    values=[
                        spec["value"]
                    ],
                    context_terms=list(
                        spec["context_terms"]
                    ),
                    required=False,
                )
            )

    return requirements


def asks_for_comprehensive_answer(
    normalized_query: str,
) -> bool:
    """Return True for broad/composite questions needing several sources."""

    broad_markers = (
        "toan bo tai lieu",
        "tat ca tai lieu",
        "checklist",
        "tong hop",
        "day du",
        "all documents",
        "all provided documents",
        "across documents",
        "comprehensive",
    )

    if any(
        marker in normalized_query
        for marker in broad_markers
    ):
        return True

    aspect_groups = (
        (
            "chuan bi",
            "preparation",
            "readiness",
        ),
        (
            "dang ky",
            "registration",
            "register",
            "irf",
        ),
        (
            "giay to",
            "agreement",
            "form",
        ),
        (
            "trong qua trinh",
            "during internship",
            "responsibilities",
        ),
        (
            "su co",
            "grievance",
            "incident",
        ),
        (
            "danh gia",
            "evaluation",
        ),
    )

    matched_aspects = sum(
        1
        for group in aspect_groups
        if any(
            term in normalized_query
            for term in group
        )
    )

    return matched_aspects >= 2


def select_diverse_hits(
    hits: list[RetrievalHit],
    max_chunks: int,
    max_chunks_per_document: int,
    seed_hits: list[RetrievalHit] | None = None,
) -> list[RetrievalHit]:
    """Select strong evidence while preferring different documents.

    Requirement-matched seed hits are preserved first. Then the function
    adds the strongest unseen chunks, preferring document diversity.
    If there are fewer unique documents than max_chunks, it fills remaining
    slots with the strongest remaining chunks so answer coverage is not lost.
    """

    selected: list[RetrievalHit] = []
    selected_ids: set[str] = set()
    document_counts: dict[str, int] = {}

    def add_hit(
        hit: RetrievalHit,
        *,
        enforce_document_limit: bool,
    ) -> bool:
        if hit.chunk_id in selected_ids:
            return False

        document_name = (
            hit.chunk.document_name
            or hit.chunk_id
        )

        current_count = document_counts.get(
            document_name,
            0,
        )

        if (
            enforce_document_limit
            and current_count
            >= max_chunks_per_document
        ):
            return False

        selected.append(
            hit
        )
        selected_ids.add(
            hit.chunk_id
        )
        document_counts[document_name] = (
            current_count + 1
        )

        return True

    # 1) Preserve evidence that directly matched requirements.
    for hit in seed_hits or []:
        if len(selected) >= max_chunks:
            break

        add_hit(
            hit,
            enforce_document_limit=False,
        )

    # 2) Prefer one/few chunks from each distinct document.
    for hit in hits:
        if len(selected) >= max_chunks:
            break

        add_hit(
            hit,
            enforce_document_limit=True,
        )

    # 3) If not enough unique documents are available, fill remaining
    #    slots with strongest unseen chunks.
    for hit in hits:
        if len(selected) >= max_chunks:
            break

        add_hit(
            hit,
            enforce_document_limit=False,
        )

    return selected


def dedupe_requirements(
    requirements: list[EvidenceRequirement],
) -> list[EvidenceRequirement]:
    """Deduplicate equivalent evidence requirements while preserving order."""

    seen: set[
        tuple[
            str,
            tuple[str, ...],
            tuple[str, ...],
            bool,
        ]
    ] = set()

    result: list[
        EvidenceRequirement
    ] = []

    for requirement in requirements:
        key = (
            requirement.kind,
            tuple(
                normalize_text(value)
                for value
                in requirement.values
            ),
            tuple(
                normalize_text(term)
                for term
                in requirement.context_terms
            ),
            requirement.required,
        )

        if key in seen:
            continue

        seen.add(
            key
        )
        result.append(
            requirement
        )

    return result


def debug_evidence_state(
    requirements: list[EvidenceRequirement],
    allowed_hits: list[RetrievalHit],
) -> None:
    """Print evidence diagnostics while DEBUG_EVIDENCE is enabled."""

    if not DEBUG_EVIDENCE:
        return

    print(
        "\n===== REQUIREMENTS =====",
        flush=True,
    )

    for requirement in requirements:
        print(
            requirement,
            flush=True,
        )

    if not requirements:
        print(
            "[]",
            flush=True,
        )

    print(
        "\n===== ALLOWED HITS =====",
        flush=True,
    )

    for index, hit in enumerate(
        allowed_hits,
        start=1,
    ):
        print(
            index,
            "| chunk_id =",
            hit.chunk_id,
            "| document =",
            hit.chunk.document_name,
            "| type =",
            hit.chunk.document_type,
            flush=True,
        )


def debug_requirement_match(
    requirement: EvidenceRequirement,
    matched_hit: RetrievalHit | None,
) -> None:
    """Print one requirement-to-hit match."""

    if not DEBUG_EVIDENCE:
        return

    print(
        "\n===== REQUIREMENT MATCH =====",
        flush=True,
    )

    print(
        "requirement =",
        requirement.label,
        "| required =",
        requirement.required,
        flush=True,
    )

    if matched_hit is None:
        print(
            "matched = NONE",
            flush=True,
        )
        return

    print(
        "matched chunk_id =",
        matched_hit.chunk_id,
        "| document =",
        matched_hit.chunk.document_name,
        "| type =",
        matched_hit.chunk.document_type,
        flush=True,
    )


def debug_selected_hits(
    title: str,
    hits: list[RetrievalHit],
) -> None:
    """Print final chunks selected as evidence."""

    if not DEBUG_EVIDENCE:
        return

    print(
        f"\n===== {title} =====",
        flush=True,
    )

    for hit in hits:
        print(
            "chunk_id =",
            hit.chunk_id,
            "| document =",
            hit.chunk.document_name,
            "| type =",
            hit.chunk.document_type,
            flush=True,
        )

# =============================================================================
# Query-type helpers
# =============================================================================

def asks_for_numeric_fact(
    normalized_query: str,
    route: RouteLike,
) -> bool:
    """Check whether the user is asking for a numeric fact."""

    numeric_terms = (
        "how many",
        "how much",
        "minimum",
        "maximum",
        "number",
        "duration",
        "hour",
        "hours",
        "week",
        "weeks",
        "credit",
        "credits",
        "gpa",
        "bao nhieu",
        "toi thieu",
        "toi da",
        "so gio",
        "tin chi",
    )

    return (
        route.intent
        in {
            "internship_duration",
            "internship_credit",
            "internship_eligibility",
        }
        or any(
            term in normalized_query
            for term in numeric_terms
        )
    )


def numeric_context_terms(
    normalized_query: str,
    route: RouteLike,
) -> list[str]:
    """Return context words that should accompany numeric evidence."""

    if (
        route.intent
        == "internship_duration"
        or any(
            term in normalized_query
            for term in (
                "hour",
                "hours",
                "week",
                "weeks",
                "duration",
                "so gio",
                "thoi luong",
            )
        )
    ):
        return [
            "hour",
            "hours",
            "week",
            "weeks",
            "duration",
        ]

    if (
        route.intent
        == "internship_credit"
        or "credit"
        in normalized_query
    ):
        return [
            "credit",
            "credits",
            "grading",
            "pass/fail",
            "pass fail",
        ]

    if (
        route.intent
        == "internship_eligibility"
        or "gpa"
        in normalized_query
    ):
        return [
            "gpa",
            "prerequisite",
            "requirement",
            "eligible",
        ]

    return []


def asks_for_deadline(
    normalized_query: str,
) -> bool:
    """Check whether the user asks for a deadline."""

    return any(
        term in normalized_query
        for term in (
            "deadline",
            "due date",
            "submission date",
            "han nop",
            "thoi han",
        )
    )


def asks_for_email(
    normalized_query: str,
) -> bool:
    """Check whether the user asks for an email address."""

    return (
        "email"
        in normalized_query
        or "e-mail"
        in normalized_query
    )


# =============================================================================
# Date helpers
# =============================================================================

def extract_dates(
    value: str,
) -> list[str]:
    """Extract supported date patterns from text."""

    dates = [
        *MONTH_YEAR_RE.findall(
            value
        ),
        *NUMERIC_DATE_RE.findall(
            value
        ),
        *YEAR_RE.findall(
            value
        ),
    ]

    return dedupe(
        dates
    )


# =============================================================================
# Generic helpers
# =============================================================================

def normalize_text(
    value: str,
) -> str:
    """Normalize text for matching, including Vietnamese diacritics."""

    normalized = unicodedata.normalize(
        "NFKD",
        value or "",
    )

    normalized = "".join(
        char
        for char in normalized
        if not unicodedata.combining(
            char
        )
    )

    normalized = (
        normalized
        .replace("đ", "d")
        .replace("Đ", "D")
        .lower()
    )

    return " ".join(
        normalized.split()
    )

def dedupe(
    values: list[str],
) -> list[str]:
    """Deduplicate values while preserving order."""

    seen: set[str] = set()
    result: list[str] = []

    for value in values:

        normalized = normalize_text(
            value
        )

        if (
            normalized
            and normalized not in seen
        ):
            seen.add(
                normalized
            )

            result.append(
                value
            )

    return result