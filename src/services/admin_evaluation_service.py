from __future__ import annotations

from sqlalchemy.orm import Session

from src.services.lecturer_evaluation_service import (
    get_evaluation_detail_data,
    get_evaluation_periods,
    get_evaluation_slots,
)


class AdminEvaluationNotFoundError(ValueError):
    pass


def _needs_attention(item: dict) -> bool:
    return bool(
        item["reportOverdue"] > 0
        or (
            item["evaluationType"] == "FINAL"
            and item["progressPercentage"] < 100
            and item["status"] != "CONFIRMED"
        )
    )


def list_admin_evaluations(db: Session) -> dict:
    evaluations = get_evaluation_slots(db)
    scored = [
        float(item["totalScore"])
        for item in evaluations
        if item["totalScore"] is not None
    ]
    lecturers_by_id = {
        lecturer["id"]: lecturer
        for lecturer in (
            item["assignedLecturer"] for item in evaluations
        )
        if lecturer is not None
    }
    confirmed = sum(item["status"] == "CONFIRMED" for item in evaluations)

    return {
        "summary": {
            "total": len(evaluations),
            "notStarted": sum(
                item["status"] == "NOT_STARTED" for item in evaluations
            ),
            "draft": sum(item["status"] == "DRAFT" for item in evaluations),
            "submitted": sum(
                item["status"] == "SUBMITTED" for item in evaluations
            ),
            "confirmed": confirmed,
            "averageScore": (
                round(sum(scored) / len(scored), 2) if scored else None
            ),
            "students": len({item["studentId"] for item in evaluations}),
            "lecturers": len(lecturers_by_id),
            "midterm": sum(
                item["evaluationType"] == "MIDTERM" for item in evaluations
            ),
            "final": sum(
                item["evaluationType"] == "FINAL" for item in evaluations
            ),
            "needsAttention": sum(_needs_attention(item) for item in evaluations),
            "completionRate": (
                round(100 * confirmed / len(evaluations), 1)
                if evaluations
                else 0
            ),
        },
        "periods": get_evaluation_periods(db),
        "lecturers": sorted(
            lecturers_by_id.values(),
            key=lambda item: item["fullName"].lower(),
        ),
        "evaluations": evaluations,
    }


def get_admin_evaluation_detail(
    db: Session,
    internship_id: int,
    evaluation_type: str,
) -> dict:
    item = next(
        (
            evaluation
            for evaluation in get_evaluation_slots(db)
            if evaluation["internshipId"] == internship_id
            and evaluation["evaluationType"] == evaluation_type
        ),
        None,
    )
    if item is None:
        raise AdminEvaluationNotFoundError(
            "Không tìm thấy lượt đánh giá thực tập.",
        )

    lecturer = item["assignedLecturer"]
    return get_evaluation_detail_data(
        db=db,
        item=item,
        evaluation_type=evaluation_type,
        lecturer_id=lecturer["id"] if lecturer is not None else None,
    )
