from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.models.lecturer_reminders import LecturerReminderMessageCreate
from src.services.lecturer_common_service import _get_lecturer, to_iso


def _lecturer_id(db: Session, lecturer_id: int | str | None) -> int:
    lecturer = _get_lecturer(db=db, lecturer_id=lecturer_id)
    if lecturer is None:
        raise ValueError("Không tìm thấy giảng viên đang hoạt động.")
    return int(lecturer["id"])


def _map_student(row: Any) -> dict:
    warning_count = (
        int(row["overdue_report_count"] or 0)
        + int(row["late_report_count"] or 0)
        + (1 if row["progress_behind"] else 0)
    )
    return {
        "studentId": int(row["student_id"]),
        "internshipId": int(row["internship_id"]),
        "studentName": row["student_name"],
        "studentCode": row["student_code"] or "",
        "className": row["class_name"] or "",
        "major": row["major"] or "",
        "avatarUrl": row["avatar_url"],
        "companyName": row["company_name"] or "",
        "positionTitle": row["position_title"] or "",
        "internshipStatus": row["internship_status"],
        "progressPercentage": float(row["progress_percentage"] or 0),
        "overdueReportCount": int(row["overdue_report_count"] or 0),
        "lateReportCount": int(row["late_report_count"] or 0),
        "pendingReviewCount": int(row["pending_review_count"] or 0),
        "progressBehind": bool(row["progress_behind"]),
        "warningCount": warning_count,
        "messageCount": int(row["message_count"] or 0),
        "unreadMessageCount": int(row["unread_message_count"] or 0),
        "latestMessage": row["latest_message"],
        "latestMessageType": row["latest_message_type"],
        "latestMessageAt": to_iso(row["latest_message_at"]),
    }


