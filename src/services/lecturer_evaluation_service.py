from __future__ import annotations

from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.models.lecturer_evaluations import LecturerEvaluationSaveRequest
from src.services.lecturer_common_service import _get_lecturer, to_iso
from src.services.score_utils import normalize_grade_score

EVALUATION_TYPES = ("MIDTERM", "FINAL")


def _lecturer_id(db: Session, lecturer_id: int | str | None) -> int:
    lecturer = _get_lecturer(db=db, lecturer_id=lecturer_id)
    if lecturer is None:
        raise ValueError("Không tìm thấy giảng viên đang hoạt động.")
    return int(lecturer["id"])


def _score(value: Any) -> float | None:
    return float(value) if value is not None else None


def _map_item(row: Any) -> dict:
    return {
        "internshipId": int(row["internship_id"]),
        "evaluationId": (
            int(row["evaluation_id"]) if row["evaluation_id"] else None
        ),
        "evaluationType": row["evaluation_type"],
        "status": row["evaluation_status"] or "NOT_STARTED",
        "totalScore": normalize_grade_score(row["total_score"]),
        "submittedAt": to_iso(row["evaluation_submitted_at"]),
        "updatedAt": to_iso(row["evaluation_updated_at"]),
        "studentId": int(row["student_id"]),
        "studentName": row["student_name"],
        "studentCode": row["student_code"] or "",
        "className": row["class_name"] or "",
        "major": row["major"] or "",
        "email": row["student_email"] or "",
        "phone": row["student_phone"],
        "periodId": int(row["period_id"]) if row["period_id"] else None,
        "periodName": row["period_name"] or "",
        "semesterCode": row["semester_code"] or "",
        "academicYear": row["academic_year"] or "",
        "companyName": row["company_name"] or "",
        "mentorName": row["mentor_name"] or "",
        "positionTitle": row["position_title"] or "",
        "startDate": to_iso(row["start_date"]),
        "endDate": to_iso(row["end_date"]),
        "internshipStatus": row["internship_status"],
        "progressPercentage": float(row["progress_percentage"] or 0),
        "completedHours": int(row["completed_hours"] or 0),
        "requiredHours": (
            int(row["required_hours"])
            if row["required_hours"] is not None
            else None
        ),
        "reportTotal": int(row["report_total"] or 0),
        "reportSubmitted": int(row["report_submitted"] or 0),
        "reportApproved": int(row["report_approved"] or 0),
        "reportLate": int(row["report_late"] or 0),
        "reportOverdue": int(row["report_overdue"] or 0),
        "reportAverageScore": _score(row["report_average_score"]),
        "assignedLecturer": (
            {
                "id": int(row["lecturer_id"]),
                "fullName": row["lecturer_name"] or "",
                "lecturerCode": row["lecturer_code"] or "",
                "faculty": row["lecturer_faculty"] or "",
            }
            if row["lecturer_id"] is not None
            else None
        ),
    }


