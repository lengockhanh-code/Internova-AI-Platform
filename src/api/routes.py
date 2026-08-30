from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
import time
import unicodedata
from contextlib import suppress
from datetime import date, datetime, timezone
from threading import Event
from typing import Any, Literal
from uuid import uuid4

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from fastapi.responses import (
    StreamingResponse,
)
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.concurrency import (
    run_in_threadpool,
)

# FIX: additive-only import — form_agent's own bridge module. See
# src/agents/form_agent/bridge.py for the full rationale. Nothing else
# in this file changes; this only adds a short guard clause near the
# top of chat() and chat_stream() (search "FORM AGENT DISPATCH" below).
# try_dispatch() covers BOTH "already mid form-filling" and "student
# just said yes to a prior suggestion" — no other frontend call needed
# to trigger it besides the existing /form-agent/detect call.
from src.agents.form_agent.bridge import try_dispatch as _form_agent_try_dispatch
from src.config import get_settings
from src.database.connection import (
    get_db,
)
from src.models.chat import (
    ChatRequest,
    ChatResponse,
    ChatResultResponse,
)
from src.models.chat_history import (
    ChatHistoryMessageCreateRequest,
)
from src.rag.generation.answer_generator import StreamingCancelled
from src.rag.query_pipeline import RouteDecision
from src.security.auth import (
    get_current_user,
)
from src.services.chat_history_service import (
    ensure_chat_session,
    get_recent_chat_turns,
    save_chat_message,
)
from src.services.chat_service import (
    chat_service,
)
from src.services.internship_copilot_service import (
    handle_internship_copilot_action,
    make_copilot_confirmation_result,
    preview_internship_copilot_action,
)
from src.services.notification_service import (
    cancel_reminder,
    deliver_due_calendar_reminders,
    generate_smart_deadline_notifications,
    get_pending_reminders,
)
from src.services.redis_cache_service import (
    redis_cache,
)
from src.services.student_personal_chat_service import (
    answer_student_personal_question,
)

logger = logging.getLogger(
    __name__
)

router = APIRouter()


RAG_SCOPES = {
    "rag",
    "internship",
    "career",
    "capstone",
}


CONFIRMABLE_COPILOT_ACTIONS = {
    "internship_progress",
    "weekly_reflection",
    "smart_notifications",
    "human_escalation",
    "grievance_assistant",
}

_PENDING_MARKER_RE = re.compile(
    r"<!--INTERNOVA_COPILOT_PENDING:([A-Za-z0-9_\-=]+)-->",
)
_RESOLVED_MARKER_RE = re.compile(
    r"<!--INTERNOVA_COPILOT_RESOLVED:([A-Za-z0-9_-]+):(executed|cancelled)-->",
)


def _turn_value(turn: Any, key: str, default: Any = None) -> Any:
    if isinstance(turn, dict):
        return turn.get(key, default)
    mapping = getattr(turn, "_mapping", None)
    if mapping is not None:
        try:
            return mapping.get(key, default)
        except Exception:
            pass
    return getattr(turn, key, default)


def _copilot_recent_user_context(
    turns: list[Any],
    *,
    current_message: str = "",
    max_user_turns: int = 6,
) -> str:
    """Return recent USER-authored facts for semantic write-payload extraction.

    Assistant text is intentionally excluded so a previous generated answer can
    never become an invented incident fact.
    """
    messages: list[str] = []
    for turn in reversed(turns or []):
        if str(_turn_value(turn, "role", "") or "").upper() != "USER":
            continue
        content = " ".join(str(_turn_value(turn, "content", "") or "").split())
        if not content:
            continue
        messages.append(content)
        if len(messages) >= max_user_turns:
            break
    messages.reverse()
    # get_recent_chat_turns normally already contains the current persisted turn.
    # Add it only if it is not already the newest user message.
    current = " ".join((current_message or "").split())
    if current and (not messages or messages[-1] != current):
        messages.append(current)
    return "\n".join(f"User: {item}" for item in messages)


