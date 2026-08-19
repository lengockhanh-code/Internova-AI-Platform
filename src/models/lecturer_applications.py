from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


ApplicationStatus = Literal[
    "SUBMITTED",
    "UNDER_REVIEW",
    "APPROVED",
    "REJECTED",
]


class LecturerApplicationSummary(BaseModel):
    total: int = 0
    submitted: int = 0
    underReview: int = 0
    approved: int = 0
    rejected: int = 0


class LecturerApplicationPeriodOption(BaseModel):
    id: int
    name: str
    semesterCode: str = ""
    academicYear: str = ""


class LecturerApplicationListItem(BaseModel):
    applicationId: int
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
    internshipPosition: str = ""
    workMode: str | None = None
    status: ApplicationStatus
    submittedAt: str | None = None
    reviewedAt: str | None = None
    documentCount: int = 0
    internshipId: int | None = None


class LecturerApplicationsResponse(BaseModel):
    summary: LecturerApplicationSummary = Field(
        default_factory=LecturerApplicationSummary,
    )
    periods: list[LecturerApplicationPeriodOption] = Field(default_factory=list)
    applications: list[LecturerApplicationListItem] = Field(default_factory=list)


class LecturerApplicationStudent(BaseModel):
    id: int
    fullName: str
    studentCode: str = ""
    email: str
    phone: str | None = None
    faculty: str | None = None
    major: str | None = None
    className: str | None = None


class LecturerApplicationCompany(BaseModel):
    id: int | None = None
    name: str = ""
    industry: str | None = None
    address: str | None = None
    website: str | None = None


class LecturerApplicationMentor(BaseModel):
    id: int | None = None
    fullName: str = ""
    position: str | None = None
    department: str | None = None
    email: str | None = None
    phone: str | None = None


class LecturerApplicationDocument(BaseModel):
    id: int
    documentType: str
    title: str
    originalFileName: str
    mimeType: str
    fileSize: int
    createdAt: str


class LecturerApplicationDetail(BaseModel):
    applicationId: int
    status: ApplicationStatus
    internshipType: str | None = None
    description: str | None = None
    internshipPosition: str = ""
    workMode: str | None = None
    credits: int | None = None
    startDate: str | None = None
    endDate: str | None = None
    submittedAt: str | None = None
    reviewedAt: str | None = None
    lecturerComment: str | None = None
    internshipId: int | None = None

    period: LecturerApplicationPeriodOption | None = None
    student: LecturerApplicationStudent
    company: LecturerApplicationCompany
    mentor: LecturerApplicationMentor
    documents: list[LecturerApplicationDocument] = Field(default_factory=list)


class LecturerApplicationDetailResponse(BaseModel):
    application: LecturerApplicationDetail


class LecturerApplicationReviewRequest(BaseModel):
    status: Literal["UNDER_REVIEW", "APPROVED", "REJECTED"]
    comment: str | None = Field(default=None, max_length=5000)


class LecturerApplicationActionResponse(BaseModel):
    applicationId: int
    internshipId: int | None = None
    message: str
