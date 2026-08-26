from __future__ import annotations

from datetime import (
    datetime,
    timedelta,
    timezone,
)
from zoneinfo import ZoneInfo

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.config import get_settings


def to_iso(value) -> str | None:
    if value is None:
        return None

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return str(value)


# ============================================================
# NOTIFICATIONS
# ============================================================

def get_notifications(
    db: Session,
    user_id: int,
):
    return db.execute(
        text(
            """
            SELECT
                id,
                title,
                message,
                notification_type,
                severity,
                related_type,
                related_id,
                is_read,
                created_at

            FROM notifications

            WHERE user_id = :user_id

            ORDER BY created_at DESC

            LIMIT 100
            """
        ),
        {
            "user_id": user_id,
        },
    ).mappings().all()


def get_unread_notification_count(
    db: Session,
    user_id: int,
) -> int:
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


def mark_notification(
    db: Session,
    user_id: int,
    notification_id: int,
    is_read: bool,
):
    row = db.execute(
        text(
            """
            UPDATE notifications

            SET
                is_read = :is_read,

                read_at =
                    CASE
                        WHEN :is_read = TRUE
                        THEN NOW()
                        ELSE NULL
                    END

            WHERE id = :notification_id
              AND user_id = :user_id

            RETURNING id, related_type, related_id
            """
        ),
        {
            "notification_id":
                notification_id,

            "user_id":
                user_id,

            "is_read":
                is_read,
        },
    ).first()


    if row is None:
        return False


    if (
        row.related_type == "LECTURER_STUDENT_MESSAGE"
        and row.related_id is not None
    ):
        db.execute(
            text(
                """
                UPDATE lecturer_student_messages
                SET is_read = :is_read,
                    read_at = CASE
                        WHEN :is_read = TRUE THEN NOW()
                        ELSE NULL
                    END
                WHERE id = :message_id
                  AND student_id = :user_id
                """
            ),
            {
                "is_read": is_read,
                "message_id": row.related_id,
                "user_id": user_id,
            },
        )

    db.commit()

    return True


def mark_all_notifications_read(
    db: Session,
    user_id: int,
):
    db.execute(
        text(
            """
            UPDATE notifications

            SET
                is_read = TRUE,

                read_at =
                    CASE
                        WHEN read_at IS NULL
                        THEN NOW()
                        ELSE read_at
                    END

            WHERE user_id = :user_id
              AND is_read = FALSE
            """
        ),
        {
            "user_id": user_id,
        },
    )

    db.execute(
        text(
            """
            UPDATE lecturer_student_messages
            SET is_read = TRUE,
                read_at = COALESCE(read_at, NOW())
            WHERE student_id = :user_id
              AND is_read = FALSE
            """
        ),
        {"user_id": user_id},
    )


    db.commit()


# ============================================================
# ACTIVE INTERNSHIP
# ============================================================

def get_current_internship(
    db: Session,
    student_id: int,
):
    return db.execute(
        text(
            """
            SELECT
                id,
                semester_id

            FROM internships

            WHERE student_id = :student_id
              AND status <> 'CANCELLED'

            ORDER BY
                CASE status
                    WHEN 'IN_PROGRESS'
                        THEN 1
                    WHEN 'NOT_STARTED'
                        THEN 2
                    WHEN 'PAUSED'
                        THEN 3
                    WHEN 'COMPLETED'
                        THEN 4
                    ELSE 5
                END,
                id DESC

            LIMIT 1
            """
        ),
        {
            "student_id":
                student_id,
        },
    ).mappings().first()


# ============================================================
# CALENDAR
# ============================================================

