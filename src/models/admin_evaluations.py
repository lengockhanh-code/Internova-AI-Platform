from __future__ import annotations

from pydantic import BaseModel, Field

from src.models.lecturer_evaluations import (
    EvaluationRecord,
    EvaluationReportEvidence,
    LecturerEvaluationItem,
    LecturerEvaluationPeriod,
    LecturerEvaluationSummary,
)

# Public API fields intentionally follow the frontend camelCase contract.
# ruff: noqa: N815


class AdminEvaluationLecturer(BaseModel):
    id: int
    fullName: str
    lecturerCode: str = ""
    faculty: str = ""


class AdminEvaluationItem(LecturerEvaluationItem):
    assignedLecturer: AdminEvaluationLecturer | None = None


class AdminEvaluationSummary(LecturerEvaluationSummary):
    students: int = 0
    lecturers: int = 0
    midterm: int = 0
    final: int = 0
    needsAttention: int = 0
    completionRate: float = 0


class AdminEvaluationsResponse(BaseModel):
    summary: AdminEvaluationSummary = Field(
        default_factory=AdminEvaluationSummary,
    )
    periods: list[LecturerEvaluationPeriod] = Field(default_factory=list)
    lecturers: list[AdminEvaluationLecturer] = Field(default_factory=list)
    evaluations: list[AdminEvaluationItem] = Field(default_factory=list)


class AdminEvaluationDetailResponse(BaseModel):
    evaluation: AdminEvaluationItem
    currentEvaluation: EvaluationRecord | None = None
    relatedEvaluations: list[EvaluationRecord] = Field(default_factory=list)
    reports: list[EvaluationReportEvidence] = Field(default_factory=list)
    readinessIssues: list[str] = Field(default_factory=list)
