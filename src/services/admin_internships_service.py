from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.services.lecturer_application_service import review_lecturer_application
from src.services.lecturer_common_service import to_iso

VISIBLE_STATUSES = ("SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED")


class AdminInternshipNotFoundError(ValueError):
    pass


def _lecturer(row, prefix: str = "lecturer") -> dict | None:
    lecturer_id = row.get(f"{prefix}_id")
    if lecturer_id is None:
        return None
    return {
        "id": int(lecturer_id),
        "fullName": row.get(f"{prefix}_name") or "",
        "lecturerCode": row.get(f"{prefix}_code") or "",
        "faculty": row.get(f"{prefix}_faculty") or "",
    }


def list_admin_internships(db: Session) -> dict:
    rows = (
        db.execute(
            text(
                """
            SELECT
                ia.id AS application_id, ia.student_id,
                student.full_name AS student_name, sp.student_code,
                sp.cohort AS class_name, sp.major,
                s.id AS period_id, s.name AS period_name,
                c.name AS company_name,
                ia.position_title AS internship_position, ia.work_mode,
                ia.status, ia.submitted_at, ia.reviewed_at,
                COUNT(DISTINCT ad.id)::INTEGER AS document_count,
                MAX(i.id)::BIGINT AS internship_id,
                lecturer.id AS lecturer_id,
                lecturer.full_name AS lecturer_name,
                lp.lecturer_code, lp.faculty AS lecturer_faculty
            FROM public.internship_applications AS ia
            INNER JOIN public.users AS student ON student.id = ia.student_id
            LEFT JOIN public.student_profiles AS sp ON sp.student_id = ia.student_id
            LEFT JOIN public.semesters AS s ON s.id = ia.semester_id
            LEFT JOIN public.companies AS c ON c.id = ia.company_id
            LEFT JOIN public.application_documents AS ad ON ad.application_id = ia.id
            LEFT JOIN public.internships AS i ON i.application_id = ia.id
            LEFT JOIN public.users AS lecturer
                ON lecturer.id = ia.assigned_lecturer_id
            LEFT JOIN public.lecturer_profiles AS lp
                ON lp.lecturer_id = lecturer.id
            WHERE ia.status IN (
                'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'
            )
            GROUP BY
                ia.id, ia.student_id, student.full_name, sp.student_code,
                sp.cohort, sp.major, s.id, s.name, c.name,
                ia.position_title, ia.work_mode, ia.status,
                ia.submitted_at, ia.reviewed_at, lecturer.id,
                lecturer.full_name, lp.lecturer_code, lp.faculty
            ORDER BY
                CASE ia.status
                    WHEN 'SUBMITTED' THEN 1
                    WHEN 'UNDER_REVIEW' THEN 2
                    WHEN 'REJECTED' THEN 3
                    ELSE 4
                END,
                ia.submitted_at DESC NULLS LAST, ia.id DESC
            """
            )
        )
        .mappings()
        .all()
    )

    applications = [
        {
            "applicationId": int(row["application_id"]),
            "studentId": int(row["student_id"]),
            "studentName": row["student_name"],
            "studentCode": row["student_code"] or "",
            "className": row["class_name"] or "",
            "major": row["major"] or "",
            "periodId": int(row["period_id"]) if row["period_id"] else None,
            "periodName": row["period_name"] or "",
            "companyName": row["company_name"] or "",
            "internshipPosition": row["internship_position"] or "",
            "workMode": row["work_mode"],
            "status": row["status"],
            "submittedAt": to_iso(row["submitted_at"]),
            "reviewedAt": to_iso(row["reviewed_at"]),
            "documentCount": int(row["document_count"] or 0),
            "internshipId": int(row["internship_id"]) if row["internship_id"] else None,
            "assignedLecturer": _lecturer(row),
        }
        for row in rows
    ]

    period_rows = (
        db.execute(
            text(
                """
            SELECT DISTINCT s.id, s.name, s.semester_code, s.academic_year,
                s.start_date
            FROM public.internship_applications AS ia
            INNER JOIN public.semesters AS s ON s.id = ia.semester_id
            WHERE ia.status IN (
                'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'
            )
            ORDER BY s.start_date DESC NULLS LAST, s.id DESC
            """
            )
        )
        .mappings()
        .all()
    )
    lecturer_rows = (
        db.execute(
            text(
                """
            SELECT u.id AS lecturer_id, u.full_name AS lecturer_name,
                lp.lecturer_code, lp.faculty AS lecturer_faculty
            FROM public.users AS u
            LEFT JOIN public.lecturer_profiles AS lp ON lp.lecturer_id = u.id
            WHERE u.role = 'LECTURER' AND u.is_active = TRUE
            ORDER BY u.full_name ASC, u.id ASC
            """
            )
        )
        .mappings()
        .all()
    )

    return {
        "summary": {
            "total": len(applications),
            "submitted": sum(item["status"] == "SUBMITTED" for item in applications),
            "underReview": sum(item["status"] == "UNDER_REVIEW" for item in applications),
            "approved": sum(item["status"] == "APPROVED" for item in applications),
            "rejected": sum(item["status"] == "REJECTED" for item in applications),
            "unassigned": sum(item["assignedLecturer"] is None for item in applications),
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
        "lecturers": [_lecturer(row) for row in lecturer_rows],
        "applications": applications,
    }


def get_admin_internship_detail(db: Session, application_id: int) -> dict:
    row = (
        db.execute(
            text(
                """
            SELECT
                ia.id AS application_id, ia.status, ia.internship_type,
                ia.description, ia.position_title AS internship_position,
                ia.work_mode, ia.credits, ia.expected_start_date,
                ia.expected_end_date, ia.submitted_at, ia.reviewed_at,
                ia.lecturer_comment,
                student.id AS student_id, student.full_name AS student_name,
                student.email AS student_email, student.phone AS student_phone,
                sp.student_code, sp.faculty, sp.major,
                sp.cohort AS class_name,
                s.id AS period_id, s.name AS period_name,
                s.semester_code, s.academic_year,
                c.id AS company_id, c.name AS company_name, c.industry,
                c.address AS company_address, c.website AS company_website,
                cm.id AS mentor_id, cm.full_name AS mentor_name,
                cm.position AS mentor_position, cm.department AS mentor_department,
                cm.email AS mentor_email, cm.phone AS mentor_phone,
                i.id AS internship_id,
                lecturer.id AS lecturer_id,
                lecturer.full_name AS lecturer_name,
                lp.lecturer_code, lp.faculty AS lecturer_faculty
            FROM public.internship_applications AS ia
            INNER JOIN public.users AS student ON student.id = ia.student_id
            LEFT JOIN public.student_profiles AS sp ON sp.student_id = ia.student_id
            LEFT JOIN public.semesters AS s ON s.id = ia.semester_id
            LEFT JOIN public.companies AS c ON c.id = ia.company_id
            LEFT JOIN public.company_mentors AS cm ON cm.id = ia.company_mentor_id
            LEFT JOIN public.internships AS i ON i.application_id = ia.id
            LEFT JOIN public.users AS lecturer
                ON lecturer.id = ia.assigned_lecturer_id
            LEFT JOIN public.lecturer_profiles AS lp
                ON lp.lecturer_id = lecturer.id
            WHERE ia.id = :application_id
              AND ia.status IN (
                  'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'
              )
            LIMIT 1
            """
            ),
            {"application_id": application_id},
        )
        .mappings()
        .first()
    )
    if row is None:
        raise AdminInternshipNotFoundError("Không tìm thấy hồ sơ đăng ký thực tập.")

    documents = (
        db.execute(
            text(
                """
            SELECT id, document_type, title, original_file_name,
                mime_type, file_size, created_at
            FROM public.application_documents
            WHERE application_id = :application_id AND student_id = :student_id
            ORDER BY created_at ASC, id ASC
            """
            ),
            {"application_id": application_id, "student_id": int(row["student_id"])},
        )
        .mappings()
        .all()
    )

    return {
        "application": {
            "applicationId": int(row["application_id"]),
            "status": row["status"],
            "internshipType": row["internship_type"],
            "description": row["description"],
            "internshipPosition": row["internship_position"] or "",
            "workMode": row["work_mode"],
            "credits": row["credits"],
            "startDate": to_iso(row["expected_start_date"]),
            "endDate": to_iso(row["expected_end_date"]),
            "submittedAt": to_iso(row["submitted_at"]),
            "reviewedAt": to_iso(row["reviewed_at"]),
            "lecturerComment": row["lecturer_comment"],
            "internshipId": int(row["internship_id"]) if row["internship_id"] else None,
            "period": (
                {
                    "id": int(row["period_id"]),
                    "name": row["period_name"],
                    "semesterCode": row["semester_code"] or "",
                    "academicYear": row["academic_year"] or "",
                }
                if row["period_id"]
                else None
            ),
            "assignedLecturer": _lecturer(row),
            "student": {
                "id": int(row["student_id"]),
                "fullName": row["student_name"],
                "studentCode": row["student_code"] or "",
                "email": str(row["student_email"]),
                "phone": row["student_phone"],
                "faculty": row["faculty"],
                "major": row["major"],
                "className": row["class_name"],
            },
            "company": {
                "id": int(row["company_id"]) if row["company_id"] else None,
                "name": row["company_name"] or "",
                "industry": row["industry"],
                "address": row["company_address"],
                "website": row["company_website"],
            },
            "mentor": {
                "id": int(row["mentor_id"]) if row["mentor_id"] else None,
                "fullName": row["mentor_name"] or "",
                "position": row["mentor_position"],
                "department": row["mentor_department"],
                "email": str(row["mentor_email"]) if row["mentor_email"] else None,
                "phone": row["mentor_phone"],
            },
            "documents": [
                {
                    "id": int(document["id"]),
                    "documentType": document["document_type"],
                    "title": document["title"],
                    "originalFileName": document["original_file_name"],
                    "mimeType": document["mime_type"],
                    "fileSize": int(document["file_size"]),
                    "createdAt": to_iso(document["created_at"]),
                }
                for document in documents
            ],
        }
    }


def assign_admin_internship(db: Session, application_id: int, lecturer_id: int) -> dict:
    lecturer = (
        db.execute(
            text(
                """
            SELECT id FROM public.users
            WHERE id = :lecturer_id AND role = 'LECTURER' AND is_active = TRUE
            """
            ),
            {"lecturer_id": lecturer_id},
        )
        .mappings()
        .first()
    )
    if lecturer is None:
        raise ValueError("Giảng viên không tồn tại hoặc đã ngừng hoạt động.")

    result = (
        db.execute(
            text(
                """
            UPDATE public.internship_applications
            SET assigned_lecturer_id = :lecturer_id, updated_at = NOW()
            WHERE id = :application_id
              AND status IN ('SUBMITTED', 'UNDER_REVIEW')
            RETURNING id
            """
            ),
            {"application_id": application_id, "lecturer_id": lecturer_id},
        )
        .mappings()
        .first()
    )
    if result is None:
        db.rollback()
        raise AdminInternshipNotFoundError("Không tìm thấy hồ sơ hoặc hồ sơ đã có kết quả cuối cùng.")
    db.commit()
    return {"applicationId": application_id, "message": "Đã phân công giảng viên phụ trách."}


def review_admin_internship(db: Session, application_id: int, payload) -> dict:
    row = (
        db.execute(
            text(
                """
            SELECT assigned_lecturer_id
            FROM public.internship_applications
            WHERE id = :application_id
              AND status IN ('SUBMITTED', 'UNDER_REVIEW')
            """
            ),
            {"application_id": application_id},
        )
        .mappings()
        .first()
    )
    if row is None:
        raise AdminInternshipNotFoundError("Không tìm thấy hồ sơ hoặc hồ sơ đã có kết quả cuối cùng.")
    if row["assigned_lecturer_id"] is None:
        raise ValueError("Vui lòng phân công giảng viên trước khi xét duyệt hồ sơ.")
    return review_lecturer_application(
        db=db,
        application_id=application_id,
        payload=payload,
        lecturer_id=int(row["assigned_lecturer_id"]),
    )


def get_admin_internship_document(db: Session, application_id: int, document_id: int):
    return (
        db.execute(
            text(
                """
            SELECT ad.original_file_name, ad.mime_type, ad.file_data
            FROM public.application_documents AS ad
            INNER JOIN public.internship_applications AS ia
                ON ia.id = ad.application_id
            WHERE ad.id = :document_id
              AND ad.application_id = :application_id
            LIMIT 1
            """
            ),
            {"document_id": document_id, "application_id": application_id},
        )
        .mappings()
        .first()
    )