def get_calendar_events(
    db: Session,

    student_id: int,

    year: int,

    month: int,
):
    start = datetime(
        year,
        month,
        1,
    )


    if month == 12:
        end = datetime(
            year + 1,
            1,
            1,
        )

    else:
        end = datetime(
            year,
            month + 1,
            1,
        )


    personal_events = db.execute(
        text(
            """
            SELECT
                id,
                title,
                description,
                event_type,
                start_time,
                end_time,
                location

            FROM calendar_events

            WHERE user_id =
                :user_id

              AND start_time >=
                :start_time

              AND start_time <
                :end_time

            ORDER BY start_time ASC
            """
        ),
        {
            "user_id":
                student_id,

            "start_time":
                start,

            "end_time":
                end,
        },
    ).mappings().all()


    internship = (
        get_current_internship(
            db,
            student_id,
        )
    )


    semester_id = (
        internship["semester_id"]
        if internship
        else None
    )


    deadlines = db.execute(
        text(
            """
            SELECT
                id,
                title,
                description,
                deadline_type,
                due_at

            FROM deadlines

            WHERE is_active = TRUE

              AND due_at >=
                :start_time

              AND due_at <
                :end_time

              AND (
                    target_role
                        IS NULL

                    OR target_role IN (
                        'STUDENT',
                        'ALL'
                    )
              )

              AND (
                    semester_id
                        IS NULL

                    OR semester_id =
                        :semester_id
              )

            ORDER BY due_at ASC
            """
        ),
        {
            "start_time":
                start,

            "end_time":
                end,

            "semester_id":
                semester_id,
        },
    ).mappings().all()


    events = []


    for row in personal_events:
        events.append(
            {
                "id":
                    row["id"],

                "source":
                    "CALENDAR",

                "title":
                    row["title"],

                "description":
                    row["description"],

                "eventType":
                    row["event_type"],

                "startTime":
                    to_iso(
                        row["start_time"]
                    ),

                "endTime":
                    to_iso(
                        row["end_time"]
                    ),

                "location":
                    row["location"],

                "editable":
                    True,
            }
        )


    for row in deadlines:
        events.append(
            {
                "id":
                    row["id"],

                "source":
                    "DEADLINE",

                "title":
                    row["title"],

                "description":
                    row["description"],

                "eventType":
                    row["deadline_type"],

                "startTime":
                    to_iso(
                        row["due_at"]
                    ),

                "endTime":
                    None,

                "location":
                    None,

                "editable":
                    False,
            }
        )


    events.sort(
        key=lambda item:
            item["startTime"]
    )


    return events


# ============================================================
# CREATE CALENDAR EVENT
# ============================================================

def create_calendar_event(
    db: Session,

    student_id: int,

    title: str,

    description: str | None,

    event_type: str | None,

    start_time: datetime,

    end_time: datetime | None,

    location: str | None,
):
    if (
        end_time is not None
        and end_time < start_time
    ):
        raise ValueError(
            "Thời gian kết thúc phải sau thời gian bắt đầu."
        )


    internship = (
        get_current_internship(
            db,
            student_id,
        )
    )


    row = db.execute(
        text(
            """
            INSERT INTO calendar_events
            (
                user_id,
                internship_id,
                semester_id,
                title,
                description,
                event_type,
                start_time,
                end_time,
                location
            )

            VALUES
            (
                :user_id,
                :internship_id,
                :semester_id,
                :title,
                :description,
                :event_type,
                :start_time,
                :end_time,
                :location
            )

            RETURNING id
            """
        ),
        {
            "user_id":
                student_id,

            "internship_id":
                (
                    internship["id"]
                    if internship
                    else None
                ),

            "semester_id":
                (
                    internship[
                        "semester_id"
                    ]
                    if internship
                    else None
                ),

            "title":
                title,

            "description":
                description,

            "event_type":
                event_type,

            "start_time":
                start_time,

            "end_time":
                end_time,

            "location":
                location,
        },
    ).scalar_one()


    db.commit()

    return row


# ============================================================
# UPDATE EVENT
# ============================================================

def update_calendar_event(
    db: Session,

    student_id: int,

    event_id: int,

    title: str,

    description: str | None,

    event_type: str | None,

    start_time: datetime,

    end_time: datetime | None,

    location: str | None,
):
    if (
        end_time is not None
        and end_time < start_time
    ):
        raise ValueError(
            "Thời gian kết thúc phải sau thời gian bắt đầu."
        )


    row = db.execute(
        text(
            """
            UPDATE calendar_events

            SET
                title = :title,
                description = :description,
                event_type = :event_type,
                start_time = :start_time,
                end_time = :end_time,
                location = :location,
                updated_at = NOW()

            WHERE id = :event_id
              AND user_id = :user_id

            RETURNING id
            """
        ),
        {
            "event_id":
                event_id,

            "user_id":
                student_id,

            "title":
                title,

            "description":
                description,

            "event_type":
                event_type,

            "start_time":
                start_time,

            "end_time":
                end_time,

            "location":
                location,
        },
    ).first()


    if row is None:
        return False


    db.commit()

    return True


# ============================================================
# DELETE EVENT
# ============================================================

