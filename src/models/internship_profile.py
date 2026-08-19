from __future__ import annotations

from pydantic import BaseModel, Field


class StudentProfileInfo(BaseModel):
    id: int
    fullName: str
    studentCode: str | None = None
    email: str
    phone: str | None = None
    address: str | None = None
    avatarUrl: str | None = None


class InternshipInfoResponse(BaseModel):
    id: int
    status: str

    companyName: str | None = None
    positionTitle: str | None = None

    startDate: str | None = None
    endDate: str | None = None

    location: str | None = None


class MentorInfoResponse(BaseModel):
    fullName: str

    position: str | None = None
    email: str | None = None
    phone: str | None = None


class ProfileDocumentResponse(BaseModel):
    id: int | None = None

    key: str

    title: str

    status: str

    completed: bool

    uploaded: bool = False

    originalFileName: str | None = None

    fileSize: int | None = None

    mimeType: str | None = None

    uploadedAt: str | None = None


class InternshipProfileResponse(BaseModel):
    student: StudentProfileInfo

    internship:  InternshipInfoResponse | None = None

    mentor:  MentorInfoResponse | None = None

    documents: list[
        ProfileDocumentResponse
    ] = Field(
        default_factory=list
    )

    completionPercentage: int = 0

    missingDocuments: int = 0