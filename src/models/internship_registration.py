from __future__ import annotations

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
)


class RegistrationStudentResponse(BaseModel):
    id: int

    fullName: str
    studentCode: str | None = None

    email: str
    phone: str | None = None

    faculty: str | None = None
    major: str | None = None
    cohort: str | None = None


class RegistrationFormRequest(BaseModel):
    credits: int = Field(
        ge=1,
        le=20,
    )

    companyName: str = Field(
        min_length=1,
        max_length=255,
    )

    industry: str | None = None
    companyAddress: str | None = None
    companyWebsite: str | None = None

    internshipPosition: str = Field(
        min_length=1,
        max_length=200,
    )

    jobDescription: str | None = None

    workMode: str

    startDate: str
    endDate: str

    mentorName: str = Field(
        min_length=1,
        max_length=150,
    )

    mentorPosition: str | None = None
    mentorEmail: EmailStr | None = None
    mentorPhone: str | None = None


class RegistrationDocumentResponse(BaseModel):
    id: int

    documentType: str
    title: str

    originalFileName: str
    fileSize: int
    mimeType: str


class RegistrationResponse(BaseModel):
    id: int

    status: str

    student: RegistrationStudentResponse

    form: RegistrationFormRequest | None = None

    documents: list[RegistrationDocumentResponse] = []

    submittedAt: str | None = None