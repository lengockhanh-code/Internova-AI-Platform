from __future__ import annotations

import asyncio
import json
import logging
import time
from contextlib import suppress
from threading import Event
from typing import Any

from sqlalchemy.orm import Session

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from fastapi.responses import (
    StreamingResponse,
)
from starlette.concurrency import (
    run_in_threadpool,
)

from src.config import get_settings
from src.database.connection import (
    get_db,
)
from src.models.chat import (
    ChatRequest,
    ChatResponse,
    ChatResultResponse,
)
from src.security.auth import (
    get_current_user,
)
from src.services.chat_service import (
    chat_service,
)
from src.services.student_personal_chat_service import (
    answer_student_personal_question,
)
from src.rag.generation.answer_generator import StreamingCancelled
from src.services.redis_cache_service import (
    redis_cache,
)

# FIX: additive-only import — form_agent's own bridge module. See
# src/agents/form_agent/bridge.py for the full rationale. Nothing else
# in this file changes; this only adds a short guard clause near the
# top of chat() and chat_stream() (search "FORM AGENT DISPATCH" below).
# try_dispatch() covers BOTH "already mid form-filling" and "student
# just said yes to a prior suggestion" — no other frontend call needed
# to trigger it besides the existing /form-agent/detect call.
from src.agents.form_agent.bridge import try_dispatch as _form_agent_try_dispatch


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
        # Use the same shared semantic router as /chat and /chat/stream.
        # No keyword/personal pre-classifier and no extra LLM call.
        route_decision = await run_in_threadpool(
            chat_service.prepare_route,
            message,
            request.session_id,
        )

        return {
            "needs_retrieval": route_decision.scope in RAG_SCOPES,
            "route_intent": route_decision.intent,
            "route_scope": route_decision.scope,
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
    form_result = await run_in_threadpool(
        _form_agent_try_dispatch,
        request.session_id,
        message,
    )
    if form_result is not None:
        return _build_form_agent_chat_response(
            request.session_id,
            form_result,
        )

    # One semantic-router decision for the whole request. This same decision is
    # reused for personal DB dispatch or passed into the normal RAG pipeline.
    route_decision = await run_in_threadpool(
        chat_service.prepare_route,
        message,
        request.session_id,
    )

    if (
        str(current_user.get("role") or "").upper() == "STUDENT"
        and route_decision.scope == "personal"
        and route_decision.intent == "personal_data"
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
            return ChatResponse(
                response=structured_result.answer,
                session_id=request.session_id,
                result=structured_result,
            )

    try:
        # Whole synchronous RAG pipeline runs
        # in worker thread, not FastAPI loop.
        result = (
            await run_in_threadpool(
                lambda: chat_service.ask(
                    message=message,
                    session_id=request.session_id,
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

        return ChatResponse(
            response=(
                structured_result.answer
            ),
            session_id=(
                request.session_id
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
    _pending_form_check = await run_in_threadpool(
        _form_agent_try_dispatch,
        request.session_id,
        message,
    )

    if _pending_form_check is not None:
        _form_result_precomputed = _pending_form_check

        async def form_agent_event_generator():
            form_started = time.perf_counter()

            yield serialize_stream_event(
                {
                    "type": "status",
                    "phase": "thinking",
                    "session_id": request.session_id,
                    "needs_retrieval": False,
                    "route_intent": "form_agent",
                    "route_scope": "form_agent",
                    "cache_hit": False,
                }
            )

            form_result = _form_result_precomputed

            chat_response = _build_form_agent_chat_response(
                request.session_id,
                form_result,
            )

            yield serialize_stream_event(
                {
                    "type": "status",
                    "phase": "answering",
                    "session_id": request.session_id,
                    "needs_retrieval": False,
                    "route_intent": "form_agent",
                    "route_scope": "form_agent",
                    "cache_hit": False,
                }
            )

            yield serialize_stream_event(
                {
                    "type": "final",
                    "session_id": request.session_id,
                    "response": chat_response.response,
                    "result": chat_response.result.model_dump(),
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

    # Reuse the same semantic router for privacy + RAG routing. No dedicated
    # personal-classifier LLM call is made.
    route_decision = await run_in_threadpool(
        chat_service.prepare_route,
        message,
        request.session_id,
    )

    if (
        str(current_user.get("role") or "").upper() == "STUDENT"
        and route_decision.scope == "personal"
        and route_decision.intent == "personal_data"
        and not route_decision.needs_clarification
    ):
        async def personal_event_generator():
            personal_started = time.perf_counter()

            yield serialize_stream_event(
                {
                    "type": "status",
                    "phase": "thinking",
                    "session_id": request.session_id,
                    "needs_retrieval": False,
                    "route_intent": "personal_student_info",
                    "route_scope": "personal_student",
                    "cache_hit": False,
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

            yield serialize_stream_event(
                {
                    "type": "status",
                    "phase": "answering",
                    "session_id": request.session_id,
                    "needs_retrieval": False,
                    "route_intent": structured_result.route_intent,
                    "route_scope": structured_result.route_scope,
                    "cache_hit": False,
                }
            )

            yield serialize_stream_event(
                {
                    "type": "final",
                    "session_id": request.session_id,
                    "response": structured_result.answer,
                    "result": structured_result.model_dump(),
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
                    "session_id": request.session_id,
                    "needs_retrieval": metadata.get("needs_retrieval"),
                    "route_intent": metadata.get("route_intent"),
                    "route_scope": metadata.get("route_scope"),
                    "cache_hit": metadata.get("cache_hit", False),
                },
            )

        async def produce() -> None:
            try:
                result = await run_in_threadpool(
                    lambda: chat_service.ask(
                        message=message,
                        session_id=request.session_id,
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
                    "session_id": request.session_id,
                    "needs_retrieval": None,
                    "route_intent": None,
                    "route_scope": None,
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

            yield serialize_stream_event(
                {
                    "type": "final",
                    "session_id": request.session_id,
                    "response": structured_result.answer,
                    "result": structured_result.model_dump(),
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