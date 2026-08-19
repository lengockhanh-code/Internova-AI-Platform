"""RAG generation package."""

from src.rag.generation.answer_generator import (
    AnswerLanguage,
    CitationError,
    GeneratedAnswer,
    SourceCitation,
    build_citations,
    build_context,
    compose_extractive_answer,
    generate_answer_from_evidence,
    get_selected_chunk_ids,
    refusal_answer,
)

from src.rag.generation.validation import (
    GroundednessCheckResult,
    apply_groundedness_gate,
    check_groundedness,
    check_input,
    make_fallback_result,
)

__all__ = [
    "AnswerLanguage",
    "CitationError",
    "GeneratedAnswer",
    "SourceCitation",
    "build_citations",
    "build_context",
    "compose_extractive_answer",
    "generate_answer_from_evidence",
    "get_selected_chunk_ids",
    "refusal_answer",
    "GroundednessCheckResult",
    "apply_groundedness_gate",
    "check_groundedness",
    "check_input",
    "make_fallback_result",
]