from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

# Public API fields intentionally follow the frontend camelCase contract.
# ruff: noqa: N815

LecturerGender = Literal["MALE", "FEMALE", "OTHER"]
LecturerAccountStatus = Literal["REGISTERED", "PENDING"]
LecturerWorkload = Literal["AVAILABLE", "ASSIGNED", "HIGH"]


class AdminLecturerBaseRequest(BaseModel):
    fullName: str = Field(min_length=2, max_length=150)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=30)
    gender: LecturerGender | None = None
    lecturerCode: str = Field(min_length=2, max_length=50)
    academicTitle: str | None = Field(default=None, max_length=100)
    faculty: str | None = Field(default=None, max_length=150)
    specialization: str | None = Field(default=None, max_length=2000)

    @field_validator(
        "fullName",
        "phone",
        "lecturerCode",
        "academicTitle",
        "faculty",
        "specialization",
        mode="before",
    )
    @classmethod
    def normalize_text(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        normalized = value.strip()
        return normalized or None

    @field_validator("lecturerCode")
    @classmethod
    def normalize_lecturer_code(cls, value: str) -> str:
        return value.upper()


class AdminLecturerCreateRequest(AdminLecturerBaseRequest):
    password: str = Field(min_length=8, max_length=128)
    isActive: bool = True


class AdminLecturerUpdateRequest(AdminLecturerBaseRequest):
    isActive: bool
    newPassword: str | None = Field(default=None, min_length=8, max_length=128)


class AdminLecturerStatusRequest(BaseModel):
    isActive: bool


class AdminLecturerItem(BaseModel):
    id: int
    fullName: str
    email: str
    phone: str | None = None
    gender: LecturerGender | None = None
    avatarUrl: str | None = None
    lecturerCode: str
    academicTitle: str | None = None
    faculty: str | None = None
    specialization: str | None = None
    isActive: bool
    authProvider: Literal["LOCAL", "GOOGLE"]
    accountStatus: LecturerAccountStatus
    assignedStudents: int = 0
    activeInternships: int = 0
    completedInternships: int = 0
    pendingReviews: int = 0
    workload: LecturerWorkload
    lastAssignmentAt: datetime | None = None
    createdAt: datetime | None = None
    updatedAt: datetime | None = None


class AdminLecturerSummary(BaseModel):
    total: int = 0
    active: int = 0
    inactive: int = 0
    assignedStudents: int = 0
    pendingReviews: int = 0
    available: int = 0
    assigned: int = 0
    highWorkload: int = 0
    averageLoad: float = 0


class AdminLecturerFilters(BaseModel):
    faculties: list[str] = Field(default_factory=list)
    academicTitles: list[str] = Field(default_factory=list)


class AdminLecturersResponse(BaseModel):
    items: list[AdminLecturerItem]
    total: int
    page: int
    pageSize: int
    totalPages: int
    summary: AdminLecturerSummary
    filters: AdminLecturerFilters


class AdminLecturerResponse(BaseModel):
    lecturer: AdminLecturerItem
    message: str


class AdminLecturerActionResponse(BaseModel):
    lecturer: AdminLecturerItem
    message: str
