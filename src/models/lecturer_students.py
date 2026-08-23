from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ============================================================
# REQUEST MODELS
# ============================================================


class LecturerNoteCreate(BaseModel):
    content: str = Field(
        min_length=1,
        max_length=5000,
    )


class LecturerReminderCreate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=255,
    )

    description: str | None = Field(
        default=None,
        max_length=5000,
    )

    remindAt: datetime


# ============================================================
# NOTE RESPONSE
# ============================================================


class LecturerStudentNoteResponse(BaseModel):
    id: int

    studentId: int

    content: str

    createdAt: str | None = None


# ============================================================
# REMINDER RESPONSE
# ============================================================


class LecturerStudentReminderResponse(BaseModel):
    id: int

    title: str

    description: str | None = None

    remindAt: str | None = None


# ============================================================
# STUDENT LIST ITEM
#
# Dùng cho:
# GET /api/v1/lecturers/students
# ============================================================


class LecturerStudentListItem(BaseModel):
    studentId: int

    internshipId: int

    studentName: str

    studentCode: str | None = None

    email: EmailStr | None = None

    companyName: str | None = None

    positionTitle: str | None = None

    progressPercentage: float = Field(
        default=0.0,
        ge=0.0,
        le=100.0,
    )

    averageScore: float = Field(
        default=0.0,
        ge=0.0,
        le=10.0,
    )

    status: str


# ============================================================
# STUDENT DETAIL
#
# Dùng cho:
# GET /api/v1/lecturers/students/{student_id}
# ============================================================


class LecturerStudentDetailResponse(BaseModel):
    studentId: int

    internshipId: int

    studentName: str

    email: EmailStr | None = None

    studentCode: str | None = None

    avatarUrl: str | None = None

    faculty: str | None = None

    major: str | None = None

    companyName: str | None = None

    positionTitle: str | None = None

    progressPercentage: float = Field(
        default=0.0,
        ge=0.0,
        le=100.0,
    )

    averageScore: float = Field(
        default=0.0,
        ge=0.0,
        le=10.0,
    )

    startDate: str | None = None

    endDate: str | None = None

    status: str

    notes: list[
        LecturerStudentNoteResponse
    ] = Field(
        default_factory=list,
    )

    reminders: list[
        LecturerStudentReminderResponse
    ] = Field(
        default_factory=list,
    )
