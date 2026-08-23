from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


EvaluationType = Literal["MIDTERM", "FINAL"]
EvaluationStatus = Literal["DRAFT", "SUBMITTED", "CONFIRMED"]
EvaluationDisplayStatus = Literal[
    "NOT_STARTED",
    "DRAFT",
    "SUBMITTED",
    "CONFIRMED",
]


class LecturerEvaluationSummary(BaseModel):
    total: int = 0
    notStarted: int = 0
    draft: int = 0
    submitted: int = 0
    confirmed: int = 0
    averageScore: float | None = None


class LecturerEvaluationPeriod(BaseModel):
    id: int
    name: str
    semesterCode: str = ""
    academicYear: str = ""


class LecturerEvaluationItem(BaseModel):
    internshipId: int
    evaluationId: int | None = None
    evaluationType: EvaluationType
    status: EvaluationDisplayStatus
    totalScore: float | None = None
    submittedAt: str | None = None
    updatedAt: str | None = None

    studentId: int
    studentName: str
    studentCode: str = ""
    className: str = ""
    major: str = ""
    email: str = ""
    phone: str | None = None

    periodId: int | None = None
    periodName: str = ""
    semesterCode: str = ""
    academicYear: str = ""

    companyName: str = ""
    mentorName: str = ""
    positionTitle: str = ""
    startDate: str | None = None
    endDate: str | None = None
    internshipStatus: str
    progressPercentage: float = 0
    completedHours: int = 0
    requiredHours: int | None = None

    reportTotal: int = 0
    reportSubmitted: int = 0
    reportApproved: int = 0
    reportLate: int = 0
    reportOverdue: int = 0
    reportAverageScore: float | None = None


class LecturerEvaluationsResponse(BaseModel):
    summary: LecturerEvaluationSummary = Field(
        default_factory=LecturerEvaluationSummary,
    )
    periods: list[LecturerEvaluationPeriod] = Field(default_factory=list)
    evaluations: list[LecturerEvaluationItem] = Field(default_factory=list)


class EvaluationRecord(BaseModel):
    id: int
    evaluatorType: str
    evaluatorName: str | None = None
    evaluationType: str
    totalScore: float | None = None
    feedback: str | None = None
    strengths: str | None = None
    improvements: str | None = None
    status: str
    submittedAt: str | None = None
    updatedAt: str | None = None


class EvaluationReportEvidence(BaseModel):
    id: int
    reportType: str
    weekNumber: int | None = None
    title: str
    status: str
    dueAt: str | None = None
    submittedAt: str | None = None
    isLate: bool = False
    isOverdue: bool = False
    lecturerScore: float | None = None
    lecturerFeedback: str | None = None


class LecturerEvaluationDetailResponse(BaseModel):
    evaluation: LecturerEvaluationItem
    currentEvaluation: EvaluationRecord | None = None
    relatedEvaluations: list[EvaluationRecord] = Field(default_factory=list)
    reports: list[EvaluationReportEvidence] = Field(default_factory=list)
    readinessIssues: list[str] = Field(default_factory=list)


class LecturerEvaluationSaveRequest(BaseModel):
    status: EvaluationStatus
    totalScore: float | None = Field(default=None, ge=0, le=10)
    feedback: str | None = Field(default=None, max_length=5000)
    strengths: str | None = Field(default=None, max_length=5000)
    improvements: str | None = Field(default=None, max_length=5000)


class LecturerEvaluationActionResponse(BaseModel):
    evaluationId: int
    internshipId: int
    evaluationType: EvaluationType
    status: EvaluationStatus
    message: str
