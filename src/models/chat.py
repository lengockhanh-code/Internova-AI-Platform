from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


AnswerStatus = Literal[
    "answered",
    "not_found",
    "insufficient_evidence",
    "out_of_scope",
]

AnswerLanguage = Literal[
    "vi",
    "en",
]


class ChatRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        max_length=5000,
    )

    session_id: str | None = Field(
        default=None,
        max_length=200,
    )


class ChatSource(BaseModel):
    document_name: str | None = None
    document_type: str | None = None

    page: int | None = None
    section: str | None = None
    subsection: str | None = None

    chunk_id: str | None = None
    quote_original: str | None = None

    # Dùng cho file biểu mẫu.
    # Source không phải form có thể để None.
    file_name: str | None = None
    preview_url: str | None = None
    download_url: str | None = None

    metadata: dict[str, Any] | None = None


class ChatResultResponse(BaseModel):
    answer_status: AnswerStatus

    answer: str

    answer_language: AnswerLanguage = "vi"

    # Chỉ có giá trị khi needs_retrieval=True.
    confidence: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
    )

    needs_retrieval: bool = False

    route_intent: str | None = None
    route_scope: str | None = None

    sources: list[ChatSource] = Field(
        default_factory=list,
    )


class ChatResponse(BaseModel):
    response: str

    session_id: str | None = None

    result: ChatResultResponse