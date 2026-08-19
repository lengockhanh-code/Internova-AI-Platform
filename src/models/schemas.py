from typing import Literal

from pydantic import BaseModel, Field, field_validator


AnswerStatus = Literal["answered", "not_found", "insufficient_evidence", "out_of_scope"]


class SourceCitationResponse(BaseModel):
    document_name: str
    document_type: str
    page: int | None = None
    section: str | None = None
    chunk_id: str
    quote_original: str


class ChatResult(BaseModel):
    answer_status: AnswerStatus
    answer: str
    answer_language: str = "vi"
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    sources: list[SourceCitationResponse] = Field(default_factory=list)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="User message")

    @field_validator("message")
    @classmethod
    def trim_and_validate_message(cls, value: str) -> str:
        trimmed = " ".join(value.strip().split())
        if not trimmed:
            raise ValueError("message must not be empty")

        lowered = trimmed.lower()
        blocked_fragments = (
            "openai_api_key",
            "api_key",
            ".env",
            "data/chroma",
            "data/rag",
            "system prompt",
        )
        if any(fragment in lowered for fragment in blocked_fragments):
            raise ValueError("message contains unsupported control input")
        return trimmed


class ChatResponse(BaseModel):
    response: str = Field(..., description="Agent response")
    analysis: str = Field(default="", description="Internal analysis placeholder")
    result: ChatResult | None = Field(default=None, description="Structured RAG result")
