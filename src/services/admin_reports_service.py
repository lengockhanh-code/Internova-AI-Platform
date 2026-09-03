from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.services.lecturer_common_service import to_iso
from src.services.lecturer_report_service import get_admin_reports


class AdminReportNotFoundError(ValueError):
    pass


def _lecturer(row) -> dict | None:
    if row["lecturer_id"] is None:
        return None
    return {
        "id": int(row["lecturer_id"]),
        "fullName": row["lecturer_name"] or "",
        "lecturerCode": row["lecturer_code"] or "",
        "faculty": row["lecturer_faculty"] or "",
    }


def list_admin_reports(db: Session) -> dict:
    data = get_admin_reports(db)
    assignment_rows = db.execute(
        text(
            """
            SELECT i.id AS internship_id,
                lecturer.id AS lecturer_id,
                lecturer.full_name AS lecturer_name,
                lp.lecturer_code,
                lp.faculty AS lecturer_faculty
            FROM public.internships AS i
            LEFT JOIN public.users AS lecturer ON lecturer.id = i.lecturer_id
            LEFT JOIN public.lecturer_profiles AS lp
                ON lp.lecturer_id = lecturer.id
            WHERE i.status <> 'CANCELLED'
            ORDER BY lecturer.full_name ASC NULLS LAST, i.id ASC
            """
        )
    ).mappings().all()
    assignments = {
        int(row["internship_id"]): _lecturer(row) for row in assignment_rows
    }
    reports = [
        {
            **report,
            "assignedLecturer": assignments.get(report["internshipId"]),
        }
        for report in data["reports"]
    ]

    lecturers_by_id = {
        lecturer["id"]: lecturer
        for lecturer in assignments.values()
        if lecturer is not None
    }
    scores = [
        float(report["lecturerScore"])
        for report in reports
        if report["lecturerScore"] is not None
    ]
    summary = {
        **data["summary"],
        "students": len({report["studentId"] for report in reports}),
        "revisionRequired": sum(
            report["workflowStatus"] == "REVISION_REQUIRED" for report in reports
        ),
        "averageScore": round(sum(scores) / len(scores), 2) if scores else None,
    }
    return {
        "summary": summary,
        "periods": data["periods"],
        "lecturers": sorted(
            lecturers_by_id.values(), key=lambda item: item["fullName"].lower()
        ),
        "reports": reports,
    }


def get_admin_report_detail(db: Session, report_id: int) -> dict:
    data = list_admin_reports(db)
    report = next(
        (item for item in data["reports"] if item["reportId"] == report_id),
        None,
    )
    if report is None:
        raise AdminReportNotFoundError("Không tìm thấy báo cáo thực tập.")

    comments = db.execute(
        text(
            """
            SELECT rc.id, rc.user_id, u.full_name AS user_name,
                u.role AS user_role, rc.comment, rc.parent_comment_id,
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


def get_admin_report_file(
    db: Session,
    report_id: int,
    completion_letter: bool = False,
):
    if completion_letter:
        columns = (
            "completion_letter_data AS file_data, "
            "completion_letter_name AS file_name, "
            "completion_letter_mime_type AS mime_type, "
            "completion_letter_size AS file_size"
        )
    else:
        columns = "file_data, file_name, mime_type, file_size"

    return db.execute(
        text(
            f"""
            SELECT {columns}
            FROM public.weekly_reports
            WHERE id = :report_id
            LIMIT 1
            """
        ),
        {"report_id": report_id},
    ).mappings().first()
