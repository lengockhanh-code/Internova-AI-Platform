from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.models.lecturer_reminders import (
    LecturerReminderConversationResponse,
    LecturerReminderMessageCreate,
    LecturerReminderMessageResponse,
    LecturerRemindersResponse,
)
from src.security.auth import require_lecturer
from src.services.lecturer_reminder_service import (
    get_lecturer_reminder_conversation,
    get_lecturer_reminders,
    send_lecturer_reminder_message,
)
from src.services.notification_websocket_service import (
    notification_connections,
)

router = APIRouter(
    prefix="/lecturers/reminders",
    tags=["Lecturer Reminders & Warnings"],
    dependencies=[Depends(require_lecturer)],
)


@router.get("", response_model=LecturerRemindersResponse)
def list_reminders(
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerRemindersResponse:
    try:
        return LecturerRemindersResponse(**get_lecturer_reminders(
            db=db,
            lecturer_id=current_user["id"],
        ))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get(
    "/{student_id}",
    response_model=LecturerReminderConversationResponse,
)
def get_conversation(
    student_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerReminderConversationResponse:
    try:
        return LecturerReminderConversationResponse(
            **get_lecturer_reminder_conversation(
                db=db,
                student_id=student_id,
                lecturer_id=current_user["id"],
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/{student_id}/messages",
    response_model=LecturerReminderMessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    student_id: int,
    payload: LecturerReminderMessageCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerReminderMessageResponse:
    try:
        data = await run_in_threadpool(
            send_lecturer_reminder_message,
            db,
            student_id,
            payload,
            current_user["id"],
        )
        await notification_connections.send_to_user(
            student_id,
            {
                "type": "notification.created",
                "notificationId": data["notificationId"],
                "messageId": data["message"]["id"],
                "messageType": data["message"]["messageType"],
                "createdAt": data["message"]["createdAt"],
            },
        )
        return LecturerReminderMessageResponse(**data)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
