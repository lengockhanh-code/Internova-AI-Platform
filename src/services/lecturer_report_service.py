from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.services.lecturer_common_service import _get_lecturer, to_iso
from src.services.score_utils import normalize_grade_score


def _submission_status(row: Any) -> str:
    submitted_at = row["submitted_at"]
    due_at = row["due_at"]

    if submitted_at is not None:
        if due_at is not None and submitted_at > due_at:
            return "LATE"
        return "ON_TIME"

    if due_at is not None and row["is_overdue"]:
        return "NOT_SUBMITTED"

    if row["report_id"] is not None:
        return "DRAFT"

    return "UPCOMING"


def _map_report(row: Any) -> dict:
    return {
        "reportId": int(row["report_id"]) if row["report_id"] else None,
        "scheduleId": int(row["schedule_id"]) if row["schedule_id"] else None,
        "internshipId": int(row["internship_id"]),
        "studentId": int(row["student_id"]),
        "studentName": row["student_name"],
        "studentCode": row["student_code"] or "",
        "className": row["class_name"] or "",
        "major": row["major"] or "",
        "periodId": int(row["period_id"]) if row["period_id"] else None,
        "periodName": row["period_name"] or "",
        "semesterCode": row["semester_code"] or "",
        "academicYear": row["academic_year"] or "",
        "companyName": row["company_name"] or "",
        "positionTitle": row["position_title"] or "",
        "reportType": row["report_type"],
        "weekNumber": row["week_number"],
        "title": row["title"] or "Báo cáo thực tập",
        "scheduleDescription": row["schedule_description"],
        "content": row["content"],
        "workflowStatus": row["workflow_status"],
        "submissionStatus": _submission_status(row),
        "dueAt": to_iso(row["due_at"]),
        "submittedAt": to_iso(row["submitted_at"]),
        "reviewedAt": to_iso(row["reviewed_at"]),
        "lateByMinutes": int(row["late_by_minutes"] or 0),
        "fileName": row["file_name"],
        "fileSize": row["file_size"],
        "mimeType": row["mime_type"],
        "completionLetterName": row["completion_letter_name"],
        "completionLetterSize": row["completion_letter_size"],
        "lecturerFeedback": row["lecturer_feedback"],
        "lecturerScore": normalize_grade_score(row["lecturer_score"]),
        "commentCount": int(row["comment_count"] or 0),
    }


def get_lecturer_reports(
    db: Session,
    lecturer_id: int | str | None = None,
) -> dict:
    lecturer = _get_lecturer(db=db, lecturer_id=lecturer_id)
    if lecturer is None:
        raise ValueError("Không tìm thấy giảng viên đang hoạt động.")

    return _get_reports(db, lecturer_id=int(lecturer["id"]))


def get_admin_reports(db: Session) -> dict:
    """Return report schedules and submissions across active internships."""
    return _get_reports(db, lecturer_id=None)


