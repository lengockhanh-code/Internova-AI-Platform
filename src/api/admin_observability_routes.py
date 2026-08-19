from __future__ import annotations

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
from src.observability.langfuse_api import LangfuseAPI, LangfuseAPIError
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
_ALLOWED_RANGES = {"1h", "24h", "7d", "30d"}


def _range(value: str) -> str:
    return value if value in _ALLOWED_RANGES else "24h"


def _handle(callable_):
    try:
        return callable_()
    except LangfuseAPIError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/status")
def status():
    settings = get_observability_settings()
    health = None
    if settings.configured:
        health = _handle(lambda: LangfuseAPI().health())
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
    return _handle(lambda: build_overview(_range(range)))


@router.get("/rag")
def rag(range: str = Query("24h")):
    return _handle(lambda: build_rag_analytics(_range(range)))


@router.get("/llm")
def llm(range: str = Query("24h")):
    return _handle(lambda: build_llm_analytics(_range(range)))


@router.get("/logs")
def logs(range: str = Query("24h"), limit: int = Query(200, ge=1, le=1000)):
    return _handle(lambda: build_logs(_range(range), limit))


@router.get("/errors")
def errors(range: str = Query("24h"), limit: int = Query(200, ge=1, le=1000)):
    return _handle(lambda: build_errors(_range(range), limit))


@router.get("/traces")
def traces(range: str = Query("24h"), limit: int = Query(200, ge=1, le=1000)):
    return _handle(lambda: build_traces(_range(range), limit))


@router.get("/traces/{trace_id}")
def trace_detail(trace_id: str, range: str = Query("30d")):
    payload = _handle(lambda: build_trace_detail(trace_id, _range(range)))
    if not payload.get("found"):
        raise HTTPException(status_code=404, detail="Trace not found in selected window")
    return payload


@router.get("/alerts")
def alerts(range: str = Query("24h")):
    return _handle(lambda: build_alerts(_range(range)))


@router.post("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: str):
    return {"id": alert_id, **set_alert_state(alert_id, "acknowledged")}


@router.post("/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str):
    return {"id": alert_id, **set_alert_state(alert_id, "resolved")}
