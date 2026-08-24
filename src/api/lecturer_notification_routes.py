from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.models.lecturer_notifications import (
    LecturerNotificationMutationResponse,
    LecturerNotificationReadRequest,
    LecturerNotificationsResponse,
    LecturerUnreadCountResponse,
)
from src.security.auth import require_lecturer
from src.services.lecturer_notification_service import (
    delete_lecturer_notification,
    delete_read_lecturer_notifications,
    get_lecturer_notifications,
    get_lecturer_unread_count,
    mark_all_lecturer_notifications_read,
    set_lecturer_notification_read,
)

router = APIRouter(
    prefix="/lecturers/notifications",
    tags=["Lecturer Notifications"],
    dependencies=[Depends(require_lecturer)],
)


@router.get("/unread-count", response_model=LecturerUnreadCountResponse)
def read_unread_count(
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerUnreadCountResponse:
    return LecturerUnreadCountResponse(
        unreadCount=get_lecturer_unread_count(db, current_user["id"]),
    )


@router.get("", response_model=LecturerNotificationsResponse)
def list_notifications(
    read_status: Literal["ALL", "UNREAD", "READ"] = Query("ALL", alias="status"),
    severity: Literal[
        "ALL", "INFO", "SUCCESS", "WARNING", "ERROR", "ATTENTION"
    ] = "ALL",
    notification_type: str | None = Query(None, alias="type", max_length=100),
    search: str | None = Query(None, max_length=200),
    period: Literal["ALL", "TODAY"] = "ALL",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, alias="pageSize", ge=1, le=50),
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerNotificationsResponse:
    return LecturerNotificationsResponse(**get_lecturer_notifications(
        db,
        current_user["id"],
        read_status=read_status,
        severity=severity,
        notification_type=notification_type,
        search=search,
        period=period,
        page=page,
        page_size=page_size,
    ))


@router.post("/read-all", response_model=LecturerNotificationMutationResponse)
def read_all_notifications(
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerNotificationMutationResponse:
    return LecturerNotificationMutationResponse(
        affectedCount=mark_all_lecturer_notifications_read(
            db,
            current_user["id"],
        )
    )


@router.delete("/read", response_model=LecturerNotificationMutationResponse)
def delete_read_notifications(
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerNotificationMutationResponse:
    return LecturerNotificationMutationResponse(
        affectedCount=delete_read_lecturer_notifications(
            db,
            current_user["id"],
        )
    )


@router.patch(
    "/{notification_id}",
    response_model=LecturerNotificationMutationResponse,
)
def update_notification(
    notification_id: int,
    payload: LecturerNotificationReadRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerNotificationMutationResponse:
    if not set_lecturer_notification_read(
        db,
        current_user["id"],
        notification_id,
        payload.isRead,
    ):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy thông báo.",
        )
    return LecturerNotificationMutationResponse(affectedCount=1)


@router.delete(
    "/{notification_id}",
    response_model=LecturerNotificationMutationResponse,
)
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerNotificationMutationResponse:
    if not delete_lecturer_notification(db, current_user["id"], notification_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy thông báo.",
        )
    return LecturerNotificationMutationResponse(affectedCount=1)
