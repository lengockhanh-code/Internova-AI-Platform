from __future__ import annotations

import csv
import io
import json
import logging
import math
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.database.connection import SessionLocal

logger = logging.getLogger(__name__)


class AdminAuditLogNotFoundError(ValueError):
    pass


TIME_RANGES = {
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
}


def _cutoff(time_range: str) -> datetime | None:
    delta = TIME_RANGES.get(time_range)
    return datetime.now(UTC) - delta if delta else None


def _filters(
    *,
    search: str | None,
    category: str | None,
    outcome: str | None,
    severity: str | None,
    actor_id: int | None,
    time_range: str,
) -> tuple[list[str], dict[str, Any]]:
    conditions = ["TRUE"]
    params: dict[str, Any] = {}
    cutoff = _cutoff(time_range)
    if cutoff is not None:
        conditions.append("logs.created_at >= :cutoff")
        params["cutoff"] = cutoff
    if search and search.strip():
        conditions.append(
            """(
                logs.action ILIKE :search
                OR logs.detail ILIKE :search
                OR COALESCE(logs.actor_name, '') ILIKE :search
                OR COALESCE(logs.actor_email, '') ILIKE :search
                OR COALESCE(logs.resource_label, '') ILIKE :search
                OR COALESCE(logs.resource_id, '') ILIKE :search
                OR logs.request_id ILIKE :search
                OR logs.event_id::text ILIKE :search
            )"""
        )
        params["search"] = f"%{search.strip()}%"
    if category:
        conditions.append("logs.category = :category")
        params["category"] = category
    if outcome in {"SUCCESS", "FAILED"}:
        conditions.append("logs.outcome = :outcome")
        params["outcome"] = outcome
    if severity in {"LOW", "MEDIUM", "HIGH", "CRITICAL"}:
        conditions.append("logs.severity = :severity")
        params["severity"] = severity
    if actor_id is not None:
        conditions.append("logs.actor_id = :actor_id")
        params["actor_id"] = actor_id
    return conditions, params


def _item(row: Any) -> dict[str, Any]:
    value = dict(row)
    metadata = value.get("metadata") or {}
    if isinstance(metadata, str):
        try:
            metadata = json.loads(metadata)
        except json.JSONDecodeError:
            metadata = {}
    return {
        "id": int(value["id"]),
        "eventId": str(value["event_id"]),
        "requestId": str(value["request_id"]),
        "actor": {
            "id": value.get("actor_id"),
            "name": value.get("actor_name") or "Không xác định",
            "email": value.get("actor_email"),
            "role": value.get("actor_role"),
        },
        "action": str(value["action"]),
        "category": str(value["category"]),
        "resourceType": value.get("resource_type"),
        "resourceId": value.get("resource_id"),
        "resourceLabel": value.get("resource_label"),
        "outcome": str(value["outcome"]),
        "severity": str(value["severity"]),
        "httpMethod": str(value["http_method"]),
        "requestPath": str(value["request_path"]),
        "httpStatus": int(value["http_status"]),
        "ipAddress": value.get("ip_address"),
        "userAgent": value.get("user_agent"),
        "detail": str(value["detail"]),
        "metadata": metadata,
        "durationMs": int(value.get("duration_ms") or 0),
        "createdAt": value["created_at"],
    }


def _summary(db: Session, cutoff: datetime | None) -> dict[str, Any]:
    condition = "TRUE" if cutoff is None else "created_at >= :cutoff"
    params = {} if cutoff is None else {"cutoff": cutoff}
    row = db.execute(
        text(
            f"""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE outcome = 'SUCCESS') AS success,
                COUNT(*) FILTER (WHERE outcome = 'FAILED') AS failed,
                COUNT(*) FILTER (WHERE severity IN ('HIGH', 'CRITICAL')) AS high_risk,
                COUNT(DISTINCT actor_id) FILTER (WHERE actor_id IS NOT NULL) AS active_actors
            FROM public.admin_audit_logs
            WHERE {condition}
            """
        ),
        params,
    ).mappings().first()
    value = dict(row or {})
    total = int(value.get("total") or 0)
    success = int(value.get("success") or 0)
    return {
        "total": total,
        "success": success,
        "failed": int(value.get("failed") or 0),
        "highRisk": int(value.get("high_risk") or 0),
        "activeActors": int(value.get("active_actors") or 0),
        "successRate": round((success / total) * 100, 1) if total else 0,
    }