def _metadata_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return dict(value)
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def _encode_pending_marker(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    token = base64.urlsafe_b64encode(raw).decode("ascii")
    return f"<!--INTERNOVA_COPILOT_PENDING:{token}-->"


def _decode_pending_marker(content: str) -> dict[str, Any] | None:
    match = _PENDING_MARKER_RE.search(content or "")
    if not match:
        return None
    try:
        raw = base64.urlsafe_b64decode(match.group(1).encode("ascii"))
        payload = json.loads(raw.decode("utf-8"))
        return payload if isinstance(payload, dict) else None
    except Exception:
        return None


def _latest_pending_copilot_action(turns: list[Any]) -> dict[str, Any] | None:
    """Return the newest unresolved persisted preview from this chat session."""
    resolved_ids: set[str] = set()
    for turn in reversed(turns or []):
        role = str(_turn_value(turn, "role", "") or "").upper()
        if role != "ASSISTANT":
            continue

        metadata = _metadata_dict(_turn_value(turn, "metadata", {}))
        resolution = metadata.get("copilot_action_resolution")
        if isinstance(resolution, dict) and resolution.get("pending_id"):
            resolved_ids.add(str(resolution["pending_id"]))

        content = str(_turn_value(turn, "content", "") or "")
        for match in _RESOLVED_MARKER_RE.finditer(content):
            resolved_ids.add(match.group(1))

        pending = metadata.get("pending_copilot_action")
        if not isinstance(pending, dict):
            pending = _decode_pending_marker(content)
        if not isinstance(pending, dict):
            continue

        pending_id = str(pending.get("id") or "")
        if pending_id and pending_id not in resolved_ids:
            return pending
    return None



_COPILOT_PENDING_SHADOW_TTL_SECONDS = 7 * 24 * 60 * 60


def _pending_shadow_key_payload(
    *,
    user_id: int,
    session_id: str,
) -> dict[str, Any]:
    return {
        "user_id": int(user_id),
        "session_id": str(session_id),
        "schema_version": 1,
    }


def _resolved_pending_ids_from_turns(turns: list[Any]) -> set[str]:
    """Read persisted resolution metadata only; never inspect user wording."""
    resolved_ids: set[str] = set()
    for turn in turns or []:
        if str(_turn_value(turn, "role", "") or "").upper() != "ASSISTANT":
            continue

        metadata = _metadata_dict(_turn_value(turn, "metadata", {}))
        resolution = metadata.get("copilot_action_resolution")
        if isinstance(resolution, dict) and resolution.get("pending_id"):
            resolved_ids.add(str(resolution["pending_id"]))

        content = str(_turn_value(turn, "content", "") or "")
        for match in _RESOLVED_MARKER_RE.finditer(content):
            resolved_ids.add(match.group(1))

    return resolved_ids


def _load_pending_shadow(
    *,
    user_id: int,
    session_id: str,
    history_turns: list[Any],
) -> dict[str, Any] | None:
    """Load unresolved structured pending state without classifying user text."""
    cached = redis_cache.get_json(
        "copilot_pending_state",
        _pending_shadow_key_payload(
            user_id=user_id,
            session_id=session_id,
        ),
    )
    if not isinstance(cached, dict) or cached.get("status") != "pending":
        return None

    pending = cached.get("pending")
    if not isinstance(pending, dict):
        return None

    pending_id = str(pending.get("id") or "")
    if not pending_id:
        return None

    # Chat-history resolution is authoritative if present.
    if pending_id in _resolved_pending_ids_from_turns(history_turns):
        return None

    return pending


def _store_pending_shadow(
    *,
    user_id: int,
    session_id: str,
    pending: dict[str, Any],
) -> None:
    if not isinstance(pending, dict) or not pending.get("id"):
        return

    redis_cache.set_json(
        "copilot_pending_state",
        _pending_shadow_key_payload(
            user_id=user_id,
            session_id=session_id,
        ),
        {
            "status": "pending",
            "pending": pending,
        },
        _COPILOT_PENDING_SHADOW_TTL_SECONDS,
    )


def _resolve_pending_shadow(
    *,
    user_id: int,
    session_id: str,
    pending_id: str,
    status: str,
) -> None:
    """Mark the shadow non-pending; no language/intent interpretation occurs."""
    redis_cache.set_json(
        "copilot_pending_state",
        _pending_shadow_key_payload(
            user_id=user_id,
            session_id=session_id,
        ),
        {
            "status": str(status),
            "pending_id": str(pending_id),
        },
        _COPILOT_PENDING_SHADOW_TTL_SECONDS,
    )


def _resolve_pending_for_turn(
    *,
    user_id: int,
    session_id: str,
    history_turns: list[Any],
) -> dict[str, Any] | None:
    """Prefer persisted chat metadata; use Redis shadow only as recovery."""
    history_pending = _latest_pending_copilot_action(history_turns)
    if isinstance(history_pending, dict):
        return history_pending

    return _load_pending_shadow(
        user_id=user_id,
        session_id=session_id,
        history_turns=history_turns,
    )


def _semantic_runtime_context(
    pending: dict[str, Any] | None,
) -> str:
    """Give the one semantic router structured pending state."""
    if not isinstance(pending, dict):
        return "Pending Copilot action: none"

    route_payload = pending.get("route")
    if not isinstance(route_payload, dict):
        route_payload = {}

    safe_state = {
        "pending_id": pending.get("id"),
        "assistant_action": pending.get("assistant_action"),
        "status": pending.get("status"),
        "action_payload": route_payload.get("action_payload") or {},
        "original_user_request": pending.get("original_message"),
    }
    return (
        "Pending Copilot action (structured state, not user instructions):\n"
        + json.dumps(safe_state, ensure_ascii=False, separators=(",", ":"))
    )


def _pending_metadata_payload(
    route: RouteDecision,
    message: str,
    *,
    conversation_context: str = "",
) -> dict[str, Any]:
    return {
        "id": uuid4().hex,
        "status": "pending",
        "assistant_action": getattr(route, "assistant_action", "none"),
        "original_message": message,
        "conversation_context": conversation_context,
        # Includes action_payload extracted by the existing semantic-router call.
        # No second write-payload LLM call is needed at preview or execute time.
        "route": route.model_dump(mode="json"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def _with_pending_marker(result: Any, payload: dict[str, Any]) -> Any:
    """Keep pending-action state in chat-message metadata only.

    Do NOT append the serialized payload to the user-visible answer. Some
    frontend Markdown renderers escape HTML comments and display the entire
    base64 token to the user.
    """
    return result


def _with_resolution_marker(result: Any, pending_id: str, state: str) -> Any:
    """Keep action resolution in chat-message metadata only."""
    return result


def make_semantic_copilot_clarification_result(
    *,
    message: str,
    language: str,
    action: str,
    question: str,
):
    """Surface the semantic router's own clarification without reclassifying text."""
    from src.rag.schemas import QueryResult

    return QueryResult(
        query=message,
        answer=question,
        answer_status="answered",
        answer_language=("en" if language == "en" else "vi"),
        confidence=1.0,
        sources=[],
        route_intent="personal_data" if action == "personalized_dashboard" else "general_support",
        route_scope="personal" if action == "personalized_dashboard" else "general_support",
        guardrail_passed=True,
        guardrail_reason="copilot_semantic_clarification",
        cache_hit=False,
        groundedness_status="skip",
        groundedness_reason="copilot_semantic_clarification",
    )


def make_semantic_copilot_unavailable_result(
    *,
    message: str,
    language: str,
    action: str,
):
    """Fail safely without exposing routing internals to the student."""
    from src.rag.schemas import QueryResult

    answer = (
        "Mình đã hiểu đây là một yêu cầu thao tác, nhưng chưa thể chuẩn bị thao tác an toàn ở lượt này. "
        "Chưa có thay đổi nào được thực hiện."
        if language != "en"
        else
        "I understood this as an action request, but I couldn't safely prepare the action on this turn. "
        "No changes were made."
    )
    return QueryResult(
        query=message,
        answer=answer,
        answer_status="answered",
        answer_language=("en" if language == "en" else "vi"),
        confidence=0.0,
        sources=[],
        route_intent="general_support",
        route_scope="general_support",
        guardrail_passed=True,
        guardrail_reason="copilot_dispatch_unavailable",
        cache_hit=False,
        groundedness_status="skip",
        groundedness_reason="copilot_dispatch_unavailable",
    )


def _dispatch_copilot_confirmation_flow(
    *,
    db: Session,
    current_user: dict,
    message: str,
    route: RouteDecision,
    session_id: str,
    history_turns: list[Any],
    pending_override: dict[str, Any] | None = None,
):
    """Confirmation gate for every persistent Copilot write.

    Returns (result, extra_metadata, effective_action, effective_mode).
    The first write request can only preview. Execution requires a persisted
    unresolved preview from this same chat session.
    """
    pending = (
        pending_override
        if isinstance(pending_override, dict)
        else _resolve_pending_for_turn(
            user_id=int(current_user["id"]),
            session_id=session_id,
            history_turns=history_turns,
        )
    )
    action = getattr(route, "assistant_action", "none") or "none"
    mode = getattr(route, "action_mode", "inform") or "inform"
    language = (
        getattr(route, "response_language", None)
        if getattr(route, "response_language", None) in {"vi", "en"}
        else route.language
        if getattr(route, "language", None) in {"vi", "en"}
        else "vi"
    )
    data_source = getattr(route, "data_source", "none") or "none"
    transition = getattr(route, "pending_transition", "none") or "none"

    # No user text is inspected here. Reconcile only semantic fields produced by
    # the single router and persisted pending-action identity.
    if pending is not None:
        pending_action = str(pending.get("assistant_action") or "none")
        if transition == "confirm_pending":
            action = pending_action
            mode = "execute"
            data_source = "write_action"
        elif transition == "cancel_pending":
            action = pending_action
            mode = "cancel"
            data_source = "write_action"
        elif transition == "revise_pending":
            action = pending_action
            mode = "preview"
            data_source = "write_action"
    elif transition == "new_write" and data_source == "write_action":
        if action in CONFIRMABLE_COPILOT_ACTIONS:
            mode = "preview"

    # assistant_action is descriptive metadata. data_source is the authorization
    # family for DB/tool execution selected by the same semantic classifier.
    if data_source not in {"personal_db", "write_action"}:
        return None, None, action, mode

    if mode in {"preview", "execute", "cancel"} and data_source != "write_action":
        return None, None, action, "inform"

    conversation_context = _copilot_recent_user_context(
        history_turns, current_message=message
    )

    # IMPORTANT: the meaning of the CURRENT user message is decided by the
    # existing semantic router. Do not reinterpret it here with keyword/phrase
    # if/else rules. A pending preview is context, not a conversational lock.
    # The user may confirm, cancel, revise the draft, ask a question, or switch
    # topics; `route` already represents that current semantic intent.

    # Backend safety does NOT classify language. It only verifies that an
    # execute/cancel decision from the semantic router refers to the unresolved
    # pending action. If it does not, fail closed to normal inform behavior and
    # leave the pending draft untouched.
    if pending is not None and mode in {"execute", "cancel"}:
        pending_action = str(pending.get("assistant_action") or "none")
        if transition in {"confirm_pending", "cancel_pending"}:
            action = pending_action
        elif action != pending_action:
            mode = "inform"

    # Defense in depth: even if a stale router/cache labels a first write execute,
    # no write may happen without a prior persisted preview.
    if action in CONFIRMABLE_COPILOT_ACTIONS and mode == "execute" and pending is None:
        mode = "preview"

    if action in CONFIRMABLE_COPILOT_ACTIONS and mode == "preview":
        preview_route = route.model_copy(update={"action_mode": "preview"})
        result = preview_internship_copilot_action(
            db=db,
            current_user=current_user,
            message=message,
            route=preview_route,
            session_id=session_id,
            conversation_context=conversation_context,
        )
        if result is None:
            # A semantically selected persistent action must never be answered by
            # the normal RAG/general pipeline. Prefer the router's own semantic
            # clarification if one exists. This is a safety fallback, not intent
            # classification and not a keyword response template.
            clarification = str(
                getattr(route, "clarification_question", None) or ""
            ).strip()
            if clarification:
                result = make_semantic_copilot_clarification_result(
                    message=message,
                    language=language,
                    action=action,
                    question=clarification,
                )
                return result, None, action, "inform"
            return make_semantic_copilot_unavailable_result(
                message=message,
                language=language,
                action=action,
            ), None, action, "inform"

        if getattr(result, "guardrail_reason", "") == "copilot_clarification_required":
            return result, None, action, "inform"
        payload = _pending_metadata_payload(
            preview_route, message, conversation_context=conversation_context
        )
        result = _with_pending_marker(result, payload)
        metadata: dict[str, Any] = {"pending_copilot_action": payload}

        # Keep the unresolved draft available to the next semantic-router turn
        # even if a chat-history projection omits message metadata.
        _store_pending_shadow(
            user_id=int(current_user["id"]),
            session_id=session_id,
            pending=payload,
        )

        # A revised/new preview supersedes the older unresolved preview. Without
        # this, confirming the new draft and then saying "xác nhận" again could
        # accidentally execute the older stale draft.
        if pending is not None and pending.get("id"):
            metadata["copilot_action_resolution"] = {
                "pending_id": str(pending["id"]),
                "status": "superseded",
                "assistant_action": str(pending.get("assistant_action") or "none"),
            }
        return result, metadata, action, "preview"

    if mode == "cancel":
        if pending is None:
            result = make_copilot_confirmation_result(
                message, language, action=action, state="no_pending"
            )
            return result, None, action, "cancel"
        pending_id = str(pending.get("id") or "")
        pending_action = str(pending.get("assistant_action") or action or "none")
        result = make_copilot_confirmation_result(
            message, language, action=pending_action, state="cancelled"
        )
        result = _with_resolution_marker(result, pending_id, "cancelled")
        metadata = {
            "copilot_action_resolution": {
                "pending_id": pending_id,
                "status": "cancelled",
                "assistant_action": pending_action,
            }
        }
        _resolve_pending_shadow(
            user_id=int(current_user["id"]),
            session_id=session_id,
            pending_id=pending_id,
            status="cancelled",
        )
        return result, metadata, pending_action, "cancel"

    if mode == "execute":
        if pending is None:
            result = make_copilot_confirmation_result(
                message, language, action=action, state="no_pending"
            )
            return result, None, action, "execute"

        pending_id = str(pending.get("id") or "")
        pending_action = str(pending.get("assistant_action") or "none")
        original_message = str(pending.get("original_message") or "").strip()
        pending_context = str(pending.get("conversation_context") or "").strip()
        route_payload = pending.get("route")
        if not pending_id or not original_message or not isinstance(route_payload, dict):
            result = make_copilot_confirmation_result(
                message, language, action=pending_action, state="failed"
            )
            return result, None, pending_action, "execute"

        try:
            execute_route = RouteDecision.model_validate(route_payload).model_copy(
                update={
                    "assistant_action": pending_action,
                    "action_mode": "execute",
                    "needs_clarification": False,
                    "clarification_question": None,
                }
            )
        except Exception:
            result = make_copilot_confirmation_result(
                message, language, action=pending_action, state="failed"
            )
            return result, None, pending_action, "execute"

        result = handle_internship_copilot_action(
            db=db,
            current_user=current_user,
            message=original_message,
            route=execute_route,
            session_id=session_id,
            rag_lookup=lambda rag_query, rag_route: chat_service.ask(
                message=rag_query,
                session_id=None,
                user_id=get_observability_user_id(current_user),
                precomputed_route=rag_route,
            ),
            conversation_context=pending_context,
        )
        if result is None:
            result = make_copilot_confirmation_result(
                message, language, action=pending_action, state="failed"
            )
            return result, None, pending_action, "execute"

        result = _with_resolution_marker(result, pending_id, "executed")
        metadata = {
            "copilot_action_resolution": {
                "pending_id": pending_id,
                "status": "executed",
                "assistant_action": pending_action,
            }
        }
        _resolve_pending_shadow(
            user_id=int(current_user["id"]),
            session_id=session_id,
            pending_id=pending_id,
            status="executed",
        )
        return result, metadata, pending_action, "execute"

    # Read/inform path remains unchanged.
    result = handle_internship_copilot_action(
        db=db,
        current_user=current_user,
        message=message,
        route=route,
        session_id=session_id,
        rag_lookup=lambda rag_query, rag_route: chat_service.ask(
            message=rag_query,
            session_id=None,
            user_id=get_observability_user_id(current_user),
            precomputed_route=rag_route,
        ),
        conversation_context=conversation_context,
    )
    return result, None, action, mode




# =============================================================================
# Security / rate limiting
# =============================================================================


def enforce_chat_rate_limit(
    current_user: dict,
) -> None:
    """
    Shared per-user chat rate limit
    across Gunicorn workers.
    """

    settings = get_settings()

    if (
        not settings
        .chat_rate_limit_enabled
    ):
        return

    subject = str(
        current_user.get("id")
        or current_user.get("email")
        or "unknown"
    )

    decision = (
        redis_cache
        .check_rate_limit(
            subject=subject,
            limit=(
                settings
                .chat_rate_limit_per_minute
            ),
            window_seconds=60,
        )
    )

    if decision.allowed:
        return

    raise HTTPException(
        status_code=429,
        detail=(
            "Bạn đang gửi yêu cầu quá nhanh. "
            "Vui lòng thử lại sau ít giây. / "
            "Too many requests. "
            "Please try again shortly."
        ),
        headers={
            "Retry-After":
                str(
                    decision
                    .retry_after_seconds
                )
        },
    )


def enforce_admin(
    current_user: dict,
) -> None:

    if (
        str(
            current_user.get(
                "role"
            )
            or ""
        ).upper()
        != "ADMIN"
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Bạn không có quyền "
                "thực hiện thao tác này."
            ),
        )


def get_observability_user_id(current_user: dict) -> str | None:
    """Stable correlation ID for Langfuse; never expose auth tokens/secrets."""
    value = (
        current_user.get("id")
        or current_user.get("user_id")
        or current_user.get("email")
    )
    return str(value) if value is not None else None


# =============================================================================
# Input
# =============================================================================


def normalize_message(
    message: str | None,
) -> str:

    normalized = (
        message
        or ""
    ).strip()

    if not normalized:
        raise HTTPException(
            status_code=400,
            detail=(
                "Câu hỏi không được "
                "để trống."
            ),
        )

    return normalized


# =============================================================================
# Response conversion
# =============================================================================


def safe_float(
    value: Any,
) -> float:

    try:
        number = float(
            value
            or 0.0
        )

    except (
        TypeError,
        ValueError,
    ):
        return 0.0

    return max(
        0.0,
        min(
            1.0,
            number,
        ),
    )


def normalize_sources(
    sources: Any,
) -> list[dict]:

    if not sources:
        return []

    normalized: list[
        dict
    ] = []

    for source in sources:

        if isinstance(
            source,
            dict,
        ):
            normalized.append(
                dict(source)
            )
            continue

        if hasattr(
            source,
            "model_dump",
        ):
            normalized.append(
                source.model_dump()
            )
            continue

        if hasattr(
            source,
            "dict",
        ):
            normalized.append(
                source.dict()
            )
            continue

        normalized.append(
            {
                "document_name":
                    getattr(
                        source,
                        "document_name",
                        None,
                    ),

                "document_type":
                    getattr(
                        source,
                        "document_type",
                        None,
                    ),

                "page":
                    getattr(
                        source,
                        "page",
                        None,
                    ),

                "section":
                    getattr(
                        source,
                        "section",
                        None,
                    ),

                "subsection":
                    getattr(
                        source,
                        "subsection",
                        None,
                    ),

                "chunk_id":
                    getattr(
                        source,
                        "chunk_id",
                        None,
                    ),

                "quote_original":
                    getattr(
                        source,
                        "quote_original",
                        None,
                    ),

                "file_name":
                    getattr(
                        source,
                        "file_name",
                        None,
                    ),

                "preview_url":
                    getattr(
                        source,
                        "preview_url",
                        None,
                    ),

                "download_url":
                    getattr(
                        source,
                        "download_url",
                        None,
                    ),

                "metadata":
                    getattr(
                        source,
                        "metadata",
                        None,
                    ),
            }
        )

    return normalized


def build_chat_result(
    result: Any,
) -> ChatResultResponse:

    route_intent = getattr(
        result,
        "route_intent",
        None,
    )

    route_scope = getattr(
        result,
        "route_scope",
        None,
    )

    needs_retrieval = (
        route_scope
        in RAG_SCOPES
    )

    confidence = (
        safe_float(
            getattr(
                result,
                "confidence",
                0.0,
            )
        )
        if needs_retrieval
        else None
    )

    sources = (
        normalize_sources(
            getattr(
                result,
                "sources",
                None,
            )
        )
        if needs_retrieval
        else []
    )

    return ChatResultResponse(
        answer_status=getattr(
            result,
            "answer_status",
            "insufficient_evidence",
        ),

        answer=(
            getattr(
                result,
                "answer",
                "",
            )
            or ""
        ),

        answer_language=(
            getattr(
                result,
                "answer_language",
                "vi",
            )
            or "vi"
        ),

        confidence=confidence,

        needs_retrieval=(
            needs_retrieval
        ),

        route_intent=(
            route_intent
        ),

        route_scope=(
            route_scope
        ),

        sources=sources,
    )


# =============================================================================
# FORM AGENT DISPATCH (additive — see src/agents/form_agent/bridge.py)
# =============================================================================
#
# Builds a ChatResultResponse-shaped payload from a form_agent turn, so
# the response going back to the frontend has the EXACT SAME SHAPE as a
# normal RAG answer (ChatResponse/ChatResultResponse) — no frontend
# changes needed to render it. route_intent/route_scope are set to
# "form_agent" so the frontend can tell the two apart if it ever needs
# to (e.g. to avoid showing a citations/confidence block for these).
#
# Nothing here reads from or writes to chat_service, query_pipeline, or
# any other RAG file — it only shapes the dict that bridge.run_turn()
# already returns.


def _build_form_agent_chat_response(
    session_id: str | None,
    form_result: dict,
) -> ChatResponse:

    display_text = (
        form_result.get("ask_message")
        or form_result.get("review_summary_markdown")
        or form_result.get("error")
        or ""
    )

    structured_result = ChatResultResponse(
        answer_status="answered" if not form_result.get("error") else "insufficient_evidence",
        answer=display_text,
        answer_language="vi",
        confidence=None,
        needs_retrieval=False,
        route_intent="form_agent",
        route_scope="form_agent",
        sources=[],
    )

    return ChatResponse(
        response=display_text,
        session_id=session_id,
        result=structured_result,
    )


# =============================================================================
# Streaming helpers
# =============================================================================


def serialize_stream_event(
    payload: dict[
        str,
        Any,
    ],
) -> str:

    return (
        json.dumps(
            payload,
            ensure_ascii=False,
        )
        + "\n"
    )


def prepare_persisted_chat_turn(
    db: Session,
    current_user: dict,
    request: ChatRequest,
    message: str,
) -> str:
    user_id = int(current_user["id"])
    session_id = ensure_chat_session(
        db=db,
        user_id=user_id,
        session_id=request.session_id,
        first_message=message,
    )
    turns = get_recent_chat_turns(
        db=db,
        user_id=user_id,
        session_id=session_id,
    )
    chat_service.restore_memory(
        session_id=str(session_id),
        turns=turns,
    )
    save_chat_message(
        db=db,
        user_id=user_id,
        session_id=session_id,
        payload=ChatHistoryMessageCreateRequest(
            client_message_id=request.client_message_id,
            role="USER",
            content=message,
        ),
    )
    return str(session_id)


def build_processing_summary(
    result: ChatResultResponse,
    latency_ms: float | None = None,
) -> dict[str, Any]:
    """Return a safe operational trace without exposing model chain-of-thought."""
    settings = get_settings()
    chat_model = settings.openai_chat_model or settings.model_name
    scope = result.route_scope or "unknown"
    steps: list[dict[str, Any]] = [
        {
            "id": "safety",
            "status": "completed",
            "engine": "Internova Guardrails",
            "model": None,
            "detail": "input_safe",
            "metrics": {},
        },
        {
            "id": "routing",
            "status": "completed",
            "engine": "Semantic Router",
            "model": chat_model,
            "detail": "route_selected",
            "metrics": {
                "intent": result.route_intent,
                "scope": scope,
            },
        },
    ]

    if scope in RAG_SCOPES or result.needs_retrieval:
        steps.extend(
            [
                {
                    "id": "query_planning",
                    "status": "completed",
                    "engine": "RAG Query Planner",
                    "model": chat_model,
                    "detail": "search_plan_ready",
                    "metrics": {},
                },
                {
                    "id": "retrieval",
                    "status": "completed",
                    "engine": "Hybrid Search (Vector + BM25)",
                    "model": settings.openai_embedding_model,
                    "detail": "knowledge_matches_found",
                    "metrics": {"references": len(result.sources)},
                    "references": [
                        source.model_dump()
                        for source in result.sources[:5]
                    ],
                },
                {
                    "id": "reranking",
                    "status": "completed",
                    "engine": "Local Relevance Ranker",
                    "model": None,
                    "detail": "relevant_passages_selected",
                    "metrics": {},
                },
                {
                    "id": "evidence",
                    "status": "completed",
                    "engine": "Evidence Validator",
                    "model": chat_model,
                    "detail": "source_support_checked",
                    "metrics": {"references": len(result.sources)},
                },
            ]
        )
    elif scope == "personal_student":
        steps.append(
            {
                "id": "personal_data",
                "status": "completed",
                "engine": "Authorized PostgreSQL Query",
                "model": None,
                "detail": "personal_data_checked",
                "metrics": {},
            }
        )
    elif scope == "form_agent":
        steps.append(
            {
                "id": "form_agent",
                "status": "completed",
                "engine": "Internova Form Agent",
                "model": chat_model,
                "detail": "form_request_processed",
                "metrics": {},
            }
        )

    if scope != "form_agent":
        steps.append(
            {
                "id": "generation",
                "status": "completed",
                "engine": "Answer Generator",
                "model": chat_model,
                "detail": "draft_answer_ready",
                "metrics": {},
            }
        )

    if scope in RAG_SCOPES or result.needs_retrieval:
        steps.append(
            {
                "id": "verification",
                "status": "completed",
                "engine": "Groundedness Checker",
                "model": chat_model,
                "detail": "answer_verification_complete",
                "metrics": {
                    "answer_status": result.answer_status,
                    "confidence": result.confidence,
                },
            }
        )

    return {
        "provider": "OpenAI",
        "responseModel": chat_model,
        "embeddingModel": (
            settings.openai_embedding_model
            if result.needs_retrieval
            else None
        ),
        "routeIntent": result.route_intent,
        "routeScope": scope,
        "latencyMs": latency_ms,
        "steps": steps,
    }


def persist_assistant_chat_message(
    db: Session,
    current_user: dict,
    request: ChatRequest,
    session_id: str,
    result: ChatResultResponse,
    latency_ms: float | None = None,
    extra_metadata: dict[str, Any] | None = None,
) -> None:
    metadata: dict[str, Any] = {}
    if latency_ms is not None:
        metadata["response_time_ms"] = latency_ms
    metadata["processing"] = build_processing_summary(
        result=result,
        latency_ms=latency_ms,
    )
    if extra_metadata:
        metadata.update(extra_metadata)

    save_chat_message(
        db=db,
        user_id=int(current_user["id"]),
        session_id=session_id,
        payload=ChatHistoryMessageCreateRequest(
            client_message_id=request.assistant_message_id,
            role="ASSISTANT",
            content=result.answer,
            answer_status=result.answer_status,
            answer_language=result.answer_language,
            confidence=result.confidence,
            needs_retrieval=result.needs_retrieval,
            route_intent=result.route_intent,
            route_scope=result.route_scope,
            sources=[source.model_dump() for source in result.sources],
            metadata=metadata,
        ),
    )


# =============================================================================
# Route debug endpoint
# =============================================================================


@router.post(
    "/chat/route"
)
async def classify_chat_route(
    request: ChatRequest,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
):
    message = (
        normalize_message(
            request.message
        )
    )

    # Redis operation is synchronous.
    # Run outside FastAPI event loop.
    await run_in_threadpool(
        enforce_chat_rate_limit,
        current_user,
    )

    try:
        # Debug uses the same pending structured state as /chat and /chat/stream.
        debug_session_id = request.session_id
        debug_runtime_context = ""
        if debug_session_id:
            debug_turns = await run_in_threadpool(
                lambda: get_recent_chat_turns(
                    db=db,
                    user_id=int(current_user["id"]),
                    session_id=str(debug_session_id),
                )
            )
            debug_pending = _resolve_pending_for_turn(
                user_id=int(current_user["id"]),
                session_id=str(debug_session_id),
                history_turns=list(debug_turns or []),
            )
            debug_runtime_context = _semantic_runtime_context(debug_pending)

        route_decision = await run_in_threadpool(
            chat_service.prepare_route,
            message,
            request.session_id,
            debug_runtime_context,
        )

        return {
            "needs_retrieval": route_decision.scope in RAG_SCOPES,
            "route_intent": route_decision.intent,
            "route_scope": route_decision.scope,
            "followup_relation": getattr(
                route_decision, "followup_relation", "new_request"
            ),
            "data_source": getattr(route_decision, "data_source", "none"),
            "response_language": getattr(
                route_decision, "response_language", None
            ),
            "session_language_update": getattr(
                route_decision, "session_language_update", False
            ),
            "conversation_target": getattr(
                route_decision, "conversation_target", None
            ),
            "assistant_action": getattr(
                route_decision, "assistant_action", "none"
            ),
            "action_mode": getattr(route_decision, "action_mode", "inform"),
            "personal_sections": list(
                getattr(route_decision, "personal_sections", []) or []
            ),
            "form_request_mode": getattr(
                route_decision, "form_request_mode", "none"
            ),
            "referenced_form_number": getattr(
                route_decision, "referenced_form_number", None
            ),
            "retrieval_query": getattr(
                route_decision, "retrieval_query", None
            ),
            "needs_clarification": bool(
                getattr(route_decision, "needs_clarification", False)
            ),
            "clarification_question": getattr(
                route_decision, "clarification_question", None
            ),
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        logger.exception(
            "Chat route "
            "classification failed"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Không thể phân loại "
                "câu hỏi."
            ),
        ) from exc


# =============================================================================
# Normal chat
# =============================================================================


@router.post(
    "/chat",
    response_model=ChatResponse,
)
async def chat(
    request: ChatRequest,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
) -> ChatResponse:

    message = (
        normalize_message(
            request.message
        )
    )

    # Avoid blocking event loop on Redis.
    await run_in_threadpool(
        enforce_chat_rate_limit,
        current_user,
    )

    # FIX (FORM AGENT DISPATCH — additive):
    # try_dispatch() returns a result dict if EITHER (a) this chat
    # session_id already has an active form-filling session, or
    # (b) /detect recently flagged a form suggestion for this session
    # and this message is a clear "yes" — auto-starting the session
    # right here. Returns None for the normal case (no active session,
    # no pending suggestion, or an unrelated/ambiguous message), in
    # which case everything below runs completely unchanged.
    try:
        history_session_id = await run_in_threadpool(
            prepare_persisted_chat_turn,
            db,
            current_user,
            request,
            message,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=403,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    form_result = await run_in_threadpool(
        _form_agent_try_dispatch,
        history_session_id,
        message,
        current_user,
    )
    if form_result is not None:
        response = _build_form_agent_chat_response(
            history_session_id,
            form_result,
        )
        await run_in_threadpool(
            persist_assistant_chat_message,
            db,
            current_user,
            request,
            history_session_id,
            response.result,
        )
        return response

    # Load persisted turns once, expose structured pending state to the ONE
    # semantic router, then reuse the same turns for Copilot dispatch.
    copilot_history_turns = await run_in_threadpool(
        lambda: get_recent_chat_turns(
            db=db,
            user_id=int(current_user["id"]),
            session_id=history_session_id,
        )
    )
    pending_for_router = _resolve_pending_for_turn(
        user_id=int(current_user["id"]),
        session_id=history_session_id,
        history_turns=list(copilot_history_turns or []),
    )

    route_decision = await run_in_threadpool(
        chat_service.prepare_route,
        message,
        history_session_id,
        _semantic_runtime_context(pending_for_router),
    )
    (
        copilot_result,
        copilot_extra_metadata,
        copilot_effective_action,
        copilot_effective_mode,
    ) = await run_in_threadpool(
        lambda: _dispatch_copilot_confirmation_flow(
            db=db,
            current_user=current_user,
            message=message,
            route=route_decision,
            session_id=history_session_id,
            history_turns=list(copilot_history_turns or []),
            pending_override=pending_for_router,
        )
    )
    if copilot_result is not None:
        structured_result = build_chat_result(copilot_result)
        await run_in_threadpool(
            persist_assistant_chat_message,
            db,
            current_user,
            request,
            history_session_id,
            structured_result,
            None,
            copilot_extra_metadata,
        )
        return ChatResponse(
            response=structured_result.answer,
            session_id=history_session_id,
            result=structured_result,
        )

    if (
        str(current_user.get("role") or "").upper() == "STUDENT"
        and route_decision.scope == "personal"
        and route_decision.intent == "personal_data"
        and getattr(route_decision, "data_source", "none") == "personal_db"
        and not route_decision.needs_clarification
    ):
        personal_result = await run_in_threadpool(
            lambda: answer_student_personal_question(
                db,
                current_user,
                message,
                personal_route=route_decision,
            )
        )
        if personal_result is not None:
            structured_result = build_chat_result(personal_result)
            await run_in_threadpool(
                persist_assistant_chat_message,
                db,
                current_user,
                request,
                history_session_id,
                structured_result,
            )
            return ChatResponse(
                response=structured_result.answer,
                session_id=history_session_id,
                result=structured_result,
            )

    try:
        # Whole synchronous RAG pipeline runs
        # in worker thread, not FastAPI loop.
        result = (
            await run_in_threadpool(
                lambda: chat_service.ask(
                    message=message,
                    session_id=history_session_id,
                    user_id=get_observability_user_id(current_user),
                    precomputed_route=route_decision,
                )
            )
        )

        structured_result = (
            build_chat_result(
                result
            )
        )

        await run_in_threadpool(
            persist_assistant_chat_message,
            db,
            current_user,
            request,
            history_session_id,
            structured_result,
        )

        return ChatResponse(
            response=(
                structured_result.answer
            ),
            session_id=(
                history_session_id
            ),
            result=(
                structured_result
            ),
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    except Exception as exc:
        logger.exception(
            "Chat request failed"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Internova AI hiện "
                "không thể xử lý "
                "câu hỏi này."
            ),
        ) from exc


# =============================================================================
# Streaming chat
# =============================================================================


@router.post(
    "/chat/stream"
)
async def chat_stream(
    request: ChatRequest,
    current_user: dict = Depends(
        get_current_user
    ),
    db: Session = Depends(
        get_db
    ),
) -> StreamingResponse:
    """Provider-native token streaming with cancellation and authoritative final validation."""

    message = normalize_message(
        request.message
    )

    await run_in_threadpool(
        enforce_chat_rate_limit,
        current_user,
    )

    # FIX (FORM AGENT DISPATCH — additive): same guard as chat() above
    # (see try_dispatch's docstring in bridge.py), adapted to this
    # endpoint's NDJSON streaming protocol. Falls through unchanged to
    # all existing code below when try_dispatch() returns None.
    try:
        history_session_id = await run_in_threadpool(
            prepare_persisted_chat_turn,
            db,
            current_user,
            request,
            message,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=403,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc

    _pending_form_check = await run_in_threadpool(
        _form_agent_try_dispatch,
        history_session_id,
        message,
        current_user,
    )

    if _pending_form_check is not None:
        _form_result_precomputed = _pending_form_check

        async def form_agent_event_generator():
            form_started = time.perf_counter()

            yield serialize_stream_event(
                {
                    "type": "status",
                    "phase": "thinking",
                    "session_id": history_session_id,
                    "needs_retrieval": False,
                    "route_intent": "form_agent",
                    "route_scope": "form_agent",
                    "cache_hit": False,
                    "step": {
                        "id": "form_agent",
                        "status": "running",
                        "engine": "Internova Form Agent",
                        "model": (
                            get_settings().openai_chat_model
                            or get_settings().model_name
                        ),
                        "detail": "processing_form_request",
                        "metrics": {},
                    },
                }
            )

            form_result = _form_result_precomputed

            chat_response = _build_form_agent_chat_response(
                history_session_id,
                form_result,
            )

            await run_in_threadpool(
                persist_assistant_chat_message,
                db,
                current_user,
                request,
                history_session_id,
                chat_response.result,
                round((time.perf_counter() - form_started) * 1000.0, 1),
            )

            yield serialize_stream_event(
                {
                    "type": "status",
                    "phase": "answering",
                    "session_id": history_session_id,
                    "needs_retrieval": False,
                    "route_intent": "form_agent",
                    "route_scope": "form_agent",
                    "cache_hit": False,
                }
            )

            yield serialize_stream_event(
                {
                    "type": "final",
                    "session_id": history_session_id,
                    "response": chat_response.response,
                    "result": chat_response.result.model_dump(),
                    "form_agent": {
                        "session_id": history_session_id,
                        "status": form_result.get("status"),
                        "detected_form": form_result.get("detected_form"),
                        "docx_ready": bool(form_result.get("docx_ready")),
                    },
                    "processing": build_processing_summary(
                        chat_response.result,
                        round((time.perf_counter() - form_started) * 1000.0, 1),
                    ),
                }
            )

            logger.info(
                "Form agent stream complete ms=%s",
                round(
                    (time.perf_counter() - form_started) * 1000.0,
                    1,
                ),
            )

        return StreamingResponse(
            form_agent_event_generator(),
            media_type="application/x-ndjson; charset=utf-8",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",
            },
        )

    # Streaming uses the exact same semantic context as non-streaming.
    # Load recent turns first, then give structured pending state to the SAME
    # single semantic-router call.
    copilot_history_turns = await run_in_threadpool(
        lambda: get_recent_chat_turns(
            db=db,
            user_id=int(current_user["id"]),
            session_id=history_session_id,
        )
    )
    pending_for_router = _resolve_pending_for_turn(
        user_id=int(current_user["id"]),
        session_id=history_session_id,
        history_turns=list(copilot_history_turns or []),
    )

    route_decision = await run_in_threadpool(
        chat_service.prepare_route,
        message,
        history_session_id,
        _semantic_runtime_context(pending_for_router),
    )
    (
        copilot_result,
        copilot_extra_metadata,
        copilot_effective_action,
        copilot_effective_mode,
    ) = await run_in_threadpool(
        lambda: _dispatch_copilot_confirmation_flow(
            db=db,
            current_user=current_user,
            message=message,
            route=route_decision,
            session_id=history_session_id,
            history_turns=list(copilot_history_turns or []),
            pending_override=pending_for_router,
        )
    )

    if copilot_result is not None:
        async def copilot_event_generator():
            copilot_started = time.perf_counter()
            structured_result = build_chat_result(copilot_result)
            await run_in_threadpool(
                persist_assistant_chat_message,
                db,
                current_user,
                request,
                history_session_id,
                structured_result,
                round((time.perf_counter() - copilot_started) * 1000.0, 1),
                copilot_extra_metadata,
            )
            yield serialize_stream_event(
                {
                    "type": "status",
                    "phase": "answering",
                    "session_id": history_session_id,
                    "needs_retrieval": copilot_result.route_scope in RAG_SCOPES,
                    "route_intent": copilot_result.route_intent,
                    "route_scope": copilot_result.route_scope,
                    "assistant_action": copilot_effective_action,
                    "action_mode": copilot_effective_mode,
                    "cache_hit": False,
                }
            )
            yield serialize_stream_event(
                {
                    "type": "final",
                    "session_id": history_session_id,
                    "response": structured_result.answer,
                    "result": structured_result.model_dump(),
                }
            )

        return StreamingResponse(
            copilot_event_generator(),
            media_type="application/x-ndjson; charset=utf-8",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",
            },
        )

    if (
        str(current_user.get("role") or "").upper() == "STUDENT"
        and route_decision.scope == "personal"
        and route_decision.intent == "personal_data"
        and getattr(route_decision, "data_source", "none") == "personal_db"
        and not route_decision.needs_clarification
    ):
        async def personal_event_generator():
            personal_started = time.perf_counter()

            yield serialize_stream_event(
                {
                    "type": "status",
                    "phase": "thinking",
                    "session_id": history_session_id,
                    "needs_retrieval": False,
                    "route_intent": "personal_student_info",
                    "route_scope": "personal_student",
                    "cache_hit": False,
                    "step": {
                        "id": "personal_data",
                        "status": "running",
                        "engine": "Authorized PostgreSQL Query",
                        "model": None,
                        "detail": "checking_personal_data",
                        "metrics": {},
                    },
                }
            )

            result = await run_in_threadpool(
                lambda: answer_student_personal_question(
                    db,
                    current_user,
                    message,
                    personal_scope="personal",
                    personal_route=route_decision,
                )
            )

            if result is None:
                yield serialize_stream_event(
                    {
                        "type": "error",
                        "phase": "error",
                        "detail": "Không thể xử lý thông tin cá nhân cho yêu cầu này.",
                    }
                )
                return

            structured_result = build_chat_result(result)

            await run_in_threadpool(
                persist_assistant_chat_message,
                db,
                current_user,
                request,
                history_session_id,
                structured_result,
                round((time.perf_counter() - personal_started) * 1000.0, 1),
            )

            yield serialize_stream_event(
                {
                    "type": "status",
                    "phase": "answering",
                    "session_id": history_session_id,
                    "needs_retrieval": False,
                    "route_intent": structured_result.route_intent,
                    "route_scope": structured_result.route_scope,
                    "cache_hit": False,
                }
            )

            yield serialize_stream_event(
                {
                    "type": "final",
                    "session_id": history_session_id,
                    "response": structured_result.answer,
                    "result": structured_result.model_dump(),
                    "processing": build_processing_summary(
                        structured_result,
                        round((time.perf_counter() - personal_started) * 1000.0, 1),
                    ),
                }
            )

            logger.info(
                "Personal chat complete ms=%s",
                round(
                    (time.perf_counter() - personal_started) * 1000.0,
                    1,
                ),
            )

        return StreamingResponse(
            personal_event_generator(),
            media_type="application/x-ndjson; charset=utf-8",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",
            },
        )

    async def event_generator():
        stream_started = time.perf_counter()
        first_token_logged = False
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[tuple[str, Any]] = asyncio.Queue()
        cancelled = Event()
        producer_task: asyncio.Task | None = None

        def enqueue(
            event_type: str,
            payload: Any,
        ) -> None:
            if cancelled.is_set():
                return
            loop.call_soon_threadsafe(
                queue.put_nowait,
                (event_type, payload),
            )

        def on_token(token: str) -> None:
            if cancelled.is_set():
                raise StreamingCancelled(
                    "Streaming client disconnected"
                )
            if token:
                enqueue("token", token)

        def on_status(
            phase: str,
            metadata: dict,
        ) -> None:
            enqueue(
                "status",
                {
                    "type": "status",
                    "phase": phase,
                    "session_id": history_session_id,
                    "needs_retrieval": metadata.get("needs_retrieval"),
                    "route_intent": metadata.get("route_intent"),
                    "route_scope": metadata.get("route_scope"),
                    "cache_hit": metadata.get("cache_hit", False),
                    "step": metadata.get("step"),
                },
            )

        async def produce() -> None:
            try:
                result = await run_in_threadpool(
                    lambda: chat_service.ask(
                        message=message,
                        session_id=history_session_id,
                        on_token=on_token,
                        on_status=on_status,
                        should_cancel=cancelled.is_set,
                        user_id=get_observability_user_id(current_user),
                        precomputed_route=route_decision,
                    )
                )
                enqueue("result", result)
            except StreamingCancelled:
                # Normal path when the browser aborts the request.
                pass
            except Exception as exc:
                enqueue("error", exc)
            finally:
                enqueue("done", None)

        try:
            # Immediate feedback while guardrail/routing runs.
            yield serialize_stream_event(
                {
                    "type": "status",
                    "phase": "thinking",
                    "session_id": history_session_id,
                    "needs_retrieval": None,
                    "route_intent": None,
                    "route_scope": None,
                    "step": {
                        "id": "request",
                        "status": "completed",
                        "engine": "Internova Chat API",
                        "model": None,
                        "detail": "request_authenticated",
                        "metrics": {},
                    },
                }
            )

            producer_task = asyncio.create_task(
                produce()
            )

            final_result: Any | None = None

            while True:
                event_type, payload = await queue.get()

                if event_type == "status":
                    yield serialize_stream_event(payload)
                    continue

                if event_type == "token":
                    if not first_token_logged:
                        first_token_logged = True
                        logger.info(
                            "Chat stream TTFT ms=%s",
                            round(
                                (time.perf_counter() - stream_started) * 1000.0,
                                1,
                            ),
                        )
                    yield serialize_stream_event(
                        {
                            "type": "token",
                            "token": str(payload),
                        }
                    )
                    continue

                if event_type == "result":
                    final_result = payload
                    continue

                if event_type == "error":
                    raise payload

                if event_type == "done":
                    break

            if producer_task is not None:
                await producer_task

            if final_result is None:
                if cancelled.is_set():
                    return
                raise RuntimeError(
                    "Chat stream finished without a final result."
                )

            # This is authoritative: it is emitted only after the existing
            # evidence/groundedness/confidence/citation path has completed.
            structured_result = build_chat_result(
                final_result
            )

            await run_in_threadpool(
                persist_assistant_chat_message,
                db,
                current_user,
                request,
                history_session_id,
                structured_result,
                round((time.perf_counter() - stream_started) * 1000.0, 1),
            )

            yield serialize_stream_event(
                {
                    "type": "final",
                    "session_id": history_session_id,
                    "response": structured_result.answer,
                    "result": structured_result.model_dump(),
                    "processing": build_processing_summary(
                        structured_result,
                        round((time.perf_counter() - stream_started) * 1000.0, 1),
                    ),
                }
            )
            logger.info(
                "Chat stream complete ms=%s",
                round(
                    (time.perf_counter() - stream_started) * 1000.0,
                    1,
                ),
            )

        except asyncio.CancelledError:
            cancelled.set()
            raise
        except ValueError as exc:
            yield serialize_stream_event(
                {
                    "type": "error",
                    "phase": "error",
                    "detail": str(exc),
                }
            )
        except Exception:
            logger.exception(
                "Chat true-streaming request failed"
            )
            yield serialize_stream_event(
                {
                    "type": "error",
                    "phase": "error",
                    "detail": (
                        "Internova AI hiện không thể xử lý "
                        "câu hỏi này."
                    ),
                }
            )
        finally:
            cancelled.set()
            if producer_task is not None and not producer_task.done():
                producer_task.cancel()
                with suppress(asyncio.CancelledError):
                    await producer_task

    return StreamingResponse(
        event_generator(),
        media_type="application/x-ndjson; charset=utf-8",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
        },
    )


