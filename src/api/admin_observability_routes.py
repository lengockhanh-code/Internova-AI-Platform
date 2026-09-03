from __future__ import annotations

import threading
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from src.observability.alerts import build_alerts, set_alert_state
from src.observability.analytics import (
    build_errors,
    build_llm_analytics,
    build_logs,
    build_overview,
    build_rag_analytics,
    build_trace_detail,
    build_traces,
)
from src.observability.config import get_observability_settings
from src.observability.langfuse_api import LangfuseAPI, LangfuseAPIError, LangfuseRateLimitError
from src.security.auth import get_current_user


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    role = str(current_user.get("role") or "").upper()
    if role != "ADMIN":
        raise HTTPException(status_code=403, detail="Admin role is required")
    return current_user


router = APIRouter(
    prefix="/api/v1/admin/observability",
    tags=["Admin AI Observability"],
    dependencies=[Depends(require_admin)],
)
_ALLOWED_RANGES = {"1h", "24h", "yesterday", "2d", "3d", "7d", "14d", "30d"}
_CACHE: dict[str, dict[str, Any]] = {}
_CACHE_TTL = timedelta(seconds=30)
_CACHE_LOCKS_GUARD = threading.Lock()
_CACHE_LOCKS: dict[str, threading.Lock] = {}


def _range(value: str) -> str:
    return value if value in _ALLOWED_RANGES else "24h"


def _cache_key(name: str, *parts: object) -> str:
    return ":".join([name, *(str(part) for part in parts)])


def _with_meta(
    payload: Any,
    *,
    cached_at: str,
    retry_after_seconds: int | None,
    rate_limited: bool,
    stale_reason: str,
) -> Any:
    if isinstance(payload, dict):
        return {
            **payload,
            "_meta": {
                **(payload.get("_meta") if isinstance(payload.get("_meta"), dict) else {}),
                "rate_limited": rate_limited,
                "stale": True,
                "cached_at": cached_at,
                "retry_after_seconds": retry_after_seconds,
                "stale_reason": stale_reason,
            },
        }

    return {
        "data": payload,
        "_meta": {
            "rate_limited": rate_limited,
            "stale": True,
            "cached_at": cached_at,
            "retry_after_seconds": retry_after_seconds,
            "stale_reason": stale_reason,
        },
    }


def _cache_lock(cache_key: str) -> threading.Lock:
    with _CACHE_LOCKS_GUARD:
        return _CACHE_LOCKS.setdefault(cache_key, threading.Lock())


def _fresh_cached_payload(cache_key: str) -> Any | None:
    cached = _CACHE.get(cache_key)
    if cached is None:
        return None

    try:
        cached_at = datetime.fromisoformat(str(cached["cached_at"]))
    except (KeyError, TypeError, ValueError):
        return None

    if datetime.now(UTC) - cached_at <= _CACHE_TTL:
        return cached.get("payload")
    return None


def _invalidate_cache(prefix: str) -> None:
    for key in list(_CACHE):
        if key.startswith(prefix):
            _CACHE.pop(key, None)


def _handle(cache_key: str, callable_: Callable[[], Any]) -> Any:
    with _cache_lock(cache_key):
        fresh = _fresh_cached_payload(cache_key)
        if fresh is not None:
            return fresh

        try:
            payload = callable_()
            _CACHE[cache_key] = {
                "payload": payload,
                "cached_at": datetime.now(UTC).isoformat(),
            }
            return payload
        except LangfuseRateLimitError as exc:
            cached = _CACHE.get(cache_key)
            if cached is not None:
                return _with_meta(
                    cached["payload"],
                    cached_at=str(cached["cached_at"]),
                    retry_after_seconds=exc.retry_after_seconds,
                    rate_limited=True,
                    stale_reason="langfuse_rate_limit",
                )

            raise HTTPException(
                status_code=429,
                detail={
                    "message": "Langfuse rate limit exceeded. Please retry shortly.",
                    "retryAfterSeconds": exc.retry_after_seconds,
                },
                headers={
                    "Retry-After": str(exc.retry_after_seconds or 30),
                },
            ) from exc
        except LangfuseAPIError as exc:
            cached = _CACHE.get(cache_key)
            if cached is not None:
                return _with_meta(
                    cached["payload"],
                    cached_at=str(cached["cached_at"]),
                    retry_after_seconds=None,
                    rate_limited=False,
                    stale_reason="langfuse_unavailable",
                )
            raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/status")
def status():
    settings = get_observability_settings()
    health = None
    if settings.configured:
        health = _handle("status:health", lambda: LangfuseAPI().health())
    return {
        "enabled": settings.enabled,
        "configured": settings.configured,
        "base_url": settings.base_url,
        "capture_content": settings.capture_content,
        "environment": settings.environment,
        "release": settings.release,
        "health": health,
    }


@router.get("/overview")
def overview(range: str = Query("24h")):
    return _handle(_cache_key("overview", _range(range)), lambda: build_overview(_range(range)))


@router.get("/rag")
def rag(range: str = Query("24h")):
    return _handle(_cache_key("rag", _range(range)), lambda: build_rag_analytics(_range(range)))


@router.get("/llm")
def llm(range: str = Query("24h")):
    return _handle(_cache_key("llm", _range(range)), lambda: build_llm_analytics(_range(range)))


@router.get("/logs")
def logs(range: str = Query("24h"), limit: int = Query(200, ge=1, le=1000)):
    return _handle(_cache_key("logs", _range(range), limit), lambda: build_logs(_range(range), limit))


@router.get("/errors")
def errors(range: str = Query("24h"), limit: int = Query(200, ge=1, le=1000)):
    return _handle(_cache_key("errors", _range(range), limit), lambda: build_errors(_range(range), limit))


@router.get("/traces")
def traces(range: str = Query("24h"), limit: int = Query(200, ge=1, le=1000)):
    return _handle(_cache_key("traces", _range(range), limit), lambda: build_traces(_range(range), limit))


@router.get("/traces/{trace_id}")
def trace_detail(trace_id: str, range: str = Query("30d")):
    payload = _handle(_cache_key("trace", trace_id, _range(range)), lambda: build_trace_detail(trace_id, _range(range)))
    if not payload.get("found"):
        raise HTTPException(status_code=404, detail="Trace not found in selected window")
    return payload


@router.get("/alerts")
def alerts(range: str = Query("24h")):
    selected_range = _range(range)
    return _handle(
        _cache_key("alerts", selected_range),
        lambda: build_alerts(
            selected_range,
            health_check=lambda: _handle(
                "status:health",
                lambda: LangfuseAPI().health(),
            ),
            overview_loader=lambda value: _handle(
                _cache_key("overview", value),
                lambda: build_overview(value),
            ),
            rag_loader=lambda value: _handle(
                _cache_key("rag", value),
                lambda: build_rag_analytics(value),
            ),
            llm_loader=lambda value: _handle(
                _cache_key("llm", value),
                lambda: build_llm_analytics(value),
            ),
        ),
    )


@router.post("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: str):
    result = {"id": alert_id, **set_alert_state(alert_id, "acknowledged")}
    _invalidate_cache("alerts:")
    return result


@router.post("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str):
    result = {"id": alert_id, **set_alert_state(alert_id, "resolved")}
    _invalidate_cache("alerts:")
    return result
