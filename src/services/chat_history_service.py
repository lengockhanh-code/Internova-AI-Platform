from __future__ import annotations

import base64
import json
from datetime import datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.models.chat_history import (
    ChatHistoryMessageCreateRequest,
)

DEFAULT_CHAT_TITLE = "Cuộc trò chuyện mới"
DEFAULT_CHAT_MESSAGE_PAGE_SIZE = 10
MAX_CHAT_MESSAGE_PAGE_SIZE = 50


def _to_iso(value: datetime | None) -> str:
    return value.isoformat() if value is not None else ""


def _normalize_message_page_limit(limit: int | None) -> int:
    try:
        value = int(limit or DEFAULT_CHAT_MESSAGE_PAGE_SIZE)
    except (TypeError, ValueError):
        value = DEFAULT_CHAT_MESSAGE_PAGE_SIZE
    return max(1, min(MAX_CHAT_MESSAGE_PAGE_SIZE, value))


def _encode_message_cursor(
    created_at: datetime,
    message_id: int,
) -> str:
    payload = {
        "created_at": created_at.isoformat(),
        "id": int(message_id),
    }
    raw = json.dumps(
        payload,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _decode_message_cursor(value: str) -> tuple[datetime, int]:
    token = (value or "").strip()
    if not token:
        raise ValueError("Cursor lịch sử trò chuyện không hợp lệ.")

    try:
        padding = "=" * (-len(token) % 4)
        raw = base64.urlsafe_b64decode((token + padding).encode("ascii"))
        payload = json.loads(raw.decode("utf-8"))

        created_at_raw = str(payload["created_at"])
        message_id = int(payload["id"])
        created_at = datetime.fromisoformat(created_at_raw)

        if message_id <= 0:
            raise ValueError
    except Exception as exc:
        raise ValueError("Cursor lịch sử trò chuyện không hợp lệ.") from exc

    return created_at, message_id


def _session_uuid(value: UUID | str | None) -> UUID:
    if value is None:
        return uuid4()

    try:
        return value if isinstance(value, UUID) else UUID(str(value))
    except (TypeError, ValueError) as exc:
        raise ValueError("Mã phiên trò chuyện không hợp lệ.") from exc


def _clean_title(value: str | None) -> str:
    title = " ".join((value or "").strip().split())
    return title[:255] or DEFAULT_CHAT_TITLE


def _title_from_message(message: str) -> str:
    normalized = " ".join(message.strip().split())
    if len(normalized) <= 72:
        return normalized or DEFAULT_CHAT_TITLE
    return f"{normalized[:69].rstrip()}..."


def _require_owned_session(
    db: Session,
    user_id: int,
    session_id: UUID | str,
) -> dict[str, Any]:
    parsed_id = _session_uuid(session_id)
    row = db.execute(
        text(
            """
            SELECT
                id,
                user_id,
                title,
                status,
                created_at,
                updated_at,
                last_message_at
            FROM public.chat_sessions
            WHERE id = :session_id
              AND user_id = :user_id
            """
        ),
        {
            "session_id": parsed_id,
            "user_id": user_id,
        },
    ).mappings().first()

    if row is None:
        raise LookupError("Không tìm thấy cuộc trò chuyện.")

    return dict(row)


def ensure_chat_session(
    db: Session,
    user_id: int,
    session_id: UUID | str | None,
    first_message: str,
) -> UUID:
    parsed_id = _session_uuid(session_id)

    existing_owner = db.execute(
        text(
            """
            SELECT user_id
            FROM public.chat_sessions
            WHERE id = :session_id
            """
        ),
        {"session_id": parsed_id},
    ).scalar_one_or_none()

    if existing_owner is not None:
        if int(existing_owner) != int(user_id):
            raise PermissionError(
                "Bạn không có quyền truy cập cuộc trò chuyện này."
            )
        return parsed_id

    db.execute(
        text(
            """
            INSERT INTO public.chat_sessions (
                id,
                user_id,
                title
            )
            VALUES (
                :session_id,
                :user_id,
                :title
            )
            """
        ),
        {
            "session_id": parsed_id,
            "user_id": user_id,
            "title": _title_from_message(first_message),
        },
    )
    db.commit()
    return parsed_id


def create_chat_session(
    db: Session,
    user_id: int,
    session_id: UUID | str | None = None,
    title: str | None = None,
) -> dict[str, Any]:
    parsed_id = _session_uuid(session_id)

    try:
        db.execute(
            text(
                """
                INSERT INTO public.chat_sessions (
                    id,
                    user_id,
                    title
                )
                VALUES (
                    :session_id,
                    :user_id,
                    :title
                )
                """
            ),
            {
                "session_id": parsed_id,
                "user_id": user_id,
                "title": _clean_title(title),
            },
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return get_chat_session_summary(
        db=db,
        user_id=user_id,
        session_id=parsed_id,
    )


def _map_session(row: Any) -> dict[str, Any]:
    return {
        "id": row["id"],
        "title": row["title"],
        "status": row["status"],
        "messageCount": int(row["message_count"] or 0),
        "lastMessagePreview": row["last_message_preview"],
        "createdAt": _to_iso(row["created_at"]),
        "updatedAt": _to_iso(row["updated_at"]),
        "lastMessageAt": _to_iso(row["last_message_at"]),
    }


def _session_summary_query() -> str:
    return """
        SELECT
            cs.id,
            cs.title,
            cs.status,
            cs.created_at,
            cs.updated_at,
            cs.last_message_at,
            COALESCE(message_stats.message_count, 0) AS message_count,
            latest_message.content AS last_message_preview
        FROM public.chat_sessions AS cs
        LEFT JOIN LATERAL (
            SELECT COUNT(*) AS message_count
            FROM public.chat_messages AS cm
            WHERE cm.session_id = cs.id
        ) AS message_stats ON TRUE
        LEFT JOIN LATERAL (
            SELECT LEFT(cm.content, 160) AS content
            FROM public.chat_messages AS cm
            WHERE cm.session_id = cs.id
            ORDER BY cm.created_at DESC, cm.id DESC
            LIMIT 1
        ) AS latest_message ON TRUE
    """


def list_chat_sessions(
    db: Session,
    user_id: int,
) -> list[dict[str, Any]]:
    rows = db.execute(
        text(
            _session_summary_query()
            + """
            WHERE cs.user_id = :user_id
              AND cs.status = 'ACTIVE'
            ORDER BY cs.last_message_at DESC, cs.created_at DESC
            """
        ),
        {"user_id": user_id},
    ).mappings().all()
    return [_map_session(row) for row in rows]


def get_chat_session_summary(
    db: Session,
    user_id: int,
    session_id: UUID | str,
) -> dict[str, Any]:
    parsed_id = _session_uuid(session_id)
    row = db.execute(
        text(
            _session_summary_query()
            + """
            WHERE cs.id = :session_id
              AND cs.user_id = :user_id
            """
        ),
        {
            "session_id": parsed_id,
            "user_id": user_id,
        },
    ).mappings().first()
    if row is None:
        raise LookupError("Không tìm thấy cuộc trò chuyện.")
    return _map_session(row)


def get_chat_messages(
    db: Session,
    user_id: int,
    session_id: UUID | str,
) -> list[dict[str, Any]]:
    owned = _require_owned_session(
        db=db,
        user_id=user_id,
        session_id=session_id,
    )
    rows = db.execute(
        text(
            """
            SELECT
                id,
                client_message_id,
                role,
                content,
                answer_status,
                confidence,
                needs_retrieval,
                sources,
                metadata,
                created_at
            FROM public.chat_messages
            WHERE session_id = :session_id
              AND role IN ('USER', 'ASSISTANT')
            ORDER BY created_at ASC, id ASC
            """
        ),
        {"session_id": owned["id"]},
    ).mappings().all()

    messages: list[dict[str, Any]] = []
    for row in rows:
        sources = row["sources"]
        if isinstance(sources, str):
            sources = json.loads(sources)
        metadata = row["metadata"] or {}
        if isinstance(metadata, str):
            metadata = json.loads(metadata)
        messages.append(
            {
                "id": str(row["client_message_id"] or f"db-{row['id']}"),
                "role": str(row["role"]).lower(),
                "content": row["content"],
                "sources": sources or [],
                "confidence": (
                    float(row["confidence"])
                    if row["confidence"] is not None
                    else None
                ),
                "needsRetrieval": bool(row["needs_retrieval"]),
                "status": row["answer_status"],
                "processing": metadata.get("processing", {}),
                "createdAt": _to_iso(row["created_at"]),
            }
        )
    return messages


def get_chat_messages_page(
    db: Session,
    user_id: int,
    session_id: UUID | str,
    limit: int = DEFAULT_CHAT_MESSAGE_PAGE_SIZE,
    before: str | None = None,
) -> dict[str, Any]:
    """Return one cursor-paginated page of chat messages.

    The first call returns the newest messages. Passing ``before`` returns
    messages older than the oldest message from the previous page.

    Rows are queried newest-first for efficient pagination, then reversed
    before returning so the frontend receives chronological order.
    """
    owned = _require_owned_session(
        db=db,
        user_id=user_id,
        session_id=session_id,
    )
    page_size = _normalize_message_page_limit(limit)

    cursor_created_at: datetime | None = None
    cursor_id: int | None = None
    if before:
        cursor_created_at, cursor_id = _decode_message_cursor(before)

    where_before = ""
    params: dict[str, Any] = {
        "session_id": owned["id"],
        # Fetch one extra row so hasMore is known without COUNT(*).
        "fetch_limit": page_size + 1,
    }

    if cursor_created_at is not None and cursor_id is not None:
        where_before = """
              AND (
                    created_at < :cursor_created_at
                    OR (
                        created_at = :cursor_created_at
                        AND id < :cursor_id
                    )
              )
        """
        params["cursor_created_at"] = cursor_created_at
        params["cursor_id"] = cursor_id

    rows_desc = db.execute(
        text(
            f"""
            SELECT
                id,
                client_message_id,
                role,
                content,
                answer_status,
                confidence,
                needs_retrieval,
                sources,
                metadata,
                created_at
            FROM public.chat_messages
            WHERE session_id = :session_id
              AND role IN ('USER', 'ASSISTANT')
              {where_before}
            ORDER BY created_at DESC, id DESC
            LIMIT :fetch_limit
            """
        ),
        params,
    ).mappings().all()

    has_more = len(rows_desc) > page_size
    page_desc = rows_desc[:page_size]

    next_cursor: str | None = None
    if has_more and page_desc:
        oldest_loaded = page_desc[-1]
        next_cursor = _encode_message_cursor(
            created_at=oldest_loaded["created_at"],
            message_id=int(oldest_loaded["id"]),
        )

    messages: list[dict[str, Any]] = []
    for row in reversed(page_desc):
        sources = row["sources"]
        if isinstance(sources, str):
            sources = json.loads(sources)

        metadata = row["metadata"] or {}
        if isinstance(metadata, str):
            metadata = json.loads(metadata)

        messages.append(
            {
                "id": str(row["client_message_id"] or f"db-{row['id']}"),
                "role": str(row["role"]).lower(),
                "content": row["content"],
                "sources": sources or [],
                "confidence": (
                    float(row["confidence"])
                    if row["confidence"] is not None
                    else None
                ),
                "needsRetrieval": bool(row["needs_retrieval"]),
                "status": row["answer_status"],
                "processing": metadata.get("processing", {}),
                "createdAt": _to_iso(row["created_at"]),
            }
        )

    return {
        "messages": messages,
        "nextCursor": next_cursor,
        "hasMore": has_more,
    }


def get_chat_session_detail(
    db: Session,
    user_id: int,
    session_id: UUID | str,
) -> dict[str, Any]:
    return {
        "session": get_chat_session_summary(
            db=db,
            user_id=user_id,
            session_id=session_id,
        ),
        "messages": get_chat_messages(
            db=db,
            user_id=user_id,
            session_id=session_id,
        ),
    }


def update_chat_session_title(
    db: Session,
    user_id: int,
    session_id: UUID | str,
    title: str,
) -> dict[str, Any]:
    parsed_id = _session_uuid(session_id)
    updated = db.execute(
        text(
            """
            UPDATE public.chat_sessions
            SET title = :title
            WHERE id = :session_id
              AND user_id = :user_id
            RETURNING id
            """
        ),
        {
            "title": _clean_title(title),
            "session_id": parsed_id,
            "user_id": user_id,
        },
    ).scalar_one_or_none()
    if updated is None:
        db.rollback()
        raise LookupError("Không tìm thấy cuộc trò chuyện.")
    db.commit()
    return get_chat_session_summary(db, user_id, parsed_id)


def delete_chat_session(
    db: Session,
    user_id: int,
    session_id: UUID | str,
) -> UUID:
    parsed_id = _session_uuid(session_id)
    deleted = db.execute(
        text(
            """
            DELETE FROM public.chat_sessions
            WHERE id = :session_id
              AND user_id = :user_id
            RETURNING id
            """
        ),
        {
            "session_id": parsed_id,
            "user_id": user_id,
        },
    ).scalar_one_or_none()
    if deleted is None:
        db.rollback()
        raise LookupError("Không tìm thấy cuộc trò chuyện.")
    db.commit()
    return deleted


def save_chat_message(
    db: Session,
    user_id: int,
    session_id: UUID | str,
    payload: ChatHistoryMessageCreateRequest,
) -> int:
    owned = _require_owned_session(db, user_id, session_id)
    params = {
        "session_id": owned["id"],
        "client_message_id": payload.client_message_id,
        "role": payload.role,
        "content": payload.content.strip(),
        "answer_status": payload.answer_status,
        "answer_language": payload.answer_language,
        "confidence": payload.confidence,
        "needs_retrieval": payload.needs_retrieval,
        "route_intent": payload.route_intent,
        "route_scope": payload.route_scope,
        "sources": json.dumps(payload.sources, ensure_ascii=False),
        "metadata": json.dumps(payload.metadata, ensure_ascii=False),
    }

    try:
        message_id = db.execute(
            text(
                """
                INSERT INTO public.chat_messages (
                    session_id,
                    client_message_id,
                    role,
                    content,
                    answer_status,
                    answer_language,
                    confidence,
                    needs_retrieval,
                    route_intent,
                    route_scope,
                    sources,
                    metadata
                )
                VALUES (
                    :session_id,
                    :client_message_id,
                    :role,
                    :content,
                    :answer_status,
                    :answer_language,
                    :confidence,
                    :needs_retrieval,
                    :route_intent,
                    :route_scope,
                    CAST(:sources AS JSONB),
                    CAST(:metadata AS JSONB)
                )
                ON CONFLICT (session_id, client_message_id)
                DO NOTHING
                RETURNING id
                """
            ),
            params,
        ).scalar_one_or_none()

        if message_id is None and payload.client_message_id is not None:
            message_id = db.execute(
                text(
                    """
                    SELECT id
                    FROM public.chat_messages
                    WHERE session_id = :session_id
                      AND client_message_id = :client_message_id
                    """
                ),
                params,
            ).scalar_one()

        db.commit()
        return int(message_id)
    except Exception:
        db.rollback()
        raise


def get_recent_chat_turns(
    db: Session,
    user_id: int,
    session_id: UUID | str,
    limit: int = 8,
) -> list[tuple[str, str, str]]:
    owned = _require_owned_session(db, user_id, session_id)
    rows = db.execute(
        text(
            """
            SELECT role, content, answer_status
            FROM (
                SELECT id, role, content, answer_status, created_at
                FROM public.chat_messages
                WHERE session_id = :session_id
                  AND role IN ('USER', 'ASSISTANT')
                ORDER BY created_at DESC, id DESC
                LIMIT :message_limit
            ) AS recent_messages
            ORDER BY created_at ASC, id ASC
            """
        ),
        {
            "session_id": owned["id"],
            "message_limit": max(2, limit * 2 + 2),
        },
    ).mappings().all()

    turns: list[tuple[str, str, str]] = []
    pending_query: str | None = None
    for row in rows:
        if row["role"] == "USER":
            pending_query = row["content"]
        elif row["role"] == "ASSISTANT" and pending_query is not None:
            turns.append(
                (
                    pending_query,
                    row["content"],
                    row["answer_status"] or "answered",
                )
            )
            pending_query = None
    return turns[-limit:]