def delete_calendar_event(
    db: Session,
    student_id: int,
    event_id: int,
):
    row = db.execute(
        text(
            """
            DELETE FROM calendar_events

            WHERE id = :event_id
              AND user_id = :user_id

            RETURNING id
            """
        ),
        {
            "event_id":
                event_id,

            "user_id":
                student_id,
        },
    ).first()


    if row is None:
        return False


    db.commit()

    return True

# ============================================================
# INTERNSHIP COPILOT REMINDERS
# Reuse existing calendar_events + notifications.
# No separate copilot_reminders table is required.
# ============================================================

COPILOT_REMINDER_EVENT_TYPE = "COPILOT_REMINDER"
COPILOT_REMINDER_NOTIFICATION_TYPE = "COPILOT_REMINDER"


def _copilot_local_naive(value: datetime) -> datetime:
    """Store reminder times consistently in calendar_events TIMESTAMP columns."""
    if value.tzinfo is None:
        return value

    settings = get_settings()
    try:
        local_tz = ZoneInfo(settings.copilot_timezone)
    except Exception:
        local_tz = ZoneInfo("Asia/Ho_Chi_Minh")

    return value.astimezone(local_tz).replace(tzinfo=None)


def schedule_reminder(
    db: Session,
    student_id: int,
    title: str,
    message: str | None,
    scheduled_at: datetime,
) -> int:
    """Create a persistent Copilot reminder using the existing calendar table."""
    scheduled_at = _copilot_local_naive(scheduled_at)

    if scheduled_at <= datetime.now():
        raise ValueError("Thời điểm nhắc phải ở tương lai.")

    normalized_title = (title or "Internship reminder").strip()[:255]
    normalized_message = (message or "").strip()[:4000] or None

    existing = db.execute(
        text(
            """
            SELECT id
            FROM calendar_events
            WHERE user_id = :user_id
              AND event_type = :event_type
              AND title = :title
              AND start_time = :start_time
            LIMIT 1
            """
        ),
        {
            "user_id": student_id,
            "event_type": COPILOT_REMINDER_EVENT_TYPE,
            "title": normalized_title,
            "start_time": scheduled_at,
        },
    ).scalar_one_or_none()

    if existing is not None:
        return int(existing)

    return int(
        create_calendar_event(
            db=db,
            student_id=student_id,
            title=normalized_title,
            description=normalized_message,
            event_type=COPILOT_REMINDER_EVENT_TYPE,
            start_time=scheduled_at,
            end_time=None,
            location=None,
        )
    )


def get_pending_reminders(
    db: Session,
    student_id: int,
    limit: int = 100,
):
    return db.execute(
        text(
            """
            SELECT
                id,
                title,
                description AS message,
                start_time AS scheduled_at,
                created_at
            FROM calendar_events
            WHERE user_id = :user_id
              AND event_type = :event_type
              AND start_time > NOW()
            ORDER BY start_time ASC
            LIMIT :limit
            """
        ),
        {
            "user_id": student_id,
            "event_type": COPILOT_REMINDER_EVENT_TYPE,
            "limit": limit,
        },
    ).mappings().all()


def cancel_reminder(
    db: Session,
    student_id: int,
    reminder_id: int,
) -> bool:
    row = db.execute(
        text(
            """
            DELETE FROM calendar_events
            WHERE id = :reminder_id
              AND user_id = :user_id
              AND event_type = :event_type
              AND start_time > NOW()
            RETURNING id
            """
        ),
        {
            "reminder_id": reminder_id,
            "user_id": student_id,
            "event_type": COPILOT_REMINDER_EVENT_TYPE,
        },
    ).first()

    if row is None:
        return False

    db.commit()
    return True


def deliver_due_calendar_reminders(
    db: Session,
    limit: int = 100,
) -> int:
    """Turn due calendar reminders into existing notifications exactly once."""
    rows = db.execute(
        text(
            """
            SELECT
                ce.id,
                ce.user_id,
                ce.title,
                ce.description
            FROM calendar_events AS ce
            WHERE ce.event_type = :event_type
              AND ce.start_time <= NOW()
              AND NOT EXISTS (
                    SELECT 1
                    FROM notifications AS n
                    WHERE n.user_id = ce.user_id
                      AND n.notification_type = :notification_type
                      AND n.related_type = 'CALENDAR_EVENT'
                      AND n.related_id = ce.id
              )
            ORDER BY ce.start_time ASC
            FOR UPDATE SKIP LOCKED
            LIMIT :limit
            """
        ),
        {
            "event_type": COPILOT_REMINDER_EVENT_TYPE,
            "notification_type": COPILOT_REMINDER_NOTIFICATION_TYPE,
            "limit": limit,
        },
    ).mappings().all()

    delivered = 0

    for row in rows:
        db.execute(
            text(
                """
                INSERT INTO notifications (
                    user_id,
                    title,
                    message,
                    notification_type,
                    severity,
                    related_type,
                    related_id
                )
                VALUES (
                    :user_id,
                    :title,
                    :message,
                    :notification_type,
                    'INFO',
                    'CALENDAR_EVENT',
                    :related_id
                )
                """
            ),
            {
                "user_id": row["user_id"],
                "title": row["title"],
                "message": row["description"] or row["title"],
                "notification_type": COPILOT_REMINDER_NOTIFICATION_TYPE,
                "related_id": row["id"],
            },
        )
        delivered += 1

    db.commit()
    return delivered