# =============================================================================
# Internship Copilot management endpoints
# =============================================================================


class CopilotOpportunityCreate(BaseModel):
    company_id: int = Field(gt=0)
    title: str = Field(min_length=2, max_length=200)
    department: str | None = Field(default=None, max_length=150)
    description: str | None = None
    requirements: str | None = None
    skills_required: list[str] = Field(default_factory=list)
    eligible_majors: list[str] = Field(default_factory=list)
    work_mode: Literal["ONSITE", "REMOTE", "HYBRID"] | None = None
    min_gpa: float | None = Field(default=None, ge=0.0, le=10.0)
    start_date: date | None = None
    end_date: date | None = None
    application_deadline: date | None = None
    status: Literal["DRAFT", "OPEN", "CLOSED", "ARCHIVED"] = "OPEN"


class CopilotOpportunityStatusUpdate(BaseModel):
    status: Literal["DRAFT", "OPEN", "CLOSED", "ARCHIVED"]


class CopilotEscalationStatusUpdate(BaseModel):
    status: Literal["ACKNOWLEDGED", "IN_REVIEW", "RESOLVED", "CLOSED"]


@router.get("/copilot/opportunities")
async def list_copilot_opportunities(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = await run_in_threadpool(
        lambda: db.execute(
            text(
                """
                SELECT io.id, io.title, io.department, io.description, io.requirements,
                       io.skills_required, io.eligible_majors, io.work_mode, io.min_gpa, io.start_date,
                       io.end_date, io.application_deadline, io.status,
                       c.id AS company_id, c.name AS company_name, c.industry
                FROM internship_opportunities io
                JOIN companies c ON c.id = io.company_id
                WHERE io.status = 'OPEN'
                  AND (io.application_deadline IS NULL OR io.application_deadline >= CURRENT_DATE)
                ORDER BY io.application_deadline ASC NULLS LAST, io.created_at DESC
                LIMIT 200
                """
            )
        ).mappings().all()
    )
    return {"items": [dict(row) for row in rows]}


@router.post("/copilot/opportunities")
async def create_copilot_opportunity(
    payload: CopilotOpportunityCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_admin(current_user)

    def _create():
        row = db.execute(
            text(
                """
                INSERT INTO internship_opportunities
                    (company_id, title, department, description, requirements,
                     skills_required, eligible_majors, work_mode, min_gpa, start_date, end_date,
                     application_deadline, status)
                VALUES
                    (:company_id, :title, :department, :description, :requirements,
                     :skills_required, :eligible_majors, :work_mode, :min_gpa, :start_date, :end_date,
                     :application_deadline, :status)
                RETURNING id
                """
            ),
            payload.model_dump(),
        ).mappings().first()
        if not row:
            raise HTTPException(status_code=500, detail="Failed to create internship opportunity")
        db.commit()
        return int(row["id"])

    opportunity_id = await run_in_threadpool(_create)
    return {"status": "created", "id": opportunity_id}


@router.patch("/copilot/opportunities/{opportunity_id}")
async def update_copilot_opportunity_status(
    opportunity_id: int,
    payload: CopilotOpportunityStatusUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_admin(current_user)

    def _update():
        result = db.execute(
            text(
                """
                UPDATE internship_opportunities
                SET status = :status, updated_at = NOW()
                WHERE id = :id
                """
            ),
            {"status": payload.status, "id": opportunity_id},
        )
        db.commit()
        return result.rowcount

    changed = await run_in_threadpool(_update)
    if not changed:
        raise HTTPException(status_code=404, detail="Opportunity not found.")
    return {"status": payload.status, "id": opportunity_id}


@router.get("/copilot/reminders")
async def list_copilot_reminders(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if str(current_user.get("role") or "").upper() != "STUDENT":
        raise HTTPException(status_code=403, detail="Student account required.")

    rows = await run_in_threadpool(
        get_pending_reminders,
        db,
        int(current_user["id"]),
        100,
    )
    return {"items": [dict(row) for row in rows]}


@router.delete("/copilot/reminders/{reminder_id}")
async def cancel_copilot_reminder(
    reminder_id: int,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if str(current_user.get("role") or "").upper() != "STUDENT":
        raise HTTPException(status_code=403, detail="Student account required.")

    changed = await run_in_threadpool(
        cancel_reminder,
        db,
        int(current_user["id"]),
        reminder_id,
    )
    if not changed:
        raise HTTPException(status_code=404, detail="Pending reminder not found.")
    return {"status": "cancelled", "id": reminder_id}


@router.get("/copilot/escalations")
async def list_copilot_escalations(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role = str(current_user.get("role") or "").upper()
    user_id = int(current_user["id"])
    if role == "STUDENT":
        where_sql = "e.student_id = :user_id"
    elif role == "LECTURER":
        where_sql = "e.lecturer_id = :user_id"
    elif role == "ADMIN":
        where_sql = "TRUE"
    else:
        raise HTTPException(status_code=403, detail="Unsupported role.")

    rows = await run_in_threadpool(
        lambda: db.execute(
            text(
                f"""
                SELECT e.id, e.internship_id, e.student_id, e.lecturer_id,
                       e.escalation_type, e.severity, e.target, e.subject,
                       e.description, e.status, e.created_at, e.acknowledged_at,
                       e.resolved_at
                FROM internship_escalations e
                WHERE {where_sql}
                ORDER BY e.created_at DESC
                LIMIT 200
                """
            ),
            {"user_id": user_id},
        ).mappings().all()
    )
    return {"items": [dict(row) for row in rows]}


@router.patch("/copilot/escalations/{escalation_id}")
async def update_copilot_escalation(
    escalation_id: int,
    payload: CopilotEscalationStatusUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role = str(current_user.get("role") or "").upper()
    user_id = int(current_user["id"])
    if role not in {"LECTURER", "ADMIN"}:
        raise HTTPException(status_code=403, detail="Lecturer or admin account required.")

    def _update():
        permission = "TRUE" if role == "ADMIN" else "lecturer_id = :user_id"
        result = db.execute(
            text(
                f"""
                UPDATE internship_escalations
                SET status = :status,
                    acknowledged_at = CASE
                        WHEN :status IN ('ACKNOWLEDGED','IN_REVIEW') AND acknowledged_at IS NULL THEN NOW()
                        ELSE acknowledged_at
                    END,
                    resolved_at = CASE
                        WHEN :status IN ('RESOLVED','CLOSED') THEN NOW()
                        ELSE resolved_at
                    END,
                    updated_at = NOW()
                WHERE id = :id AND ({permission})
                """
            ),
            {"status": payload.status, "id": escalation_id, "user_id": user_id},
        )
        db.commit()
        return result.rowcount

    changed = await run_in_threadpool(_update)
    if not changed:
        raise HTTPException(status_code=404, detail="Escalation not found or not authorized.")
    return {"status": payload.status, "id": escalation_id}


@router.post("/copilot/notifications/run")
async def run_copilot_notification_cycle(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enforce_admin(current_user)

    def _run():
        smart = generate_smart_deadline_notifications(db)
        due = deliver_due_calendar_reminders(db)
        return smart, due

    smart, due = await run_in_threadpool(_run)
    return {"status": "ok", "smart_created": smart, "reminders_delivered": due}


# =============================================================================
# Health/status
# =============================================================================


@router.get(
    "/status"
)
async def status():
    return {
        "status":
            "ready",

        "service":
            "Internova RAG API",
    }


# =============================================================================
# Reload pipeline
# =============================================================================


@router.post(
    "/chat/reload"
)
async def reload_chat_pipeline(
    current_user: dict = Depends(
        get_current_user
    ),
):

    enforce_admin(
        current_user
    )

    try:
        await run_in_threadpool(
            chat_service
            .reload_pipeline
        )

        return {
            "status":
                "ok",

            "message": (
                "RAG pipeline will reload "
                "on next request."
            ),
        }

    except Exception as exc:
        logger.exception(
            "RAG pipeline reload failed"
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "Không thể reload "
                "RAG pipeline."
            ),
        ) from exc