def _trend(db: Session) -> list[dict[str, Any]]:
    rows = db.execute(
        text(
            """
            WITH days AS (
                SELECT generate_series(
                    CURRENT_DATE - INTERVAL '6 days',
                    CURRENT_DATE,
                    INTERVAL '1 day'
                )::date AS day
            )
            SELECT
                days.day,
                COUNT(logs.id) FILTER (WHERE logs.outcome = 'SUCCESS') AS success,
                COUNT(logs.id) FILTER (WHERE logs.outcome = 'FAILED') AS failed
            FROM days
            LEFT JOIN public.admin_audit_logs AS logs
                ON logs.created_at >= days.day
                AND logs.created_at < days.day + INTERVAL '1 day'
            GROUP BY days.day
            ORDER BY days.day
            """
        )
    ).mappings().all()
    return [
        {
            "date": row["day"].isoformat(),
            "success": int(row["success"] or 0),
            "failed": int(row["failed"] or 0),
        }
        for row in rows
    ]


def _category_options(db: Session, cutoff: datetime | None) -> list[dict[str, Any]]:
    condition = "TRUE" if cutoff is None else "created_at >= :cutoff"
    params = {} if cutoff is None else {"cutoff": cutoff}
    rows = db.execute(
        text(
            f"""
            SELECT category, COUNT(*) AS count
            FROM public.admin_audit_logs
            WHERE {condition}
            GROUP BY category
            ORDER BY count DESC, category
            """
        ),
        params,
    ).mappings().all()
    return [
        {"value": str(row["category"]), "label": str(row["category"]), "count": int(row["count"])}
        for row in rows
    ]


def _actor_options(db: Session) -> list[dict[str, Any]]:
    rows = db.execute(
        text(
            """
            SELECT actor_id, MAX(actor_name) AS actor_name, MAX(actor_email) AS actor_email
            FROM public.admin_audit_logs
            WHERE actor_id IS NOT NULL
            GROUP BY actor_id
            ORDER BY MAX(created_at) DESC
            LIMIT 100
            """
        )
    ).mappings().all()
    return [
        {
            "id": int(row["actor_id"]),
            "name": row["actor_name"] or f"User #{row['actor_id']}",
            "email": row["actor_email"],
        }
        for row in rows
    ]