def generate_smart_deadline_notifications(
    db: Session,
    days_before: int | None = None,
    limit: int = 200,
) -> int:
    """Create deduplicated notifications for upcoming internship obligations."""
    if days_before is None:
        days_before = get_settings().copilot_smart_deadline_days_before

    horizon = datetime.now() + timedelta(days=days_before)

    rows = db.execute(
        text(
            """
            WITH targets AS (
                SELECT
                    i.student_id AS user_id,
                    'WEEKLY_REPORT'::text AS related_type,
                    wr.id AS related_id,
                    COALESCE(wr.title, wr.report_type || ' report') AS title,
                    wr.due_at
                FROM weekly_reports AS wr
                JOIN internships AS i
                  ON i.id = wr.internship_id
                WHERE wr.due_at > NOW()
                  AND wr.due_at <= :horizon
                  AND wr.status IN ('DRAFT', 'REVISION_REQUIRED')

                UNION ALL

                SELECT
                    i.student_id,
                    'CHECKLIST_ITEM',
                    ci.id,
                    ci.title,
                    ci.due_at
                FROM checklist_items AS ci
                JOIN internships AS i
                  ON i.id = ci.internship_id
                WHERE ci.due_at > NOW()
                  AND ci.due_at <= :horizon
                  AND ci.status <> 'COMPLETED'

                UNION ALL

                SELECT
                    i.student_id,
                    'DEADLINE',
                    d.id,
                    d.title,
                    d.due_at
                FROM internships AS i
                JOIN deadlines AS d
                  ON d.semester_id = i.semester_id
                WHERE i.status IN ('NOT_STARTED', 'IN_PROGRESS', 'PAUSED')
                  AND d.is_active = TRUE
                  AND d.due_at > NOW()
                  AND d.due_at <= :horizon
                  AND (
                        d.target_role IS NULL
                        OR d.target_role IN ('STUDENT', 'ALL')
                  )
            )
            SELECT DISTINCT
                t.user_id,
                t.related_type,
                t.related_id,
                t.title,
                t.due_at
            FROM targets AS t
            LEFT JOIN notification_preferences AS np
              ON np.user_id = t.user_id
            WHERE COALESCE(np.report_deadline, TRUE) = TRUE
            ORDER BY t.due_at ASC
            LIMIT :limit
            """
        ),
        {
            "horizon": horizon,
            "limit": limit,
        },
    ).mappings().all()

    created = 0

    for row in rows:
        exists = db.execute(
            text(
                """
                SELECT 1
                FROM notifications
                WHERE user_id = :user_id
                  AND notification_type = 'SMART_DEADLINE'
                  AND related_type = :related_type
                  AND related_id = :related_id
                  AND created_at >= NOW() - INTERVAL '7 days'
                LIMIT 1
                """
            ),
            {
                "user_id": row["user_id"],
                "related_type": row["related_type"],
                "related_id": row["related_id"],
            },
        ).first()

        if exists:
            continue

        db.execute(
            text(
                """
                INSERT INTO notifications (
                    user_id,
                    title,
                    message,
                    notification_type,
                    severity,
                    related_type,
                    related_id
                )
                VALUES (
                    :user_id,
                    :title,
                    :message,
                    'SMART_DEADLINE',
                    'WARNING',
                    :related_type,
                    :related_id
                )
                """
            ),
            {
                "user_id": row["user_id"],
                "title": f"Upcoming: {row['title']}",
                "message": f"Due at {row['due_at']}",
                "related_type": row["related_type"],
                "related_id": row["related_id"],
            },
        )
        created += 1

    db.commit()
    return created