def _students(db: Session, lecturer_id: int) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT
                i.id AS internship_id,
                u.id AS student_id,
                u.full_name AS student_name,
                u.avatar_url,
                sp.student_code,
                sp.cohort AS class_name,
                sp.major,
                c.name AS company_name,
                i.position_title,
                i.status AS internship_status,
                i.progress_percentage,
                COALESCE(report_stats.late_report_count, 0)
                    AS late_report_count,
                COALESCE(report_stats.pending_review_count, 0)
                    AS pending_review_count,
                COALESCE(schedule_stats.overdue_report_count, 0)
                    AS overdue_report_count,
                (
                    i.status = 'IN_PROGRESS'
                    AND i.start_date IS NOT NULL
                    AND i.end_date IS NOT NULL
                    AND i.end_date > i.start_date
                    AND CURRENT_DATE > i.start_date
                    AND i.progress_percentage + 15 < LEAST(
                        100,
                        GREATEST(
                            0,
                            (
                                (CURRENT_DATE - i.start_date)::NUMERIC
                                / NULLIF(i.end_date - i.start_date, 0)
                            ) * 100
                        )
                    )
                ) AS progress_behind,
                COALESCE(message_stats.message_count, 0) AS message_count,
                COALESCE(message_stats.unread_message_count, 0)
                    AS unread_message_count,
                latest_message.content AS latest_message,
                latest_message.message_type AS latest_message_type,
                latest_message.created_at AS latest_message_at
            FROM public.internships AS i
            INNER JOIN public.users AS u ON u.id = i.student_id
            LEFT JOIN public.student_profiles AS sp ON sp.student_id = u.id
            LEFT JOIN public.companies AS c ON c.id = i.company_id
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(*) FILTER (
                        WHERE wr.submitted_at IS NOT NULL
                          AND wr.due_at IS NOT NULL
                          AND wr.submitted_at > wr.due_at
                    )::INTEGER AS late_report_count,
                    COUNT(*) FILTER (
                        WHERE wr.status IN (
                            'SUBMITTED', 'LATE', 'UNDER_REVIEW'
                        )
                    )::INTEGER AS pending_review_count
                FROM public.weekly_reports AS wr
                WHERE wr.internship_id = i.id
            ) AS report_stats ON TRUE
            LEFT JOIN LATERAL (
                SELECT COUNT(*)::INTEGER AS overdue_report_count
                FROM public.weekly_report_schedules AS wrs
                WHERE wrs.semester_id = i.semester_id
                  AND wrs.due_at < NOW()
                  AND NOT EXISTS (
                      SELECT 1
                      FROM public.weekly_reports AS wr
                      WHERE wr.internship_id = i.id
                        AND wr.report_type = 'WEEKLY'
                        AND (
                            wr.schedule_id = wrs.id
                            OR (
                                wr.schedule_id IS NULL
                                AND wr.week_number = wrs.week_number
                            )
                        )
                        AND wr.submitted_at IS NOT NULL
                  )
            ) AS schedule_stats ON TRUE
            LEFT JOIN LATERAL (
                SELECT
                    COUNT(*)::INTEGER AS message_count,
                    COUNT(*) FILTER (
                        WHERE m.is_read = FALSE
                    )::INTEGER AS unread_message_count
                FROM public.lecturer_student_messages AS m
                WHERE m.lecturer_id = :lecturer_id
                  AND m.student_id = i.student_id
            ) AS message_stats ON TRUE
            LEFT JOIN LATERAL (
                SELECT m.content, m.message_type, m.created_at
                FROM public.lecturer_student_messages AS m
                WHERE m.lecturer_id = :lecturer_id
                  AND m.student_id = i.student_id
                ORDER BY m.created_at DESC, m.id DESC
                LIMIT 1
            ) AS latest_message ON TRUE
            WHERE i.lecturer_id = :lecturer_id
              AND i.status <> 'CANCELLED'
              AND i.id = (
                  SELECT i2.id
                  FROM public.internships AS i2
                  WHERE i2.student_id = i.student_id
                    AND i2.lecturer_id = :lecturer_id
                    AND i2.status <> 'CANCELLED'
                  ORDER BY i2.created_at DESC, i2.id DESC
                  LIMIT 1
              )
            ORDER BY
                (
                    COALESCE(schedule_stats.overdue_report_count, 0)
                    + COALESCE(report_stats.late_report_count, 0)
                    + CASE WHEN (
                        i.status = 'IN_PROGRESS'
                        AND i.start_date IS NOT NULL
                        AND i.end_date IS NOT NULL
                        AND i.end_date > i.start_date
                        AND CURRENT_DATE > i.start_date
                        AND i.progress_percentage + 15 < LEAST(
                            100,
                            GREATEST(
                                0,
                                (
                                    (CURRENT_DATE - i.start_date)::NUMERIC
                                    / NULLIF(i.end_date - i.start_date, 0)
                                ) * 100
                            )
                        )
                    ) THEN 1 ELSE 0 END
                ) DESC,
                latest_message.created_at DESC NULLS LAST,
                u.full_name
            """
        ),
        {"lecturer_id": lecturer_id},
    ).mappings().all()
    return [_map_student(row) for row in rows]


def get_lecturer_reminders(
    db: Session,
    lecturer_id: int | str | None = None,
) -> dict:
    current_lecturer_id = _lecturer_id(db, lecturer_id)
    students = _students(db, current_lecturer_id)
    return {
        "summary": {
            "totalStudents": len(students),
            "needsAttention": sum(item["warningCount"] > 0 for item in students),
            "sentMessages": sum(item["messageCount"] for item in students),
            "unreadByStudents": sum(item["unreadMessageCount"] for item in students),
        },
        "students": students,
    }


def get_lecturer_reminder_conversation(
    db: Session,
    student_id: int,
    lecturer_id: int | str | None = None,
) -> dict:
    current_lecturer_id = _lecturer_id(db, lecturer_id)
    student = next(
        (
            item
            for item in _students(db, current_lecturer_id)
            if item["studentId"] == student_id
        ),
        None,
    )
    if student is None:
        raise ValueError("Không tìm thấy sinh viên thuộc quyền phụ trách của bạn.")

    alerts: list[dict] = []
    if student["progressBehind"]:
        alerts.append(
            {
                "key": "progress-behind",
                "severity": "WARNING",
                "title": "Tiến độ thấp hơn kế hoạch",
                "description": (
                    f"Tiến độ hiện tại là {student['progressPercentage']:.0f}%, "
                    "thấp hơn mốc dự kiến của kỳ thực tập."
                ),
            }
        )

    overdue_rows = db.execute(
        text(
            """
            SELECT wrs.id, wrs.title, wrs.week_number, wrs.due_at
            FROM public.weekly_report_schedules AS wrs
            INNER JOIN public.internships AS i
                ON i.semester_id = wrs.semester_id
            WHERE i.id = :internship_id
              AND wrs.due_at < NOW()
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.weekly_reports AS wr
                  WHERE wr.internship_id = i.id
                    AND wr.report_type = 'WEEKLY'
                    AND (
                        wr.schedule_id = wrs.id
                        OR (
                            wr.schedule_id IS NULL
                            AND wr.week_number = wrs.week_number
                        )
                    )
                    AND wr.submitted_at IS NOT NULL
              )
            ORDER BY wrs.due_at DESC
            """
        ),
        {"internship_id": student["internshipId"]},
    ).mappings().all()
    for row in overdue_rows:
        alerts.append(
            {
                "key": f"overdue-{row['id']}",
                "severity": "ERROR",
                "title": f"Quá hạn {row['title'] or ('Báo cáo tuần ' + str(row['week_number']))}",
                "description": "Sinh viên chưa nộp báo cáo theo lịch yêu cầu.",
                "relatedId": int(row["id"]),
                "occurredAt": to_iso(row["due_at"]),
            }
        )

    late_rows = db.execute(
        text(
            """
            SELECT id, title, submitted_at
            FROM public.weekly_reports
            WHERE internship_id = :internship_id
              AND submitted_at IS NOT NULL
              AND due_at IS NOT NULL
              AND submitted_at > due_at
            ORDER BY submitted_at DESC
            """
        ),
        {"internship_id": student["internshipId"]},
    ).mappings().all()
    for row in late_rows:
        alerts.append(
            {
                "key": f"late-{row['id']}",
                "severity": "WARNING",
                "title": "Báo cáo nộp muộn",
                "description": row["title"] or "Báo cáo thực tập được nộp sau hạn.",
                "relatedId": int(row["id"]),
                "occurredAt": to_iso(row["submitted_at"]),
            }
        )

    message_rows = db.execute(
        text(
            """
            SELECT id, message_type, content, is_read, read_at, created_at
            FROM public.lecturer_student_messages
            WHERE lecturer_id = :lecturer_id
              AND student_id = :student_id
            ORDER BY created_at, id
            LIMIT 200
            """
        ),
        {
            "lecturer_id": current_lecturer_id,
            "student_id": student_id,
        },
    ).mappings().all()

    return {
        "student": student,
        "alerts": alerts,
        "messages": [
            {
                "id": int(row["id"]),
                "messageType": row["message_type"],
                "content": row["content"],
                "isRead": bool(row["is_read"]),
                "readAt": to_iso(row["read_at"]),
                "createdAt": to_iso(row["created_at"]),
            }
            for row in message_rows
        ],
    }


def send_lecturer_reminder_message(
    db: Session,
    student_id: int,
    payload: LecturerReminderMessageCreate,
    lecturer_id: int | str | None = None,
) -> dict:
    current_lecturer_id = _lecturer_id(db, lecturer_id)
    content = payload.content.strip()
    if not content:
        raise ValueError("Nội dung tin nhắn không được để trống.")

    internship = db.execute(
        text(
            """
            SELECT id
            FROM public.internships
            WHERE student_id = :student_id
              AND lecturer_id = :lecturer_id
              AND status <> 'CANCELLED'
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            FOR UPDATE
            """
        ),
        {
            "student_id": student_id,
            "lecturer_id": current_lecturer_id,
        },
    ).mappings().first()
    if internship is None:
        raise ValueError("Không tìm thấy sinh viên thuộc quyền phụ trách của bạn.")

    titles = {
        "MESSAGE": "Tin nhắn từ giảng viên",
        "REMINDER": "Lời nhắc từ giảng viên",
        "WARNING": "Cảnh báo từ giảng viên",
    }
    severities = {
        "MESSAGE": "INFO",
        "REMINDER": "WARNING",
        "WARNING": "ERROR",
    }

    try:
        row = db.execute(
            text(
                """
                INSERT INTO public.lecturer_student_messages (
                    lecturer_id, student_id, internship_id,
                    message_type, content
                ) VALUES (
                    :lecturer_id, :student_id, :internship_id,
                    :message_type, :content
                )
                RETURNING id, message_type, content, is_read, read_at, created_at
                """
            ),
            {
                "lecturer_id": current_lecturer_id,
                "student_id": student_id,
                "internship_id": int(internship["id"]),
                "message_type": payload.messageType,
                "content": content,
            },
        ).mappings().one()
        notification_id = db.execute(
            text(
                """
                INSERT INTO public.notifications (
                    user_id, title, message, notification_type, severity,
                    related_type, related_id
                ) VALUES (
                    :student_id, :title, :message, :notification_type,
                    :severity, 'LECTURER_STUDENT_MESSAGE', :message_id
                )
                RETURNING id
                """
            ),
            {
                "student_id": student_id,
                "title": titles[payload.messageType],
                "message": content,
                "notification_type": f"LECTURER_{payload.messageType}",
                "severity": severities[payload.messageType],
                "message_id": int(row["id"]),
            },
        ).scalar_one()
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "message": {
            "id": int(row["id"]),
            "messageType": row["message_type"],
            "content": row["content"],
            "isRead": bool(row["is_read"]),
            "readAt": to_iso(row["read_at"]),
            "createdAt": to_iso(row["created_at"]),
        },
        "notificationId": int(notification_id),
    }