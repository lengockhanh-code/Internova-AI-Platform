from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

# Public API fields intentionally follow the frontend camelCase contract.
# ruff: noqa: N815

AdminUserRole = Literal["STUDENT", "LECTURER", "ADMIN"]
AdminUserStatus = Literal["ACTIVE", "INACTIVE"]
AdminAuthProvider = Literal["LOCAL", "GOOGLE"]


class AdminUserBaseRequest(BaseModel):
    fullName: str = Field(min_length=2, max_length=150)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=30)
    role: AdminUserRole
    isActive: bool = True
    identityCode: str | None = Field(default=None, max_length=50)
    faculty: str | None = Field(default=None, max_length=150)

    @field_validator("fullName", "phone", "identityCode", "faculty", mode="before")
    @classmethod
    def normalize_text(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        normalized = value.strip()
        return normalized or None

    @field_validator("identityCode")
    @classmethod
    def normalize_identity_code(cls, value: str | None) -> str | None:
        return value.upper() if value else None

    @model_validator(mode="after")
    def validate_role_profile(self) -> AdminUserBaseRequest:
        if self.role in {"STUDENT", "LECTURER"} and not self.identityCode:
            raise ValueError("Mã định danh là bắt buộc cho sinh viên và giảng viên.")
        return self


class AdminUserCreateRequest(AdminUserBaseRequest):
    password: str = Field(min_length=8, max_length=128)


class AdminUserUpdateRequest(AdminUserBaseRequest):
    pass


class AdminUserStatusRequest(BaseModel):
    isActive: bool


class AdminUserItem(BaseModel):
    id: int
    fullName: str
    email: str
    phone: str | None = None
    avatarUrl: str | None = None
    role: AdminUserRole
    isActive: bool
    authProvider: AdminAuthProvider
    accountStatus: Literal["REGISTERED", "PENDING"]
    identityCode: str | None = None
    faculty: str | None = None
    createdAt: datetime | None = None
    updatedAt: datetime | None = None


class AdminUserSummary(BaseModel):
    total: int = 0
    active: int = 0
    inactive: int = 0
    students: int = 0
    lecturers: int = 0
    admins: int = 0
    pending: int = 0


class AdminUsersResponse(BaseModel):
    items: list[AdminUserItem]
    total: int
    page: int
    pageSize: int
    totalPages: int
    currentUserId: int
    summary: AdminUserSummary


class AdminUserResponse(BaseModel):
    user: AdminUserItem
    message: str
