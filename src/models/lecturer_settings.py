from __future__ import annotations

from pydantic import BaseModel, Field


class LecturerProfileSettingsResponse(BaseModel):
    id: int
    fullName: str
    lecturerCode: str | None = None
    email: str
    phone: str | None = None
    academicTitle: str | None = None
    faculty: str | None = None
    specialization: str | None = None
    hasAvatar: bool = False


class LecturerAccountSettingsResponse(BaseModel):
    email: str
    authProvider: str = "LOCAL"
    canChangePassword: bool = True


class LecturerNotificationSettingsResponse(BaseModel):
    reportDeadline: bool = True
    studentMessages: bool = True
    internshipStatus: bool = True
    emailNotifications: bool = False


class LecturerSettingsResponse(BaseModel):
    profile: LecturerProfileSettingsResponse
    account: LecturerAccountSettingsResponse
    notifications: LecturerNotificationSettingsResponse


class UpdateLecturerProfileRequest(BaseModel):
    fullName: str = Field(min_length=1, max_length=150)
    phone: str | None = Field(default=None, max_length=30)
    lecturerCode: str | None = Field(default=None, max_length=50)
    academicTitle: str | None = Field(default=None, max_length=100)
    faculty: str | None = Field(default=None, max_length=150)
    specialization: str | None = Field(default=None, max_length=2000)


class ChangeLecturerPasswordRequest(BaseModel):
    currentPassword: str = Field(min_length=6, max_length=200)
    newPassword: str = Field(min_length=8, max_length=200)


class UpdateLecturerNotificationsRequest(BaseModel):
    reportDeadline: bool
    studentMessages: bool
    internshipStatus: bool
    emailNotifications: bool
