from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


ReportType = Literal[
    "WEEKLY",
    "MIDTERM",
    "FINAL",
    "REFLECTION",
]

ReportWorkflowStatus = Literal[
    "DRAFT",
    "SUBMITTED",
    "LATE",
    "UNDER_REVIEW",
    "REVISION_REQUIRED",
    "APPROVED",
]

ReportSubmissionStatus = Literal[
    "UPCOMING",
    "NOT_SUBMITTED",
    "DRAFT",
    "ON_TIME",
    "LATE",
]


class LecturerReportSummary(BaseModel):
    total: int = 0
    submitted: int = 0
    onTime: int = 0
    late: int = 0
    overdue: int = 0
    pendingReview: int = 0
    approved: int = 0


class LecturerReportPeriodOption(BaseModel):
    id: int
    name: str
    semesterCode: str = ""
    academicYear: str = ""


class LecturerReportItem(BaseModel):
    reportId: int | None = None
    scheduleId: int | None = None
    internshipId: int

    studentId: int
    studentName: str
    studentCode: str = ""
    className: str = ""
    major: str = ""

    periodId: int | None = None
    periodName: str = ""
    semesterCode: str = ""
    academicYear: str = ""

    companyName: str = ""
    positionTitle: str = ""

    reportType: ReportType
    weekNumber: int | None = None
    title: str
    scheduleDescription: str | None = None
    content: str | None = None

    workflowStatus: ReportWorkflowStatus | None = None
    submissionStatus: ReportSubmissionStatus

    dueAt: str | None = None
    submittedAt: str | None = None
    reviewedAt: str | None = None
    lateByMinutes: int = 0

    fileName: str | None = None
    fileSize: int | None = None
    mimeType: str | None = None
    completionLetterName: str | None = None
    completionLetterSize: int | None = None

    lecturerFeedback: str | None = None
    lecturerScore: float | None = None
    commentCount: int = 0


class LecturerReportsResponse(BaseModel):
    summary: LecturerReportSummary = Field(
        default_factory=LecturerReportSummary,
    )
    periods: list[LecturerReportPeriodOption] = Field(default_factory=list)
    reports: list[LecturerReportItem] = Field(default_factory=list)


class LecturerReportComment(BaseModel):
    id: int
    userId: int
    userName: str
    userRole: str
    comment: str
    parentCommentId: int | None = None
    createdAt: str


class LecturerReportDetailResponse(BaseModel):
    report: LecturerReportItem
    comments: list[LecturerReportComment] = Field(default_factory=list)


class LecturerReportReviewRequest(BaseModel):
    status: Literal["APPROVED", "REVISION_REQUIRED"]
    score: float | None = Field(default=None, ge=0, le=10)
    feedback: str | None = Field(default=None, max_length=5000)


class LecturerReportActionResponse(BaseModel):
    reportId: int
    message: str


class LecturerReportCommentRequest(BaseModel):
    comment: str = Field(min_length=1, max_length=5000)
    parentCommentId: int | None = None


class LecturerReportCommentResponse(BaseModel):
    comment: LecturerReportComment
