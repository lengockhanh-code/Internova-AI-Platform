from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class DocumentChunk(BaseModel):
    chunk_id: str
    document_name: str
    document_type: str
    source_priority: int

    content_original: str
    content_vi: str | None = None
    language: str = "en"

    page: int | None = None
    section: str | None = None
    subsection: str | None = None
    topic: str | None = None

    policy_version: str | None = None
    effective_date: str | None = None

    # Metadata enrichment fields
    ingested_at: str | None = None
    file_hash: str | None = None
    created_date: str | None = None
    file_size_bytes: int | None = None

    source_element_ids: list[str] = Field(default_factory=list)


class ChunkBuildReport(BaseModel):
    documents_seen: int
    documents_chunked: int
    chunks_created: int
    skipped_documents: list[dict[str, str]] = Field(default_factory=list)
    manual_checks: dict[str, list[dict]] = Field(default_factory=dict)


AnswerStatus = Literal[
    "answered",
    "not_found",
    "insufficient_evidence",
    "out_of_scope",
]


class IngestionReport(BaseModel):
    documents_seen: int
    documents_loaded: int
    documents_cleaned: int
    chunks_created: int
    chunks_enriched: int
    skipped_documents: list[dict] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    duration_seconds: float = 0.0
    built_at: str = ""


class QueryResult(BaseModel):
    query: str
    answer: str
    answer_status: AnswerStatus
    answer_language: str = "vi"
    confidence: float = 0.0
    sources: list[dict] = Field(default_factory=list)
    # Debug / pipeline trace
    route_intent: str = ""
    route_scope: str = ""
    guardrail_passed: bool = True
    guardrail_reason: str = ""
    cache_hit: bool = False
    vector_hits: list[dict] = Field(default_factory=list)
    bm25_hits: list[dict] = Field(default_factory=list)
    reranked_hits: list[dict] = Field(default_factory=list)
    groundedness_status: str = ""
    groundedness_reason: str = ""
    latency_ms: float = 0.0
