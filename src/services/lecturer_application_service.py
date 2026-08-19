from __future__ import annotations

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.services.lecturer_common_service import _get_lecturer, to_iso


VISIBLE_STATUSES = (
    "SUBMITTED",
    "UNDER_REVIEW",
    "APPROVED",
    "REJECTED",
)


def _get_current_lecturer_id(
    db: Session,
    lecturer_id: int | str | None,
) -> int:
    lecturer = _get_lecturer(db=db, lecturer_id=lecturer_id)
    if lecturer is None:
        raise ValueError("Không tìm thấy giảng viên đang hoạt động.")
    return int(lecturer["id"])


def get_lecturer_applications(
    db: Session,
    lecturer_id: int | str | None = None,
) -> dict:
    current_lecturer_id = _get_current_lecturer_id(db, lecturer_id)

    rows = db.execute(
        text(
            """
            SELECT
                ia.id AS application_id,
                ia.student_id,
                u.full_name AS student_name,
                sp.student_code,
                sp.cohort AS class_name,
                sp.major,
                s.id AS period_id,
                s.name AS period_name,
                s.semester_code,
                s.academic_year,
                c.name AS company_name,
                ia.position_title AS internship_position,
                ia.work_mode,
                ia.status,
                ia.submitted_at,
                ia.reviewed_at,
                COUNT(DISTINCT ad.id)::INTEGER AS document_count,
                MAX(i.id)::BIGINT AS internship_id
            FROM public.internship_applications AS ia
            INNER JOIN public.users AS u ON u.id = ia.student_id
            LEFT JOIN public.student_profiles AS sp ON sp.student_id = ia.student_id
            LEFT JOIN public.semesters AS s ON s.id = ia.semester_id
            LEFT JOIN public.companies AS c ON c.id = ia.company_id
            LEFT JOIN public.application_documents AS ad
                ON ad.application_id = ia.id
            LEFT JOIN public.internships AS i ON i.application_id = ia.id
            WHERE ia.assigned_lecturer_id = :lecturer_id
              AND ia.status IN (
                  'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'
              )
            GROUP BY
                ia.id, ia.student_id, u.full_name, sp.student_code,
                sp.cohort, sp.major, s.id, s.name, s.semester_code,
                s.academic_year, c.name, ia.position_title, ia.work_mode,
                ia.status, ia.submitted_at, ia.reviewed_at
            ORDER BY
                CASE ia.status
                    WHEN 'SUBMITTED' THEN 1
                    WHEN 'UNDER_REVIEW' THEN 2
                    WHEN 'REJECTED' THEN 3
                    ELSE 4
                END,
                ia.submitted_at DESC NULLS LAST,
                ia.id DESC
            """
        ),
        {"lecturer_id": current_lecturer_id},
    ).mappings().all()

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
            "semesterCode": row["semester_code"] or "",
            "academicYear": row["academic_year"] or "",
            "companyName": row["company_name"] or "",
            "internshipPosition": row["internship_position"] or "",
            "workMode": row["work_mode"],
            "status": row["status"],
            "submittedAt": to_iso(row["submitted_at"]),
            "reviewedAt": to_iso(row["reviewed_at"]),
            "documentCount": int(row["document_count"] or 0),
            "internshipId": (
                int(row["internship_id"]) if row["internship_id"] else None
            ),
        }
        for row in rows
    ]

    period_rows = db.execute(
        text(
            """
            SELECT DISTINCT s.id, s.name, s.semester_code, s.academic_year,
                s.start_date
            FROM public.internship_applications AS ia
            INNER JOIN public.semesters AS s ON s.id = ia.semester_id
            WHERE ia.assigned_lecturer_id = :lecturer_id
              AND ia.status IN (
                  'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'
              )
            ORDER BY s.start_date DESC NULLS LAST, s.id DESC
            """
        ),
        {"lecturer_id": current_lecturer_id},
    ).mappings().all()

    return {
        "summary": {
            "total": len(applications),
            "submitted": sum(1 for item in applications if item["status"] == "SUBMITTED"),
            "underReview": sum(1 for item in applications if item["status"] == "UNDER_REVIEW"),
            "approved": sum(1 for item in applications if item["status"] == "APPROVED"),
            "rejected": sum(1 for item in applications if item["status"] == "REJECTED"),
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
        "applications": applications,
    }


def get_lecturer_application_detail(
    db: Session,
    application_id: int,
    lecturer_id: int | str | None = None,
) -> dict:
    current_lecturer_id = _get_current_lecturer_id(db, lecturer_id)

    row = db.execute(
        text(
            """
            SELECT
                ia.id AS application_id,
                ia.status,
                ia.internship_type,
                ia.description,
                ia.position_title AS internship_position,
                ia.work_mode,
                ia.credits,
                ia.expected_start_date,
                ia.expected_end_date,
                ia.submitted_at,
                ia.reviewed_at,
                ia.lecturer_comment,
                u.id AS student_id,
                u.full_name AS student_name,
                u.email AS student_email,
                u.phone AS student_phone,
                sp.student_code,
                sp.faculty,
                sp.major,
                sp.cohort AS class_name,
                s.id AS period_id,
                s.name AS period_name,
                s.semester_code,
                s.academic_year,
                c.id AS company_id,
                c.name AS company_name,
                c.industry,
                c.address AS company_address,
                c.website AS company_website,
                cm.id AS mentor_id,
                cm.full_name AS mentor_name,
                cm.position AS mentor_position,
                cm.department AS mentor_department,
                cm.email AS mentor_email,
                cm.phone AS mentor_phone,
                i.id AS internship_id
            FROM public.internship_applications AS ia
            INNER JOIN public.users AS u ON u.id = ia.student_id
            LEFT JOIN public.student_profiles AS sp ON sp.student_id = ia.student_id
            LEFT JOIN public.semesters AS s ON s.id = ia.semester_id
            LEFT JOIN public.companies AS c ON c.id = ia.company_id
            LEFT JOIN public.company_mentors AS cm ON cm.id = ia.company_mentor_id
            LEFT JOIN public.internships AS i ON i.application_id = ia.id
            WHERE ia.id = :application_id
              AND ia.assigned_lecturer_id = :lecturer_id
              AND ia.status IN (
                  'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'
              )
            LIMIT 1
            """
        ),
        {
            "application_id": application_id,
            "lecturer_id": current_lecturer_id,
        },
    ).mappings().first()

    if row is None:
        raise ValueError("Không tìm thấy hồ sơ thuộc quyền xét duyệt của bạn.")

    documents = db.execute(
        text(
            """
            SELECT id, document_type, title, original_file_name,
                mime_type, file_size, created_at
            FROM public.application_documents
            WHERE application_id = :application_id
              AND student_id = :student_id
            ORDER BY created_at ASC, id ASC
            """
        ),
        {
            "application_id": application_id,
            "student_id": int(row["student_id"]),
        },
    ).mappings().all()

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


def review_lecturer_application(
    db: Session,
    application_id: int,
    payload,
    lecturer_id: int | str | None = None,
) -> dict:
    current_lecturer_id = _get_current_lecturer_id(db, lecturer_id)
    comment = (payload.comment or "").strip()

    if payload.status == "REJECTED" and not comment:
        raise ValueError("Vui lòng nhập lý do từ chối hồ sơ.")

    application = db.execute(
        text(
            """
            SELECT id, student_id, semester_id, company_id,
                company_mentor_id, position_title, description,
                expected_start_date, expected_end_date, status
            FROM public.internship_applications
            WHERE id = :application_id
              AND assigned_lecturer_id = :lecturer_id
            FOR UPDATE
            """
        ),
        {
            "application_id": application_id,
            "lecturer_id": current_lecturer_id,
        },
    ).mappings().first()

    if application is None:
        raise ValueError("Không tìm thấy hồ sơ thuộc quyền xét duyệt của bạn.")

    if application["status"] not in {"SUBMITTED", "UNDER_REVIEW"}:
        raise ValueError("Hồ sơ đã có kết quả và không thể xét duyệt lại.")

    if payload.status == "APPROVED":
        if application["semester_id"] is None:
            raise ValueError("Hồ sơ chưa có đợt thực tập để phê duyệt.")
        if not (application["position_title"] or "").strip():
            raise ValueError("Hồ sơ chưa có vị trí thực tập.")
        if (
            application["expected_start_date"] is not None
            and application["expected_end_date"] is not None
            and application["expected_end_date"] < application["expected_start_date"]
        ):
            raise ValueError("Ngày kết thúc không được trước ngày bắt đầu.")

    try:
        internship_id = None

        if payload.status == "APPROVED":
            duplicate = db.execute(
                text(
                    """
                    SELECT id, application_id
                    FROM public.internships
                    WHERE student_id = :student_id
                      AND semester_id = :semester_id
                      AND status <> 'CANCELLED'
                      AND (application_id IS NULL OR application_id <> :application_id)
                    LIMIT 1
                    """
                ),
                {
                    "student_id": int(application["student_id"]),
                    "semester_id": int(application["semester_id"]),
                    "application_id": application_id,
                },
            ).mappings().first()
            if duplicate is not None:
                raise ValueError(
                    "Sinh viên đã có kỳ thực tập khác trong cùng đợt này."
                )

            internship = db.execute(
                text(
                    """
                    INSERT INTO public.internships (
                        student_id, lecturer_id, semester_id, company_id,
                        company_mentor_id, application_id, position_title,
                        description, start_date, end_date, status
                    )
                    VALUES (
                        :student_id, :lecturer_id, :semester_id, :company_id,
                        :mentor_id, :application_id, :position_title,
                        :description, :start_date, :end_date, 'NOT_STARTED'
                    )
                    ON CONFLICT (application_id) DO UPDATE SET
                        lecturer_id = EXCLUDED.lecturer_id,
                        semester_id = EXCLUDED.semester_id,
                        company_id = EXCLUDED.company_id,
                        company_mentor_id = EXCLUDED.company_mentor_id,
                        position_title = EXCLUDED.position_title,
                        description = EXCLUDED.description,
                        start_date = EXCLUDED.start_date,
                        end_date = EXCLUDED.end_date,
                        updated_at = NOW()
                    RETURNING id
                    """
                ),
                {
                    "student_id": int(application["student_id"]),
                    "lecturer_id": current_lecturer_id,
                    "semester_id": int(application["semester_id"]),
                    "company_id": application["company_id"],
                    "mentor_id": application["company_mentor_id"],
                    "application_id": application_id,
                    "position_title": application["position_title"].strip(),
                    "description": application["description"],
                    "start_date": application["expected_start_date"],
                    "end_date": application["expected_end_date"],
                },
            ).mappings().first()
            internship_id = int(internship["id"])

        db.execute(
            text(
                """
                UPDATE public.internship_applications
                SET status = :status,
                    lecturer_comment = :comment,
                    reviewed_at = CASE
                        WHEN :status = 'UNDER_REVIEW' THEN NULL
                        ELSE NOW()
                    END,
                    updated_at = NOW()
                WHERE id = :application_id
                  AND assigned_lecturer_id = :lecturer_id
                """
            ),
            {
                "status": payload.status,
                "comment": comment or None,
                "application_id": application_id,
                "lecturer_id": current_lecturer_id,
            },
        )

        notification = {
            "UNDER_REVIEW": (
                "Hồ sơ đang được xem xét",
                "Giảng viên đã bắt đầu xem xét hồ sơ đăng ký thực tập của bạn.",
                "INFO",
            ),
            "APPROVED": (
                "Hồ sơ đã được duyệt",
                "Hồ sơ đăng ký thực tập của bạn đã được giảng viên phê duyệt.",
                "SUCCESS",
            ),
            "REJECTED": (
                "Hồ sơ chưa được chấp thuận",
                comment,
                "WARNING",
            ),
        }[payload.status]
        db.execute(
            text(
                """
                INSERT INTO public.notifications (
                    user_id, title, message, notification_type,
                    severity, related_type, related_id
                )
                VALUES (
                    :student_id, :title, :message, 'APPLICATION_REVIEW',
                    :severity, 'INTERNSHIP_APPLICATION', :application_id
                )
                """
            ),
            {
                "student_id": int(application["student_id"]),
                "title": notification[0],
                "message": notification[1],
                "severity": notification[2],
                "application_id": application_id,
            },
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return {
        "applicationId": application_id,
        "internshipId": internship_id,
        "message": "Đã cập nhật kết quả xét duyệt hồ sơ.",
    }


def get_lecturer_application_document(
    db: Session,
    application_id: int,
    document_id: int,
    lecturer_id: int | str | None = None,
):
    current_lecturer_id = _get_current_lecturer_id(db, lecturer_id)
    return db.execute(
        text(
            """
            SELECT ad.original_file_name, ad.mime_type, ad.file_data
            FROM public.application_documents AS ad
            INNER JOIN public.internship_applications AS ia
                ON ia.id = ad.application_id
            WHERE ad.id = :document_id
              AND ad.application_id = :application_id
              AND ia.assigned_lecturer_id = :lecturer_id
            LIMIT 1
            """
        ),
        {
            "document_id": document_id,
            "application_id": application_id,
            "lecturer_id": current_lecturer_id,
        },
    ).mappings().first()