def _get_reports(db: Session, lecturer_id: int | None) -> dict:

    rows = db.execute(
        text(
            """
            WITH lecturer_internships AS (
                SELECT
                    i.id AS internship_id,
                    i.student_id,
                    i.semester_id,
                    i.position_title,
                    u.full_name AS student_name,
                    sp.student_code,
                    sp.cohort AS class_name,
                    sp.major,
                    s.name AS period_name,
                    s.semester_code,
                    s.academic_year,
                    c.name AS company_name
                FROM public.internships AS i
                INNER JOIN public.users AS u ON u.id = i.student_id
                LEFT JOIN public.student_profiles AS sp
                    ON sp.student_id = i.student_id
                LEFT JOIN public.semesters AS s ON s.id = i.semester_id
                LEFT JOIN public.companies AS c ON c.id = i.company_id
                WHERE (:lecturer_id IS NULL OR i.lecturer_id = :lecturer_id)
                  AND i.status <> 'CANCELLED'
            ),
            scheduled_reports AS (
                SELECT
                    wr.id AS report_id,
                    wrs.id AS schedule_id,
                    li.internship_id,
                    li.student_id,
                    li.student_name,
                    li.student_code,
                    li.class_name,
                    li.major,
                    li.semester_id AS period_id,
                    li.period_name,
                    li.semester_code,
                    li.academic_year,
                    li.company_name,
                    li.position_title,
                    COALESCE(wr.report_type, 'WEEKLY') AS report_type,
                    COALESCE(wr.week_number, wrs.week_number) AS week_number,
                    COALESCE(wr.title, wrs.title, 'Báo cáo tuần') AS title,
                    wrs.description AS schedule_description,
                    wr.content,
                    wr.status AS workflow_status,
                    COALESCE(wr.due_at, wrs.due_at) AS due_at,
                    wr.submitted_at,
                    wr.reviewed_at,
                    wr.file_name,
                    wr.file_size,
                    wr.mime_type,
                    wr.completion_letter_name,
                    wr.completion_letter_size,
                    wr.lecturer_feedback,
                    wr.lecturer_score,
                    COALESCE((
                        SELECT COUNT(*)
                        FROM public.report_comments AS rc
                        WHERE rc.report_id = wr.id
                    ), 0)::INTEGER AS comment_count
                FROM lecturer_internships AS li
                INNER JOIN public.weekly_report_schedules AS wrs
                    ON wrs.semester_id = li.semester_id
                LEFT JOIN public.weekly_reports AS wr
                    ON wr.internship_id = li.internship_id
                   AND wr.report_type = 'WEEKLY'
                   AND (
                        wr.schedule_id = wrs.id
                        OR (
                            wr.schedule_id IS NULL
                            AND wr.week_number = wrs.week_number
                        )
                   )
            ),
            other_reports AS (
                SELECT
                    wr.id AS report_id,
                    wr.schedule_id,
                    li.internship_id,
                    li.student_id,
                    li.student_name,
                    li.student_code,
                    li.class_name,
                    li.major,
                    li.semester_id AS period_id,
                    li.period_name,
                    li.semester_code,
                    li.academic_year,
                    li.company_name,
                    li.position_title,
                    wr.report_type,
                    wr.week_number,
                    COALESCE(wr.title, 'Báo cáo thực tập') AS title,
                    wrs.description AS schedule_description,
                    wr.content,
                    wr.status AS workflow_status,
                    COALESCE(wr.due_at, wrs.due_at) AS due_at,
                    wr.submitted_at,
                    wr.reviewed_at,
                    wr.file_name,
                    wr.file_size,
                    wr.mime_type,
                    wr.completion_letter_name,
                    wr.completion_letter_size,
                    wr.lecturer_feedback,
                    wr.lecturer_score,
                    COALESCE((
                        SELECT COUNT(*)
                        FROM public.report_comments AS rc
                        WHERE rc.report_id = wr.id
                    ), 0)::INTEGER AS comment_count
                FROM lecturer_internships AS li
                INNER JOIN public.weekly_reports AS wr
                    ON wr.internship_id = li.internship_id
                LEFT JOIN public.weekly_report_schedules AS wrs
                    ON wrs.id = wr.schedule_id
                WHERE wr.report_type <> 'WEEKLY'
                   OR NOT EXISTS (
                        SELECT 1
                        FROM public.weekly_report_schedules AS matched
                        WHERE matched.semester_id = li.semester_id
                          AND (
                              matched.id = wr.schedule_id
                              OR (
                                  wr.schedule_id IS NULL
                                  AND matched.week_number = wr.week_number
                              )
                          )
                   )
            ),
            all_reports AS (
                SELECT * FROM scheduled_reports
                UNION ALL
                SELECT * FROM other_reports
            )
            SELECT
                ar.*,
                (
                    ar.submitted_at IS NULL
                    AND ar.due_at IS NOT NULL
                    AND ar.due_at < NOW()
                ) AS is_overdue,
                CASE
                    WHEN ar.submitted_at IS NOT NULL
                     AND ar.due_at IS NOT NULL
                     AND ar.submitted_at > ar.due_at
                    THEN FLOOR(
                        EXTRACT(EPOCH FROM (ar.submitted_at - ar.due_at)) / 60
                    )::INTEGER
                    ELSE 0
                END AS late_by_minutes
            FROM all_reports AS ar
            ORDER BY
                COALESCE(ar.submitted_at, ar.due_at) DESC NULLS LAST,
                ar.student_name ASC,
                ar.week_number DESC NULLS LAST
            """
        ),
        {"lecturer_id": lecturer_id},
    ).mappings().all()

    reports = [_map_report(row) for row in rows]

    period_rows = db.execute(
        text(
            """
            SELECT DISTINCT
                s.id,
                s.name,
                s.semester_code,
                s.academic_year,
                s.start_date
            FROM public.internships AS i
            INNER JOIN public.semesters AS s ON s.id = i.semester_id
            WHERE (:lecturer_id IS NULL OR i.lecturer_id = :lecturer_id)
              AND i.status <> 'CANCELLED'
            ORDER BY s.start_date DESC NULLS LAST, s.id DESC
            """
        ),
        {"lecturer_id": lecturer_id},
    ).mappings().all()

    submitted = sum(1 for item in reports if item["submittedAt"] is not None)

    return {
        "summary": {
            "total": len(reports),
            "submitted": submitted,
            "onTime": sum(
                1 for item in reports if item["submissionStatus"] == "ON_TIME"
            ),
            "late": sum(
                1 for item in reports if item["submissionStatus"] == "LATE"
            ),
            "overdue": sum(
                1
                for item in reports
                if item["submissionStatus"] == "NOT_SUBMITTED"
            ),
            "pendingReview": sum(
                1
                for item in reports
                if item["workflowStatus"] in {"SUBMITTED", "LATE", "UNDER_REVIEW"}
            ),
            "approved": sum(
                1 for item in reports if item["workflowStatus"] == "APPROVED"
            ),
        },
        "periods": [
            {
                "id": int(row["id"]),
                "name": row["name"],
                "semesterCode": row["semester_code"] or "",
                "academicYear": row["academic_year"] or "",
            }
            for row in period_rows
        ],
        "reports": reports,
    }


