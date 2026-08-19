from __future__ import annotations

from typing import TypedDict


class AgentState(TypedDict, total=False):
    """State schema cho LangGraph agent.

    Mỗi node đọc và ghi vào state này.
    total=False cho phép tất cả fields là optional.
    """

    query: str
    context: str
    analysis: str
    response: str
    error: str
    metadata: dict
    normalized_query: str
    query_language: str
    intent: str
    scope: str
    allowed_document_types: list[str]
    blocked_document_types: list[str]
    route: dict
    expanded_query: dict
    search_queries: list[str]
    retrieval_hits: list
    reranked_hits: list
    evidence: dict
    generated_answer: dict
    groundedness: dict
    answer_status: str
    confidence: float
    sources: list
