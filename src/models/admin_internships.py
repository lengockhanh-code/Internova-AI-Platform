from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# Public API fields intentionally follow the frontend camelCase contract.
# ruff: noqa: N815

ApplicationStatus = Literal[
    "SUBMITTED",
    "UNDER_REVIEW",
    "APPROVED",
    "REJECTED",
]


class AdminInternshipSummary(BaseModel):
    total: int = 0
    submitted: int = 0
    underReview: int = 0
    approved: int = 0
    rejected: int = 0
    unassigned: int = 0


class AdminInternshipPeriodOption(BaseModel):
    id: int
    name: str
    semesterCode: str = ""
    academicYear: str = ""


class AdminInternshipLecturerOption(BaseModel):
    id: int
    fullName: str
    lecturerCode: str = ""
    faculty: str = ""


class AdminInternshipListItem(BaseModel):
    applicationId: int
    studentId: int
    studentName: str
    studentCode: str = ""
    className: str = ""
    major: str = ""
    periodId: int | None = None
    periodName: str = ""
    companyName: str = ""
    internshipPosition: str = ""
    workMode: str | None = None
    status: ApplicationStatus
    submittedAt: str | None = None
    reviewedAt: str | None = None
    documentCount: int = 0
    internshipId: int | None = None
    assignedLecturer: AdminInternshipLecturerOption | None = None


class AdminInternshipsResponse(BaseModel):
    summary: AdminInternshipSummary = Field(default_factory=AdminInternshipSummary)
    periods: list[AdminInternshipPeriodOption] = Field(default_factory=list)
    lecturers: list[AdminInternshipLecturerOption] = Field(default_factory=list)
    applications: list[AdminInternshipListItem] = Field(default_factory=list)


class AdminInternshipStudent(BaseModel):
    id: int
    fullName: str
    studentCode: str = ""
    email: str
    phone: str | None = None
    faculty: str | None = None
    major: str | None = None
    className: str | None = None


class AdminInternshipCompany(BaseModel):
    id: int | None = None
    name: str = ""
    industry: str | None = None
    address: str | None = None
    website: str | None = None


class AdminInternshipMentor(BaseModel):
    id: int | None = None
    fullName: str = ""
    position: str | None = None
    department: str | None = None
    email: str | None = None
    phone: str | None = None


class AdminInternshipDocument(BaseModel):
    id: int
    documentType: str
    title: str
    originalFileName: str
    mimeType: str
    fileSize: int
    createdAt: str


class AdminInternshipDetail(BaseModel):
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
    period: AdminInternshipPeriodOption | None = None
    assignedLecturer: AdminInternshipLecturerOption | None = None
    student: AdminInternshipStudent
    company: AdminInternshipCompany
    mentor: AdminInternshipMentor
    documents: list[AdminInternshipDocument] = Field(default_factory=list)


class AdminInternshipDetailResponse(BaseModel):
    application: AdminInternshipDetail


class AdminInternshipAssignmentRequest(BaseModel):
    lecturerId: int


class AdminInternshipReviewRequest(BaseModel):
    status: Literal["UNDER_REVIEW", "APPROVED", "REJECTED"]
    comment: str | None = Field(default=None, max_length=5000)


class AdminInternshipActionResponse(BaseModel):
    applicationId: int
    internshipId: int | None = None
    message: str
