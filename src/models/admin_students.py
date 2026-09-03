from __future__ import annotations

# Public API fields intentionally follow the frontend camelCase contract.
# ruff: noqa: N815
from datetime import datetime
from typing import Literal

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    field_validator,
    model_validator,
)

StudentType = Literal["INTERNAL", "EXTERNAL"]
Gender = Literal["MALE", "FEMALE", "OTHER"]


class AdminStudentBaseRequest(BaseModel):
    fullName: str = Field(min_length=2, max_length=150)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=30)
    gender: Gender | None = None
    studentCode: str = Field(min_length=2, max_length=50)
    faculty: str | None = Field(default=None, max_length=150)
    major: str | None = Field(default=None, max_length=150)
    cohort: str | None = Field(default=None, max_length=50)
    gpa: float | None = Field(default=None, ge=0, le=10)
    studentType: StudentType

    @field_validator(
        "fullName",
        "studentCode",
        "phone",
        "faculty",
        "major",
        "cohort",
        mode="before",
    )
    @classmethod
    def normalize_text(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        normalized = value.strip()
        return normalized or None

    @field_validator("studentCode")
    @classmethod
    def normalize_student_code(cls, value: str) -> str:
        return value.upper()

    @model_validator(mode="after")
    def validate_student_type(self) -> AdminStudentBaseRequest:
        domain = str(self.email).rsplit("@", 1)[-1].lower()
        is_internal_email = domain == "vinuni.edu.vn"

        if self.studentType == "INTERNAL" and not is_internal_email:
            raise ValueError("Sinh viên nội bộ phải dùng email @vinuni.edu.vn.")
        if self.studentType == "EXTERNAL" and is_internal_email:
            raise ValueError("Sinh viên ngoài trường phải dùng email ngoài VinUni.")
        return self


class AdminStudentCreateRequest(AdminStudentBaseRequest):
    password: str = Field(min_length=8, max_length=128)


class AdminStudentUpdateRequest(AdminStudentBaseRequest):
    isActive: bool
    newPassword: str | None = Field(default=None, min_length=8, max_length=128)


class AdminStudentItem(BaseModel):
    id: int
    fullName: str
    email: str
    phone: str | None = None
    gender: Gender | None = None
    studentCode: str
    faculty: str | None = None
    major: str | None = None
    cohort: str | None = None
    gpa: float | None = None
    studentType: StudentType
    accountStatus: Literal["REGISTERED", "PENDING"]
    isActive: bool
    createdAt: datetime | None = None
    updatedAt: datetime | None = None


class AdminStudentSummary(BaseModel):
    total: int
    active: int
    inactive: int
    external: int


class AdminStudentFilters(BaseModel):
    faculties: list[str] = Field(default_factory=list)
    cohorts: list[str] = Field(default_factory=list)


class AdminStudentsResponse(BaseModel):
    items: list[AdminStudentItem]
    total: int
    page: int
    pageSize: int
    totalPages: int
    summary: AdminStudentSummary
    filters: AdminStudentFilters


class AdminStudentResponse(BaseModel):
    student: AdminStudentItem
    message: str


class AdminStudentActionResponse(BaseModel):
    studentId: int
    message: str