def get_evaluation_slots(
    db: Session,
    lecturer_id: int | None = None,
) -> list[dict]:
    rows = db.execute(
        text(
            """
            WITH report_stats AS (
                SELECT
                    wr.internship_id,
                    COUNT(*)::INTEGER AS report_total,
                    COUNT(*) FILTER (
                        WHERE wr.submitted_at IS NOT NULL
                    )::INTEGER AS report_submitted,
                    COUNT(*) FILTER (
                        WHERE wr.status = 'APPROVED'
                    )::INTEGER AS report_approved,
                    COUNT(*) FILTER (
                        WHERE wr.submitted_at IS NOT NULL
                          AND wr.due_at IS NOT NULL
                          AND wr.submitted_at > wr.due_at
                    )::INTEGER AS report_late,
                    COUNT(*) FILTER (
                        WHERE wr.submitted_at IS NULL
                          AND wr.due_at IS NOT NULL
                          AND wr.due_at < NOW()
                    )::INTEGER AS report_overdue,
                    AVG(
                        CASE
                            WHEN wr.lecturer_score > 10
                                THEN wr.lecturer_score / 10.0
                            ELSE wr.lecturer_score
                        END
                    ) FILTER (
                        WHERE wr.lecturer_score IS NOT NULL
                    ) AS report_average_score
                FROM public.weekly_reports AS wr
                GROUP BY wr.internship_id
            )
            SELECT
                i.id AS internship_id,
                slot.evaluation_type,
                own_evaluation.id AS evaluation_id,
                own_evaluation.status AS evaluation_status,
                own_evaluation.total_score,
                own_evaluation.submitted_at AS evaluation_submitted_at,
                own_evaluation.updated_at AS evaluation_updated_at,
                u.id AS student_id,
                u.full_name AS student_name,
                u.email AS student_email,
                u.phone AS student_phone,
                sp.student_code,
                sp.cohort AS class_name,
                sp.major,
                s.id AS period_id,
                s.name AS period_name,
                s.semester_code,
                s.academic_year,
                c.name AS company_name,
                cm.full_name AS mentor_name,
                i.position_title,
                i.start_date,
                i.end_date,
                i.status AS internship_status,
                i.progress_percentage,
                i.completed_hours,
                i.required_hours,
                lecturer.id AS lecturer_id,
                lecturer.full_name AS lecturer_name,
                lp.lecturer_code,
                lp.faculty AS lecturer_faculty,
                COALESCE(rs.report_total, 0) AS report_total,
                COALESCE(rs.report_submitted, 0) AS report_submitted,
                COALESCE(rs.report_approved, 0) AS report_approved,
                COALESCE(rs.report_late, 0) AS report_late,
                COALESCE(rs.report_overdue, 0) AS report_overdue,
                rs.report_average_score
            FROM public.internships AS i
            INNER JOIN public.users AS u ON u.id = i.student_id
            LEFT JOIN public.student_profiles AS sp
                ON sp.student_id = i.student_id
            LEFT JOIN public.semesters AS s ON s.id = i.semester_id
            LEFT JOIN public.companies AS c ON c.id = i.company_id
            LEFT JOIN public.company_mentors AS cm
                ON cm.id = i.company_mentor_id
            LEFT JOIN public.users AS lecturer ON lecturer.id = i.lecturer_id
            LEFT JOIN public.lecturer_profiles AS lp
                ON lp.lecturer_id = lecturer.id
            CROSS JOIN (
                VALUES ('MIDTERM'), ('FINAL')
            ) AS slot(evaluation_type)
            LEFT JOIN report_stats AS rs ON rs.internship_id = i.id
            LEFT JOIN LATERAL (
                SELECT e.*
                FROM public.evaluations AS e
                WHERE e.internship_id = i.id
                  AND e.evaluator_id = i.lecturer_id
                  AND e.evaluator_type = 'LECTURER'
                  AND e.evaluation_type = slot.evaluation_type
                ORDER BY e.updated_at DESC, e.id DESC
                LIMIT 1
            ) AS own_evaluation ON TRUE
            WHERE (:lecturer_id IS NULL OR i.lecturer_id = :lecturer_id)
              AND i.status <> 'CANCELLED'
            ORDER BY
                CASE COALESCE(own_evaluation.status, 'NOT_STARTED')
                    WHEN 'SUBMITTED' THEN 1
                    WHEN 'DRAFT' THEN 2
                    WHEN 'NOT_STARTED' THEN 3
                    ELSE 4
                END,
                s.start_date DESC NULLS LAST,
                u.full_name,
                slot.evaluation_type
            """
        ),
        {"lecturer_id": lecturer_id},
    ).mappings().all()
    return [_map_item(row) for row in rows]


