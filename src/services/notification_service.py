from __future__ import annotations

from datetime import (
    datetime,
    timezone,
)

from sqlalchemy import text
from sqlalchemy.orm import Session


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
