from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.models.admin_audit_logs import AdminAuditLogResponse, AdminAuditLogsResponse
from src.security.auth import get_current_user
from src.services.admin_audit_logs_service import (
    AdminAuditLogNotFoundError,
    export_admin_audit_logs_csv,
    get_admin_audit_log,
    list_admin_audit_logs,
)


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if str(current_user.get("role") or "").upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role is required",
        )
    return current_user


router = APIRouter(
    prefix="/api/v1/admin/system/audit-logs",
    tags=["Admin Audit Logs"],
    dependencies=[Depends(require_admin)],
)


def _filter_args(
    search: str | None,
    category: str | None,
    outcome: str | None,
    severity: str | None,
    actor_id: int | None,
    time_range: str,
) -> dict:
    return {
        "search": search,
        "category": category,
        "outcome": outcome,
        "severity": severity,
        "actor_id": actor_id,
        "time_range": time_range,
    }


@router.get("", response_model=AdminAuditLogsResponse)
def list_audit_logs(
    search: str | None = Query(default=None, max_length=180),
    category: str | None = Query(default=None, max_length=40),
    outcome: Literal["SUCCESS", "FAILED"] | None = Query(default=None),
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] | None = Query(default=None),
    actor_id: int | None = Query(default=None),
    time_range: Literal["24h", "7d", "30d", "all"] = Query(default="7d"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> AdminAuditLogsResponse:
    return AdminAuditLogsResponse(
        **list_admin_audit_logs(
            db,
            **_filter_args(search, category, outcome, severity, actor_id, time_range),
            page=page,
            page_size=page_size,
        )
    )


@router.get("/export")
def export_audit_logs(
    search: str | None = Query(default=None, max_length=180),
    category: str | None = Query(default=None, max_length=40),
    outcome: Literal["SUCCESS", "FAILED"] | None = Query(default=None),
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] | None = Query(default=None),
    actor_id: int | None = Query(default=None),
    time_range: Literal["24h", "7d", "30d", "all"] = Query(default="7d"),
    db: Session = Depends(get_db),
) -> Response:
    content = export_admin_audit_logs_csv(
        db,
        **_filter_args(search, category, outcome, severity, actor_id, time_range),
    )
    filename = f"internova-audit-logs-{datetime.now(UTC).strftime('%Y%m%d-%H%M%S')}.csv"
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{audit_id}", response_model=AdminAuditLogResponse)
def get_audit_log(
    audit_id: int,
    db: Session = Depends(get_db),
) -> AdminAuditLogResponse:
    try:
        return AdminAuditLogResponse(item=get_admin_audit_log(db, audit_id))
    except AdminAuditLogNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
