from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    id: int

    title: str
    message: str

    type: str
    severity: str = "INFO"
    relatedType: str | None = None
    relatedId: int | None = None

    read: bool

    createdAt: str


class NotificationReadRequest(BaseModel):
    isRead: bool


class CalendarItemResponse(BaseModel):
    id: int

    source: str

    title: str

    description: str | None = None

    eventType: str | None = None

    startTime: str

    endTime: str | None = None

    location: str | None = None

    editable: bool = False


class NotificationsCalendarResponse(BaseModel):
    unreadCount: int = 0

    notifications: list[
        NotificationResponse
    ] = Field(
        default_factory=list
    )

    events: list[
        CalendarItemResponse
    ] = Field(
        default_factory=list
    )


class CalendarEventCreate(BaseModel):
    title: str = Field(
        min_length=1,
        max_length=255,
    )

    description: str | None = None

    eventType: str | None = None

    startTime: datetime

    endTime: datetime | None = None

    location: str | None = None


class CalendarEventUpdate(
    CalendarEventCreate
):
    pass
