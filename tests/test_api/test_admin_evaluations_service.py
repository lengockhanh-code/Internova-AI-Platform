from __future__ import annotations

import pytest
from fastapi import HTTPException

from src.api.admin_evaluations_routes import require_admin
from src.services import admin_evaluation_service as service


def _evaluation(
    *,
    internship_id: int,
    student_id: int,
    evaluation_type: str,
    status: str,
    total_score: float | None,
    lecturer_id: int | None,
    overdue: int = 0,
    progress: float = 100,
) -> dict:
    lecturer = None
    if lecturer_id is not None:
        lecturer = {
            "id": lecturer_id,
            "fullName": f"Lecturer {lecturer_id}",
            "lecturerCode": f"GV{lecturer_id:03d}",
            "faculty": "CECS",
        }
    return {
        "internshipId": internship_id,
        "studentId": student_id,
        "evaluationType": evaluation_type,
        "status": status,
        "totalScore": total_score,
        "assignedLecturer": lecturer,
        "reportOverdue": overdue,
        "progressPercentage": progress,
    }


def test_admin_guard_rejects_non_admin_role() -> None:
    with pytest.raises(HTTPException) as exc_info:
        require_admin({"id": 2, "role": "LECTURER"})

    assert exc_info.value.status_code == 403


def test_list_admin_evaluations_aggregates_dashboard_metrics(monkeypatch) -> None:
    evaluations = [
        _evaluation(
            internship_id=10,
            student_id=1,
            evaluation_type="MIDTERM",
            status="CONFIRMED",
            total_score=8.0,
            lecturer_id=2,
        ),
        _evaluation(
            internship_id=10,
            student_id=1,
            evaluation_type="FINAL",
            status="DRAFT",
            total_score=6.0,
            lecturer_id=2,
            progress=80,
        ),
        _evaluation(
            internship_id=11,
            student_id=3,
            evaluation_type="FINAL",
            status="SUBMITTED",
            total_score=None,
            lecturer_id=1,
            overdue=1,
        ),
    ]
    monkeypatch.setattr(service, "get_evaluation_slots", lambda db: evaluations)
    monkeypatch.setattr(
        service,
        "get_evaluation_periods",
        lambda db: [{"id": 1, "name": "HK1"}],
    )

    result = service.list_admin_evaluations(object())  # type: ignore[arg-type]

    assert result["summary"] == {
        "total": 3,
        "notStarted": 0,
        "draft": 1,
        "submitted": 1,
        "confirmed": 1,
        "averageScore": 7.0,
        "students": 2,
        "lecturers": 2,
        "midterm": 1,
        "final": 2,
        "needsAttention": 2,
        "completionRate": 33.3,
    }
    assert [item["id"] for item in result["lecturers"]] == [1, 2]
    assert result["periods"] == [{"id": 1, "name": "HK1"}]


def test_admin_detail_uses_assigned_lecturer_scope(monkeypatch) -> None:
    item = _evaluation(
        internship_id=21,
        student_id=4,
        evaluation_type="FINAL",
        status="SUBMITTED",
        total_score=9.0,
        lecturer_id=7,
    )
    calls: list[dict] = []
    monkeypatch.setattr(service, "get_evaluation_slots", lambda db: [item])

    def get_detail(**kwargs):
        calls.append(kwargs)
        return {"evaluation": item, "reports": []}

    monkeypatch.setattr(service, "get_evaluation_detail_data", get_detail)

    result = service.get_admin_evaluation_detail(
        object(), 21, "FINAL"  # type: ignore[arg-type]
    )

    assert result["evaluation"] == item
    assert calls[0]["lecturer_id"] == 7
    assert calls[0]["item"] == item


def test_admin_detail_supports_unassigned_internship(monkeypatch) -> None:
    item = _evaluation(
        internship_id=22,
        student_id=5,
        evaluation_type="MIDTERM",
        status="NOT_STARTED",
        total_score=None,
        lecturer_id=None,
    )
    monkeypatch.setattr(service, "get_evaluation_slots", lambda db: [item])
    calls: list[dict] = []

    def get_detail(**kwargs):
        calls.append(kwargs)
        return {"evaluation": item, "reports": []}

    monkeypatch.setattr(service, "get_evaluation_detail_data", get_detail)

    result = service.get_admin_evaluation_detail(
        object(), 22, "MIDTERM"  # type: ignore[arg-type]
    )

    assert result["evaluation"] == item
    assert calls[0]["lecturer_id"] is None