def list_admin_audit_logs(
    db: Session,
    *,
    search: str | None,
    category: str | None,
    outcome: str | None,
    severity: str | None,
    actor_id: int | None,
    time_range: str,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    conditions, params = _filters(
        search=search,
        category=category,
        outcome=outcome,
        severity=severity,
        actor_id=actor_id,
        time_range=time_range,
    )
    where_sql = " AND ".join(conditions)
    total = int(
        db.execute(
            text(f"SELECT COUNT(*) FROM public.admin_audit_logs AS logs WHERE {where_sql}"),
            params,
        ).scalar()
        or 0
    )
    rows = db.execute(
        text(
            f"""
            SELECT logs.*
            FROM public.admin_audit_logs AS logs
            WHERE {where_sql}
            ORDER BY logs.created_at DESC, logs.id DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {**params, "limit": page_size, "offset": (page - 1) * page_size},
    ).mappings().all()
    cutoff = _cutoff(time_range)
    return {
        "items": [_item(row) for row in rows],
        "total": total,
        "page": page,
        "pageSize": page_size,
        "totalPages": max(1, math.ceil(total / page_size)),
        "summary": _summary(db, cutoff),
        "trend": _trend(db),
        "categories": _category_options(db, cutoff),
        "actors": _actor_options(db),
    }


def get_admin_audit_log(db: Session, audit_id: int) -> dict[str, Any]:
    row = db.execute(
        text("SELECT * FROM public.admin_audit_logs WHERE id = :audit_id LIMIT 1"),
        {"audit_id": audit_id},
    ).mappings().first()
    if row is None:
        raise AdminAuditLogNotFoundError("Không tìm thấy bản ghi audit log.")
    return _item(row)


def export_admin_audit_logs_csv(
    db: Session,
    *,
    search: str | None,
    category: str | None,
    outcome: str | None,
    severity: str | None,
    actor_id: int | None,
    time_range: str,
) -> str:
    conditions, params = _filters(
        search=search,
        category=category,
        outcome=outcome,
        severity=severity,
        actor_id=actor_id,
        time_range=time_range,
    )
    rows = db.execute(
        text(
            f"""
            SELECT * FROM public.admin_audit_logs AS logs
            WHERE {' AND '.join(conditions)}
            ORDER BY logs.created_at DESC, logs.id DESC
            LIMIT 5000
            """
        ),
        params,
    ).mappings().all()
    output = io.StringIO()
    output.write("\ufeff")
    writer = csv.writer(output)
    writer.writerow(
        [
            "Thời gian", "Event ID", "Request ID", "Người thực hiện", "Email",
            "Vai trò", "Hành động", "Nhóm", "Đối tượng", "Kết quả", "Mức độ",
            "HTTP", "Đường dẫn", "IP", "Thời lượng (ms)",
        ]
    )
    for row in rows:
        item = _item(row)
        values = [
                item["createdAt"].isoformat(), item["eventId"], item["requestId"],
                item["actor"]["name"], item["actor"]["email"], item["actor"]["role"],
                item["action"], item["category"], item["resourceLabel"], item["outcome"],
                item["severity"], item["httpStatus"], item["requestPath"],
                item["ipAddress"], item["durationMs"],
        ]
        writer.writerow([_csv_safe(value) for value in values])
    return output.getvalue()


def _csv_safe(value: Any) -> str:
    cell = "" if value is None else str(value)
    if cell.startswith(("=", "+", "-", "@", "\t", "\r")):
        return f"'{cell}"
    return cell


def record_admin_audit_event(event: dict[str, Any]) -> None:
    db = SessionLocal()
    try:
        actor_id = event.get("actor_id")
        actor = None
        if actor_id is not None:
            actor = db.execute(
                text(
                    """
                    SELECT id, full_name, email, role
                    FROM public.users
                    WHERE id = :actor_id
                    LIMIT 1
                    """
                ),
                {"actor_id": actor_id},
            ).mappings().first()
        db.execute(
            text(
                """
                INSERT INTO public.admin_audit_logs (
                    event_id, request_id, actor_id, actor_name, actor_email, actor_role,
                    action, category, resource_type, resource_id, resource_label,
                    outcome, severity, http_method, request_path, http_status,
                    ip_address, user_agent, detail, metadata, duration_ms
                ) VALUES (
                    :event_id, :request_id, :actor_id, :actor_name, :actor_email, :actor_role,
                    :action, :category, :resource_type, :resource_id, :resource_label,
                    :outcome, :severity, :http_method, :request_path, :http_status,
                    :ip_address, :user_agent, :detail, CAST(:metadata AS JSONB), :duration_ms
                )
                """
            ),
            {
                **event,
                "event_id": str(uuid4()),
                "actor_name": actor["full_name"] if actor else None,
                "actor_email": str(actor["email"]) if actor else None,
                "actor_role": actor["role"] if actor else event.get("actor_role"),
                "metadata": json.dumps(event.get("metadata") or {}, ensure_ascii=False),
            },
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Could not persist admin audit event")
    finally:
        db.close()