def get_evaluation_periods(
    db: Session,
    lecturer_id: int | None = None,
) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT DISTINCT s.id, s.name, s.semester_code, s.academic_year,
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
    return [
        {
            "id": int(row["id"]),
            "name": row["name"],
            "semesterCode": row["semester_code"] or "",
            "academicYear": row["academic_year"] or "",
        }
        for row in rows
    ]


def get_lecturer_evaluations(
    db: Session,
    lecturer_id: int | str | None = None,
) -> dict:
    current_lecturer_id = _lecturer_id(db, lecturer_id)
    evaluations = get_evaluation_slots(db, current_lecturer_id)
    scored = [item["totalScore"] for item in evaluations if item["totalScore"] is not None]

    return {
        "summary": {
            "total": len(evaluations),
            "notStarted": sum(item["status"] == "NOT_STARTED" for item in evaluations),
            "draft": sum(item["status"] == "DRAFT" for item in evaluations),
            "submitted": sum(item["status"] == "SUBMITTED" for item in evaluations),
            "confirmed": sum(item["status"] == "CONFIRMED" for item in evaluations),
            "averageScore": (
                round(sum(scored) / len(scored), 2) if scored else None
            ),
        },
        "periods": get_evaluation_periods(db, current_lecturer_id),
        "evaluations": evaluations,
    }


def _record(row: Any) -> dict:
    return {
        "id": int(row["id"]),
        "evaluatorType": row["evaluator_type"],
        "evaluatorName": row["evaluator_name"],
        "evaluationType": row["evaluation_type"] or "",
        "totalScore": normalize_grade_score(row["total_score"]),
        "feedback": row["feedback"],
        "strengths": row["strengths"],
        "improvements": row["improvements"],
        "status": row["status"],
        "submittedAt": to_iso(row["submitted_at"]),
        "updatedAt": to_iso(row["updated_at"]),
    }


def get_lecturer_evaluation_detail(
    db: Session,
    internship_id: int,
    evaluation_type: str,
    lecturer_id: int | str | None = None,
) -> dict:
    if evaluation_type not in EVALUATION_TYPES:
        raise ValueError("Loại đánh giá không hợp lệ.")

    current_lecturer_id = _lecturer_id(db, lecturer_id)
    item = next(
        (
            value
            for value in get_evaluation_slots(db, current_lecturer_id)
            if value["internshipId"] == internship_id
            and value["evaluationType"] == evaluation_type
        ),
        None,
    )
    if item is None:
        raise ValueError("Không tìm thấy kỳ thực tập thuộc quyền đánh giá của bạn.")

    return get_evaluation_detail_data(
        db=db,
        item=item,
        evaluation_type=evaluation_type,
        lecturer_id=current_lecturer_id,
    )


