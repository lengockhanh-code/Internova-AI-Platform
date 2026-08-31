from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
)

from sqlalchemy.orm import Session

from src.database.connection import (
    get_db,
)

from src.models.notification import (
    CalendarEventCreate,
    CalendarEventUpdate,
    NotificationReadRequest,
)

from src.security.auth import (
    get_current_user,
)

from src.services.notification_service import (
    create_calendar_event,
    delete_calendar_event,
    get_calendar_events,
    get_notifications,
    get_unread_notification_count,
    mark_all_notifications_read,
    mark_notification,
    update_calendar_event,
)


router = APIRouter(
    prefix="/student/notifications-calendar",
    tags=["Student Notifications & Calendar"],
)


def require_student(
    current_user=
        Depends(get_current_user),
):
    if (
        current_user["role"]
        != "STUDENT"
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Chức năng này chỉ "
                "dành cho sinh viên."
            ),
        )

    return current_user


@router.get("/unread-count")
def read_unread_count(
    db: Session = Depends(get_db),
    current_user=Depends(require_student),
):
    return {
        "unreadCount": get_unread_notification_count(
            db,
            current_user["id"],
        )
    }


# ============================================================
# GET PAGE DATA
# ============================================================

@router.get("")
def read_page(
    year: int = Query(
        ge=2000,
        le=2100,
    ),

    month: int = Query(
        ge=1,
        le=12,
    ),

    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):
    user_id = current_user["id"]


    notification_rows = (
        get_notifications(
            db,
            user_id,
        )
    )


    notifications = [
        {
            "id":
                row["id"],

            "title":
                row["title"],

            "message":
                row["message"],

            "type":
                row[
                    "notification_type"
                ]
                or "system",

            "severity":
                row["severity"]
                or "INFO",

            "relatedType":
                row["related_type"],

            "relatedId":
                row["related_id"],

            "read":
                bool(
                    row["is_read"]
                ),

            "createdAt":
                row[
                    "created_at"
                ].isoformat(),
        }

        for row
        in notification_rows
    ]


    return {
        "unreadCount":
            sum(
                1
                for item
                in notifications
                if not item["read"]
            ),

        "notifications":
            notifications,

        "events":
            get_calendar_events(
                db=db,

                student_id=
                    user_id,

                year=year,

                month=month,
            ),
    }


# ============================================================
# NOTIFICATION READ
# ============================================================

@router.patch(
    "/notifications/{notification_id}"
)
def update_notification_read(
    notification_id: int,

    payload:
        NotificationReadRequest,

    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):
    updated = mark_notification(
        db=db,

        user_id=
            current_user["id"],

        notification_id=
            notification_id,

        is_read=
            payload.isRead,
    )


    if not updated:
        raise HTTPException(
            status_code=404,
            detail=(
                "Không tìm thấy thông báo."
            ),
        )


    return {
        "status": "ok",
    }


# ============================================================
# MARK ALL
# ============================================================

@router.post(
    "/notifications/read-all"
)
def read_all(
    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):
    mark_all_notifications_read(
        db,
        current_user["id"],
    )


    return {
        "status": "ok",
    }


# ============================================================
# CREATE EVENT
# ============================================================

@router.post("/events")
def create_event(
    payload:
        CalendarEventCreate,

    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):
    try:
        event_id = (
            create_calendar_event(
                db=db,

                student_id=
                    current_user["id"],

                title=
                    payload.title,

                description=
                    payload.description,

                event_type=
                    payload.eventType,

                start_time=
                    payload.startTime,

                end_time=
                    payload.endTime,

                location=
                    payload.location,
            )
        )


        return {
            "status": "ok",
            "eventId": event_id,
        }


    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


# ============================================================
# UPDATE EVENT
# ============================================================

@router.put(
    "/events/{event_id}"
)
def update_event(
    event_id: int,

    payload:
        CalendarEventUpdate,

    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):
    try:
        updated = (
            update_calendar_event(
                db=db,

                student_id=
                    current_user["id"],

                event_id=
                    event_id,

                title=
                    payload.title,

                description=
                    payload.description,

                event_type=
                    payload.eventType,

                start_time=
                    payload.startTime,

                end_time=
                    payload.endTime,

                location=
                    payload.location,
            )
        )


        if not updated:
            raise HTTPException(
                status_code=404,
                detail=(
                    "Không tìm thấy sự kiện."
                ),
            )


        return {
            "status": "ok",
        }


    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


# ============================================================
# DELETE EVENT
# ============================================================

@router.delete(
    "/events/{event_id}"
)
def delete_event(
    event_id: int,

    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):
    deleted = delete_calendar_event(
        db=db,

        student_id=
            current_user["id"],

        event_id=
            event_id,
    )


    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=(
                "Không tìm thấy sự kiện."
            ),
        )


    return {
        "status": "ok",
    }