from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

NotificationSeverity = Literal["INFO", "SUCCESS", "WARNING", "ERROR"]


class LecturerNotificationItem(BaseModel):
    id: int
    title: str
    message: str
    type: str
    severity: NotificationSeverity = "INFO"
    relatedType: str | None = None
    relatedId: int | None = None
    read: bool = False
    readAt: str | None = None
    createdAt: str


class LecturerNotificationSummary(BaseModel):
    total: int = 0
    unread: int = 0
    read: int = 0
    warnings: int = 0
    today: int = 0


class LecturerNotificationPagination(BaseModel):
    page: int = 1
    pageSize: int = 20
    totalItems: int = 0
    totalPages: int = 1


class LecturerNotificationsResponse(BaseModel):
    summary: LecturerNotificationSummary = Field(
        default_factory=LecturerNotificationSummary,
    )
    notifications: list[LecturerNotificationItem] = Field(default_factory=list)
    availableTypes: list[str] = Field(default_factory=list)
    pagination: LecturerNotificationPagination = Field(
        default_factory=LecturerNotificationPagination,
    )


class LecturerNotificationReadRequest(BaseModel):
    isRead: bool


class LecturerNotificationMutationResponse(BaseModel):
    status: Literal["ok"] = "ok"
    affectedCount: int = 0


class LecturerUnreadCountResponse(BaseModel):
    unreadCount: int = 0