def get_lecturer_report_detail(
    db: Session,
    report_id: int,
    lecturer_id: int | str | None = None,
) -> dict:
    data = get_lecturer_reports(db=db, lecturer_id=lecturer_id)
    report = next(
        (item for item in data["reports"] if item["reportId"] == report_id),
        None,
    )
    if report is None:
        raise ValueError("Không tìm thấy báo cáo thuộc quyền hướng dẫn của bạn.")

    comments = db.execute(
        text(
            """
            SELECT
                rc.id,
                rc.user_id,
                u.full_name AS user_name,
                u.role AS user_role,
                rc.comment,
                rc.parent_comment_id,
                rc.created_at
            FROM public.report_comments AS rc
            INNER JOIN public.users AS u ON u.id = rc.user_id
            WHERE rc.report_id = :report_id
            ORDER BY rc.created_at ASC, rc.id ASC
            """
        ),
        {"report_id": report_id},
    ).mappings().all()

    return {
        "report": report,
        "comments": [
            {
                "id": int(row["id"]),
                "userId": int(row["user_id"]),
                "userName": row["user_name"],
                "userRole": row["user_role"],
                "comment": row["comment"],
                "parentCommentId": (
                    int(row["parent_comment_id"])
                    if row["parent_comment_id"]
                    else None
                ),
                "createdAt": to_iso(row["created_at"]),
            }
            for row in comments
        ],
    }


def review_lecturer_report(
    db: Session,
    report_id: int,
    payload,
    lecturer_id: int | str | None = None,
) -> dict:
    lecturer = _get_lecturer(db=db, lecturer_id=lecturer_id)
    if lecturer is None:
        raise ValueError("Không tìm thấy giảng viên đang hoạt động.")

    feedback = (payload.feedback or "").strip()
    if payload.status == "REVISION_REQUIRED" and not feedback:
        raise ValueError("Vui lòng nhập phản hồi khi yêu cầu sinh viên chỉnh sửa.")
    if payload.status == "APPROVED" and payload.score is None:
        raise ValueError("Vui lòng nhập điểm trước khi duyệt báo cáo.")

    try:
        updated = db.execute(
            text(
                """
                UPDATE public.weekly_reports AS wr
                SET status = :status,
                    lecturer_feedback = :feedback,
                    lecturer_score = :score,
                    reviewed_at = NOW(),
                    updated_at = NOW()
                FROM public.internships AS i
                WHERE wr.id = :report_id
                  AND wr.internship_id = i.id
                  AND i.lecturer_id = :lecturer_id
                  AND wr.submitted_at IS NOT NULL
                RETURNING wr.id, i.student_id, wr.title
                """
            ),
            {
                "report_id": report_id,
                "lecturer_id": int(lecturer["id"]),
                "status": payload.status,
                "feedback": feedback or None,
                "score": payload.score if payload.status == "APPROVED" else None,
            },
        ).mappings().first()

        if updated is None:
            raise ValueError(
                "Không tìm thấy báo cáo đã nộp thuộc quyền chấm của bạn."
            )

        notification_message = (
            "Báo cáo của bạn đã được giảng viên duyệt."
            if payload.status == "APPROVED"
            else "Giảng viên yêu cầu bạn chỉnh sửa và nộp lại báo cáo."
        )
        db.execute(
            text(
                """
                INSERT INTO public.notifications (
                    user_id, title, message, notification_type,
                    severity, related_type, related_id
                )
                VALUES (
                    :student_id, :title, :message, 'REPORT_REVIEW',
                    :severity, 'WEEKLY_REPORT', :report_id
                )
                """
            ),
            {
                "student_id": int(updated["student_id"]),
                "title": (
                    "Báo cáo đã được duyệt"
                    if payload.status == "APPROVED"
                    else "Báo cáo cần chỉnh sửa"
                ),
                "message": notification_message,
                "severity": (
                    "SUCCESS" if payload.status == "APPROVED" else "WARNING"
                ),
                "report_id": report_id,
            },
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "reportId": int(updated["id"]),
        "message": "Đã cập nhật đánh giá báo cáo.",
    }


