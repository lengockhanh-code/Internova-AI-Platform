from __future__ import annotations

from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ChatHistoryBaseModel(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
    )


ChatHistoryRole = Literal[
    "USER",
    "ASSISTANT",
    "SYSTEM",
    "TOOL",
]


class ChatSessionCreateRequest(ChatHistoryBaseModel):
    id: UUID | None = None
    title: str | None = Field(
        default=None,
        max_length=255,
    )


class ChatSessionUpdateRequest(ChatHistoryBaseModel):
    title: str = Field(
        min_length=1,
        max_length=255,
    )


class ChatSessionSummary(ChatHistoryBaseModel):
    id: UUID
    title: str
    status: Literal["ACTIVE", "ARCHIVED"]
    message_count: int = Field(default=0, alias="messageCount")
    last_message_preview: str | None = Field(
        default=None,
        alias="lastMessagePreview",
    )
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")
    last_message_at: str = Field(alias="lastMessageAt")


class ChatSessionsResponse(ChatHistoryBaseModel):
    sessions: list[ChatSessionSummary] = Field(
        default_factory=list,
    )


class ChatHistoryMessage(ChatHistoryBaseModel):
    id: str
    role: Literal["user", "assistant"]
    content: str
    sources: list[dict[str, Any]] = Field(
        default_factory=list,
    )
    confidence: float | None = None
    needs_retrieval: bool = Field(
        default=False,
        alias="needsRetrieval",
    )
    status: str | None = None
    processing: dict[str, Any] = Field(
        default_factory=dict,
    )
    created_at: str = Field(alias="createdAt")

class ChatMessagesPageResponse(ChatHistoryBaseModel):
    messages: list[ChatHistoryMessage] = Field(
        default_factory=list,
    )
    next_cursor: str | None = Field(
        default=None,
        alias="nextCursor",
    )
    has_more: bool = Field(
        default=False,
        alias="hasMore",
    )
    
class ChatSessionDetailResponse(ChatHistoryBaseModel):
    session: ChatSessionSummary
    messages: list[ChatHistoryMessage] = Field(
        default_factory=list,
    )


class ChatHistoryMessageCreateRequest(ChatHistoryBaseModel):
    client_message_id: UUID | None = Field(
        default=None,
        alias="clientMessageId",
    )
    role: ChatHistoryRole
    content: str = Field(
        min_length=1,
        max_length=100000,
    )
    answer_status: str | None = Field(
        default=None,
        max_length=40,
        alias="answerStatus",
    )
    answer_language: Literal["vi", "en"] | None = Field(
        default=None,
        alias="answerLanguage",
    )
    confidence: float | None = Field(
        default=None,
        ge=0,
        le=1,
    )
    needs_retrieval: bool = Field(
        default=False,
        alias="needsRetrieval",
    )
    route_intent: str | None = Field(
        default=None,
        max_length=100,
        alias="routeIntent",
    )
    route_scope: str | None = Field(
        default=None,
        max_length=100,
        alias="routeScope",
    )
    sources: list[dict[str, Any]] = Field(
        default_factory=list,
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
    )


class ChatHistoryMessageCreateResponse(ChatHistoryBaseModel):
    session_id: UUID = Field(alias="sessionId")
    message_id: int = Field(alias="messageId")


class ChatHistoryDeleteResponse(ChatHistoryBaseModel):
    status: Literal["ok"] = "ok"
    session_id: UUID = Field(alias="sessionId")
