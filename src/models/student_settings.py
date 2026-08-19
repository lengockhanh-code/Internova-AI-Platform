from __future__ import annotations

from pydantic import (
    BaseModel,
    Field,
)


class StudentProfileSettingsResponse(BaseModel):
    id: int

    fullName: str

    studentCode: str | None = None

    email: str

    phone: str | None = None

    faculty: str | None = None

    major: str | None = None

    cohort: str | None = None

    hasAvatar: bool = False


class AccountSettingsResponse(BaseModel):
    email: str

    emailVerified: bool = True

    authProvider: str = "LOCAL"

    canChangePassword: bool = True


class NotificationSettingsResponse(BaseModel):
    reportDeadline: bool = True

    lecturerFeedback: bool = True

    internshipStatus: bool = True

    emailNotifications: bool = False


class StudentSettingsResponse(BaseModel):
    profile: StudentProfileSettingsResponse

    account: AccountSettingsResponse

    notifications: NotificationSettingsResponse


class UpdateStudentProfileRequest(BaseModel):
    fullName: str = Field(
        min_length=1,
        max_length=150,
    )

    phone: str | None = Field(
        default=None,
        max_length=30,
    )

    faculty: str | None = Field(
        default=None,
        max_length=255,
    )

    major: str | None = Field(
        default=None,
        max_length=255,
    )

    cohort: str | None = Field(
        default=None,
        max_length=100,
    )


class ChangePasswordRequest(BaseModel):
    currentPassword: str = Field(
        min_length=6,
        max_length=200,
    )

    newPassword: str = Field(
        min_length=8,
        max_length=200,
    )


class UpdateNotificationSettingsRequest(BaseModel):
    reportDeadline: bool

    lecturerFeedback: bool

    internshipStatus: bool

    emailNotifications: bool