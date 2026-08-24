from __future__ import annotations

from math import ceil

from sqlalchemy import text
from sqlalchemy.orm import Session


def _to_iso(value) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _map_notification(row) -> dict:
    return {
        "id": int(row["id"]),
        "title": row["title"],
        "message": row["message"],
        "type": row["notification_type"] or "SYSTEM",
        "severity": row["severity"] or "INFO",
        "relatedType": row["related_type"],
        "relatedId": int(row["related_id"]) if row["related_id"] is not None else None,
        "read": bool(row["is_read"]),
        "readAt": _to_iso(row["read_at"]),
        "createdAt": _to_iso(row["created_at"]),
    }


def get_lecturer_unread_count(db: Session, user_id: int) -> int:
    return int(
        db.execute(
            text(
                """
                SELECT COUNT(*)
                FROM public.notifications
                WHERE user_id = :user_id
                  AND is_read = FALSE
                """
            ),
            {"user_id": user_id},
        ).scalar_one()
    )


def get_lecturer_notifications(
    db: Session,
    user_id: int,
    *,
    read_status: str = "ALL",
    severity: str = "ALL",
    notification_type: str | None = None,
    search: str | None = None,
    period: str = "ALL",
    page: int = 1,
    page_size: int = 20,
) -> dict:
    conditions = ["user_id = :user_id"]
    params: dict[str, object] = {"user_id": user_id}

    if read_status == "UNREAD":
        conditions.append("is_read = FALSE")
    elif read_status == "READ":
        conditions.append("is_read = TRUE")

    if severity == "ATTENTION":
        conditions.append("severity IN ('WARNING', 'ERROR')")
    elif severity != "ALL":
        conditions.append("severity = :severity")
        params["severity"] = severity

    cleaned_type = notification_type.strip() if notification_type else ""
    if cleaned_type and cleaned_type != "ALL":
        conditions.append("COALESCE(notification_type, 'SYSTEM') = :notification_type")
        params["notification_type"] = cleaned_type

    cleaned_search = search.strip() if search else ""
    if cleaned_search:
        conditions.append("(title ILIKE :search OR message ILIKE :search)")
        params["search"] = f"%{cleaned_search}%"

    if period == "TODAY":
        conditions.append(
            "created_at >= CURRENT_DATE "
            "AND created_at < CURRENT_DATE + INTERVAL '1 day'"
        )

    where_clause = " AND ".join(conditions)
    total_items = int(
        db.execute(
            text(f"SELECT COUNT(*) FROM public.notifications WHERE {where_clause}"),
            params,
        ).scalar_one()
    )
    total_pages = max(1, ceil(total_items / page_size))
    safe_page = min(page, total_pages)

    rows = db.execute(
        text(
            f"""
            SELECT
                id,
                title,
                message,
                notification_type,
                severity,
                related_type,
                related_id,
                is_read,
                read_at,
                created_at
            FROM public.notifications
            WHERE {where_clause}
            ORDER BY created_at DESC, id DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        {
            **params,
            "limit": page_size,
            "offset": (safe_page - 1) * page_size,
        },
    ).mappings().all()

    summary_row = db.execute(
        text(
            """
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE is_read = FALSE) AS unread,
                COUNT(*) FILTER (WHERE is_read = TRUE) AS read,
                COUNT(*) FILTER (
                    WHERE severity IN ('WARNING', 'ERROR')
                ) AS warnings,
                COUNT(*) FILTER (
                    WHERE created_at >= CURRENT_DATE
                      AND created_at < CURRENT_DATE + INTERVAL '1 day'
                ) AS today
            FROM public.notifications
            WHERE user_id = :user_id
            """
        ),
        {"user_id": user_id},
    ).mappings().one()

    type_rows = db.execute(
        text(
            """
            SELECT DISTINCT COALESCE(notification_type, 'SYSTEM') AS type
            FROM public.notifications
            WHERE user_id = :user_id
            ORDER BY type
            """
        ),
        {"user_id": user_id},
    ).scalars().all()

    return {
        "summary": {
            "total": int(summary_row["total"]),
            "unread": int(summary_row["unread"]),
            "read": int(summary_row["read"]),
            "warnings": int(summary_row["warnings"]),
            "today": int(summary_row["today"]),
        },
        "notifications": [_map_notification(row) for row in rows],
        "availableTypes": list(type_rows),
        "pagination": {
            "page": safe_page,
            "pageSize": page_size,
            "totalItems": total_items,
            "totalPages": total_pages,
        },
    }


def set_lecturer_notification_read(
    db: Session,
    user_id: int,
    notification_id: int,
    is_read: bool,
) -> bool:
    row = db.execute(
        text(
            """
            UPDATE public.notifications
            SET is_read = :is_read,
                read_at = CASE
                    WHEN :is_read THEN COALESCE(read_at, NOW())
                    ELSE NULL
                END
            WHERE id = :notification_id
              AND user_id = :user_id
            RETURNING id
            """
        ),
        {
            "notification_id": notification_id,
            "user_id": user_id,
            "is_read": is_read,
        },
    ).first()
    if row is None:
        db.rollback()
        return False
    db.commit()
    return True


def mark_all_lecturer_notifications_read(db: Session, user_id: int) -> int:
    result = db.execute(
        text(
            """
            UPDATE public.notifications
            SET is_read = TRUE,
                read_at = COALESCE(read_at, NOW())
            WHERE user_id = :user_id
              AND is_read = FALSE
            """
        ),
        {"user_id": user_id},
    )
    db.commit()
    return int(result.rowcount or 0)


def delete_lecturer_notification(
    db: Session,
    user_id: int,
    notification_id: int,
) -> bool:
    row = db.execute(
        text(
            """
            DELETE FROM public.notifications
            WHERE id = :notification_id
              AND user_id = :user_id
            RETURNING id
            """
        ),
        {"notification_id": notification_id, "user_id": user_id},
    ).first()
    if row is None:
        db.rollback()
        return False
    db.commit()
    return True


def delete_read_lecturer_notifications(db: Session, user_id: int) -> int:
    result = db.execute(
        text(
            """
            DELETE FROM public.notifications
            WHERE user_id = :user_id
              AND is_read = TRUE
            """
        ),
        {"user_id": user_id},
    )
    db.commit()
    return int(result.rowcount or 0)