def get_evaluation_detail_data(
    db: Session,
    item: dict,
    evaluation_type: str,
    lecturer_id: int | None,
) -> dict:
    evaluation_rows = db.execute(
        text(
            """
            SELECT
                e.*,
                COALESCE(u.full_name, cm.full_name) AS evaluator_name
            FROM public.evaluations AS e
            LEFT JOIN public.users AS u ON u.id = e.evaluator_id
            LEFT JOIN public.internships AS i ON i.id = e.internship_id
            LEFT JOIN public.company_mentors AS cm
                ON cm.id = i.company_mentor_id
               AND e.evaluator_type = 'COMPANY_MENTOR'
            WHERE e.internship_id = :internship_id
              AND e.evaluation_type = :evaluation_type
            ORDER BY e.updated_at DESC, e.id DESC
            """
        ),
        {
            "internship_id": item["internshipId"],
            "evaluation_type": evaluation_type,
        },
    ).mappings().all()
    records = [_record(row) for row in evaluation_rows]
    current = next(
        (
            record
            for record in records
            if record["evaluatorType"] == "LECTURER"
            and any(
                int(row["id"]) == record["id"]
                and row["evaluator_id"] == lecturer_id
                for row in evaluation_rows
            )
        ),
        None,
    )

    report_rows = db.execute(
        text(
            """
            SELECT
                wr.id,
                wr.report_type,
                wr.week_number,
                wr.title,
                wr.status,
                wr.due_at,
                wr.submitted_at,
                wr.lecturer_score,
                wr.lecturer_feedback,
                (
                    wr.submitted_at IS NOT NULL
                    AND wr.due_at IS NOT NULL
                    AND wr.submitted_at > wr.due_at
                ) AS is_late,
                (
                    wr.submitted_at IS NULL
                    AND wr.due_at IS NOT NULL
                    AND wr.due_at < NOW()
                ) AS is_overdue
            FROM public.weekly_reports AS wr
            WHERE wr.internship_id = :internship_id
            ORDER BY
                COALESCE(wr.due_at, wr.created_at),
                wr.id
            """
        ),
        {"internship_id": item["internshipId"]},
    ).mappings().all()

    reports = [
        {
            "id": int(row["id"]),
            "reportType": row["report_type"],
            "weekNumber": row["week_number"],
            "title": row["title"] or "Báo cáo thực tập",
            "status": row["status"],
            "dueAt": to_iso(row["due_at"]),
            "submittedAt": to_iso(row["submitted_at"]),
            "isLate": bool(row["is_late"]),
            "isOverdue": bool(row["is_overdue"]),
            "lecturerScore": normalize_grade_score(row["lecturer_score"]),
            "lecturerFeedback": row["lecturer_feedback"],
        }
        for row in report_rows
    ]

    issues: list[str] = []
    if item["reportOverdue"]:
        issues.append(f"Có {item['reportOverdue']} báo cáo quá hạn chưa nộp.")
    if item["reportLate"]:
        issues.append(f"Có {item['reportLate']} báo cáo được nộp muộn.")
    if evaluation_type == "FINAL" and item["progressPercentage"] < 100:
        issues.append("Tiến độ thực tập chưa đạt 100% cho đánh giá cuối kỳ.")
    if not reports:
        issues.append("Chưa có báo cáo để làm căn cứ đánh giá.")

    return {
        "evaluation": item,
        "currentEvaluation": current,
        "relatedEvaluations": [
            record for record in records if current is None or record["id"] != current["id"]
        ],
        "reports": reports,
        "readinessIssues": issues,
    }