def add_lecturer_report_comment(
    db: Session,
    report_id: int,
    payload,
    lecturer_id: int | str | None = None,
) -> dict:
    lecturer = _get_lecturer(db=db, lecturer_id=lecturer_id)
    if lecturer is None:
        raise ValueError("Không tìm thấy giảng viên đang hoạt động.")

    comment = (payload.comment or "").strip()
    if not comment:
        raise ValueError("Nội dung trao đổi không được để trống.")

    report = db.execute(
        text(
            """
            SELECT wr.id, i.student_id
            FROM public.weekly_reports AS wr
            INNER JOIN public.internships AS i ON i.id = wr.internship_id
            WHERE wr.id = :report_id
              AND i.lecturer_id = :lecturer_id
            LIMIT 1
            """
        ),
        {"report_id": report_id, "lecturer_id": int(lecturer["id"])},
    ).mappings().first()
    if report is None:
        raise ValueError("Không tìm thấy báo cáo thuộc quyền hướng dẫn của bạn.")

    if payload.parentCommentId is not None:
        parent_exists = db.execute(
            text(
                """
                SELECT 1 FROM public.report_comments
                WHERE id = :comment_id AND report_id = :report_id
                """
            ),
            {"comment_id": payload.parentCommentId, "report_id": report_id},
        ).first()
        if parent_exists is None:
            raise ValueError("Bình luận được trả lời không tồn tại.")

    try:
        created = db.execute(
            text(
                """
                INSERT INTO public.report_comments (
                    report_id, user_id, comment, parent_comment_id
                )
                VALUES (:report_id, :user_id, :comment, :parent_comment_id)
                RETURNING id, user_id, comment, parent_comment_id, created_at
                """
            ),
            {
                "report_id": report_id,
                "user_id": int(lecturer["id"]),
                "comment": comment,
                "parent_comment_id": payload.parentCommentId,
            },
        ).mappings().first()

        db.execute(
            text(
                """
                INSERT INTO public.notifications (
                    user_id, title, message, notification_type,
                    severity, related_type, related_id
                )
                VALUES (
                    :student_id, 'Giảng viên phản hồi báo cáo', :message,
                    'REPORT_COMMENT', 'INFO', 'WEEKLY_REPORT', :report_id
                )
                """
            ),
            {
                "student_id": int(report["student_id"]),
                "message": comment[:500],
                "report_id": report_id,
            },
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "comment": {
            "id": int(created["id"]),
            "userId": int(created["user_id"]),
            "userName": lecturer["full_name"],
            "userRole": "LECTURER",
            "comment": created["comment"],
            "parentCommentId": (
                int(created["parent_comment_id"])
                if created["parent_comment_id"]
                else None
            ),
            "createdAt": to_iso(created["created_at"]),
        }
    }


def get_lecturer_report_file(
    db: Session,
    report_id: int,
    completion_letter: bool = False,
    lecturer_id: int | str | None = None,
):
    lecturer = _get_lecturer(db=db, lecturer_id=lecturer_id)
    if lecturer is None:
        return None

    if completion_letter:
        columns = (
            "wr.completion_letter_data AS file_data, "
            "wr.completion_letter_name AS file_name, "
            "wr.completion_letter_mime_type AS mime_type, "
            "wr.completion_letter_size AS file_size"
        )
    else:
        columns = (
            "wr.file_data, wr.file_name, wr.mime_type, wr.file_size"
        )

    return db.execute(
        text(
            f"""
            SELECT {columns}
            FROM public.weekly_reports AS wr
            INNER JOIN public.internships AS i ON i.id = wr.internship_id
            WHERE wr.id = :report_id
              AND i.lecturer_id = :lecturer_id
            LIMIT 1
            """
        ),
        {"report_id": report_id, "lecturer_id": int(lecturer["id"])},
    ).mappings().first()
