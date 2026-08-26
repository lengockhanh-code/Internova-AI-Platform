from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.models.chat_history import (
    ChatHistoryDeleteResponse,
    ChatHistoryMessageCreateRequest,
    ChatHistoryMessageCreateResponse,
    ChatMessagesPageResponse,
    ChatSessionCreateRequest,
    ChatSessionDetailResponse,
    ChatSessionsResponse,
    ChatSessionSummary,
    ChatSessionUpdateRequest,
)
from src.security.auth import get_current_user
from src.services.chat_history_service import (
    create_chat_session,
    delete_chat_session,
    get_chat_messages_page,
    get_chat_session_detail,
    list_chat_sessions,
    save_chat_message,
    update_chat_session_title,
)
from src.services.chat_service import chat_service

router = APIRouter(
    prefix="/chat/history",
    tags=["Chat History"],
)




def _raise_history_error(exc: Exception) -> None:
    if isinstance(exc, LookupError):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    if isinstance(exc, PermissionError):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(exc),
        ) from exc
    if isinstance(exc, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    raise exc


@router.get(
    "/sessions",
    response_model=ChatSessionsResponse,
)
def get_sessions(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ChatSessionsResponse:
    return ChatSessionsResponse(
        sessions=list_chat_sessions(
            db=db,
            user_id=int(current_user["id"]),
        )
    )


@router.post(
    "/sessions",
    response_model=ChatSessionSummary,
    status_code=status.HTTP_201_CREATED,
)
def create_session(
    payload: ChatSessionCreateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ChatSessionSummary:
    try:
        return ChatSessionSummary(
            **create_chat_session(
                db=db,
                user_id=int(current_user["id"]),
                session_id=payload.id,
                title=payload.title,
            )
        )
    except IntegrityError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Phiên trò chuyện đã tồn tại.",
        ) from exc
    except (LookupError, PermissionError, ValueError) as exc:
        _raise_history_error(exc)
        raise AssertionError("unreachable")


@router.get(
    "/sessions/{session_id}",
    response_model=ChatSessionDetailResponse,
)
def get_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ChatSessionDetailResponse:
    try:
        return ChatSessionDetailResponse(
            **get_chat_session_detail(
                db=db,
                user_id=int(current_user["id"]),
                session_id=session_id,
            )
        )
    except (LookupError, PermissionError, ValueError) as exc:
        _raise_history_error(exc)
        raise AssertionError("unreachable")


@router.patch(
    "/sessions/{session_id}",
    response_model=ChatSessionSummary,
)
def update_session(
    session_id: UUID,
    payload: ChatSessionUpdateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ChatSessionSummary:
    try:
        return ChatSessionSummary(
            **update_chat_session_title(
                db=db,
                user_id=int(current_user["id"]),
                session_id=session_id,
                title=payload.title,
            )
        )
    except (LookupError, PermissionError, ValueError) as exc:
        _raise_history_error(exc)
        raise AssertionError("unreachable")


@router.delete(
    "/sessions/{session_id}",
    response_model=ChatHistoryDeleteResponse,
)
def remove_session(
    session_id: UUID,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ChatHistoryDeleteResponse:
    try:
        deleted_id = delete_chat_session(
            db=db,
            user_id=int(current_user["id"]),
            session_id=session_id,
        )
        chat_service.forget_memory(str(deleted_id))
        return ChatHistoryDeleteResponse(
            session_id=deleted_id,
        )
    except (LookupError, PermissionError, ValueError) as exc:
        _raise_history_error(exc)
        raise AssertionError("unreachable")


@router.get(
    "/sessions/{session_id}/messages",
    response_model=ChatMessagesPageResponse,
)
def get_messages(
    session_id: UUID,
    limit: int = Query(default=10, ge=1, le=50),
    before: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ChatMessagesPageResponse:
    """Load chat history lazily: newest 10 first, then older pages by cursor."""
    try:
        return ChatMessagesPageResponse(
            **get_chat_messages_page(
                db=db,
                user_id=int(current_user["id"]),
                session_id=session_id,
                limit=limit,
                before=before,
            )
        )
    except (LookupError, PermissionError, ValueError) as exc:
        _raise_history_error(exc)
        raise AssertionError("unreachable")


@router.post(
    "/sessions/{session_id}/messages",
    response_model=ChatHistoryMessageCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_message(
    session_id: UUID,
    payload: ChatHistoryMessageCreateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
) -> ChatHistoryMessageCreateResponse:
    try:
        message_id = save_chat_message(
            db=db,
            user_id=int(current_user["id"]),
            session_id=session_id,
            payload=payload,
        )
        return ChatHistoryMessageCreateResponse(
            session_id=session_id,
            message_id=message_id,
        )
    except (LookupError, PermissionError, ValueError) as exc:
        _raise_history_error(exc)
        raise AssertionError("unreachable")