def save_lecturer_evaluation(
    db: Session,
    internship_id: int,
    evaluation_type: str,
    payload: LecturerEvaluationSaveRequest,
    lecturer_id: int | str | None = None,
) -> dict:
    if evaluation_type not in EVALUATION_TYPES:
        raise ValueError("Loại đánh giá không hợp lệ.")

    current_lecturer_id = _lecturer_id(db, lecturer_id)
    feedback = (payload.feedback or "").strip()
    strengths = (payload.strengths or "").strip()
    improvements = (payload.improvements or "").strip()

    if payload.status in ("SUBMITTED", "CONFIRMED"):
        if payload.totalScore is None:
            raise ValueError("Vui lòng nhập tổng điểm trước khi nộp đánh giá.")
        if not feedback:
            raise ValueError("Vui lòng nhập nhận xét chung trước khi nộp đánh giá.")
    if payload.status == "CONFIRMED" and (not strengths or not improvements):
        raise ValueError(
            "Vui lòng nhập điểm mạnh và nội dung cần cải thiện trước khi xác nhận."
        )

    internship = db.execute(
        text(
            """
            SELECT i.id, i.student_id
            FROM public.internships AS i
            WHERE i.id = :internship_id
              AND i.lecturer_id = :lecturer_id
              AND i.status <> 'CANCELLED'
            FOR UPDATE
            """
        ),
        {
            "internship_id": internship_id,
            "lecturer_id": current_lecturer_id,
        },
    ).mappings().first()
    if internship is None:
        raise ValueError("Không tìm thấy kỳ thực tập thuộc quyền đánh giá của bạn.")

    existing = db.execute(
        text(
            """
            SELECT id, status
            FROM public.evaluations
            WHERE internship_id = :internship_id
              AND evaluator_id = :lecturer_id
              AND evaluator_type = 'LECTURER'
              AND evaluation_type = :evaluation_type
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
            FOR UPDATE
            """
        ),
        {
            "internship_id": internship_id,
            "lecturer_id": current_lecturer_id,
            "evaluation_type": evaluation_type,
        },
    ).mappings().first()
    if existing is not None and existing["status"] == "CONFIRMED":
        raise ValueError("Đánh giá đã được xác nhận và không thể chỉnh sửa.")
    if (
        existing is not None
        and existing["status"] == "SUBMITTED"
        and payload.status == "DRAFT"
    ):
        raise ValueError("Đánh giá đã nộp không thể chuyển lại thành bản nháp.")

    try:
        params = {
            "internship_id": internship_id,
            "lecturer_id": current_lecturer_id,
            "evaluation_type": evaluation_type,
            "total_score": payload.totalScore,
            "feedback": feedback or None,
            "strengths": strengths or None,
            "improvements": improvements or None,
            "status": payload.status,
        }
        if existing is None:
            evaluation_id = db.execute(
                text(
                    """
                    INSERT INTO public.evaluations (
                        internship_id, evaluator_id, evaluator_type,
                        evaluation_type, total_score, feedback, strengths,
                        improvements, status, submitted_at
                    ) VALUES (
                        :internship_id, :lecturer_id, 'LECTURER',
                        :evaluation_type, :total_score, :feedback, :strengths,
                        :improvements, :status,
                        CASE WHEN :status = 'DRAFT' THEN NULL ELSE NOW() END
                    )
                    RETURNING id
                    """
                ),
                params,
            ).scalar_one()
        else:
            evaluation_id = int(existing["id"])
            db.execute(
                text(
                    """
                    UPDATE public.evaluations
                    SET total_score = :total_score,
                        feedback = :feedback,
                        strengths = :strengths,
                        improvements = :improvements,
                        status = :status,
                        submitted_at = CASE
                            WHEN :status = 'DRAFT' THEN NULL
                            ELSE COALESCE(submitted_at, NOW())
                        END,
                        updated_at = NOW()
                    WHERE id = :evaluation_id
                    """
                ),
                {**params, "evaluation_id": evaluation_id},
            )

        status_changed = (
            existing is None or existing["status"] != payload.status
        )
        if payload.status in ("SUBMITTED", "CONFIRMED") and status_changed:
            label = "giữa kỳ" if evaluation_type == "MIDTERM" else "cuối kỳ"
            state = "đã được xác nhận" if payload.status == "CONFIRMED" else "đã được nộp"
            db.execute(
                text(
                    """
                    INSERT INTO public.notifications (
                        user_id, title, message, notification_type, severity,
                        related_type, related_id
                    ) VALUES (
                        :student_id, :title, :message, 'EVALUATION', 'SUCCESS',
                        'EVALUATION', :evaluation_id
                    )
                    """
                ),
                {
                    "student_id": int(internship["student_id"]),
                    "title": f"Đánh giá {label}",
                    "message": f"Đánh giá {label} của bạn {state}.",
                    "evaluation_id": evaluation_id,
                },
            )

        db.commit()
    except Exception:
        db.rollback()
        raise

    messages = {
        "DRAFT": "Đã lưu bản nháp đánh giá.",
        "SUBMITTED": "Đã nộp đánh giá cho sinh viên.",
        "CONFIRMED": "Đã xác nhận kết quả đánh giá.",
    }
    return {
        "evaluationId": int(evaluation_id),
        "internshipId": internship_id,
        "evaluationType": evaluation_type,
        "status": payload.status,
        "message": messages[payload.status],
    }
