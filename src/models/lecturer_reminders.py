from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


ReminderMessageType = Literal["MESSAGE", "REMINDER", "WARNING"]
AlertSeverity = Literal["INFO", "WARNING", "ERROR"]


class LecturerReminderSummary(BaseModel):
    totalStudents: int = 0
    needsAttention: int = 0
    sentMessages: int = 0
    unreadByStudents: int = 0


class LecturerReminderStudent(BaseModel):
    studentId: int
    internshipId: int
    studentName: str
    studentCode: str = ""
    className: str = ""
    major: str = ""
    avatarUrl: str | None = None
    companyName: str = ""
    positionTitle: str = ""
    internshipStatus: str
    progressPercentage: float = 0
    overdueReportCount: int = 0
    lateReportCount: int = 0
    pendingReviewCount: int = 0
    progressBehind: bool = False
    warningCount: int = 0
    messageCount: int = 0
    unreadMessageCount: int = 0
    latestMessage: str | None = None
    latestMessageType: ReminderMessageType | None = None
    latestMessageAt: str | None = None


class LecturerRemindersResponse(BaseModel):
    summary: LecturerReminderSummary = Field(
        default_factory=LecturerReminderSummary,
    )
    students: list[LecturerReminderStudent] = Field(default_factory=list)


class LecturerStudentAlert(BaseModel):
    key: str
    severity: AlertSeverity
    title: str
    description: str
    relatedId: int | None = None
    occurredAt: str | None = None


class LecturerStudentMessage(BaseModel):
    id: int
    messageType: ReminderMessageType
    content: str
    isRead: bool
    readAt: str | None = None
    createdAt: str


class LecturerReminderConversationResponse(BaseModel):
    student: LecturerReminderStudent
    alerts: list[LecturerStudentAlert] = Field(default_factory=list)
    messages: list[LecturerStudentMessage] = Field(default_factory=list)


class LecturerReminderMessageCreate(BaseModel):
    messageType: ReminderMessageType = "REMINDER"
    content: str = Field(min_length=1, max_length=5000)


class LecturerReminderMessageResponse(BaseModel):
    message: LecturerStudentMessage
    notificationId: int
