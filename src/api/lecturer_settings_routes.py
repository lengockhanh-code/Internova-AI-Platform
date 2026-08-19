from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.models.lecturer_settings import (
    ChangeLecturerPasswordRequest,
    LecturerSettingsResponse,
    UpdateLecturerNotificationsRequest,
    UpdateLecturerProfileRequest,
)
from src.security.auth import require_lecturer
from src.services.lecturer_settings_service import (
    change_lecturer_password,
    delete_lecturer_avatar,
    get_lecturer_avatar,
    get_lecturer_settings,
    save_lecturer_avatar,
    update_lecturer_notifications,
    update_lecturer_profile,
)

router = APIRouter(
    prefix="/lecturers/settings",
    tags=["Lecturer Settings"],
    dependencies=[Depends(require_lecturer)],
)

MAX_AVATAR_SIZE = 5 * 1024 * 1024
ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.get("", response_model=LecturerSettingsResponse)
def read_settings(
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerSettingsResponse:
    try:
        return LecturerSettingsResponse(
            **get_lecturer_settings(db, current_user["id"])
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put("/profile", response_model=LecturerSettingsResponse)
def update_profile(
    payload: UpdateLecturerProfileRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerSettingsResponse:
    try:
        update_lecturer_profile(
            db,
            current_user["id"],
            full_name=payload.fullName,
            phone=payload.phone,
            lecturer_code=payload.lecturerCode,
            academic_title=payload.academicTitle,
            faculty=payload.faculty,
            specialization=payload.specialization,
        )
        return LecturerSettingsResponse(
            **get_lecturer_settings(db, current_user["id"])
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
):
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ JPG, PNG hoặc WEBP.")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Ảnh tải lên bị rỗng.")
    if len(data) > MAX_AVATAR_SIZE:
        raise HTTPException(status_code=413, detail="Ảnh không được vượt quá 5MB.")

    save_lecturer_avatar(
        db,
        current_user["id"],
        filename=file.filename or "avatar",
        mime_type=file.content_type,
        file_data=data,
    )
    return {"status": "ok"}


@router.get("/avatar")
def read_avatar(
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
):
    avatar = get_lecturer_avatar(db, current_user["id"])
    if avatar is None or avatar["avatar_data"] is None:
        raise HTTPException(status_code=404, detail="Chưa có ảnh đại diện.")
    return StreamingResponse(
        BytesIO(bytes(avatar["avatar_data"])),
        media_type=avatar["avatar_mime_type"],
        headers={"Content-Disposition": "inline"},
    )


@router.delete("/avatar")
def remove_avatar(
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
):
    delete_lecturer_avatar(db, current_user["id"])
    return {"status": "ok"}


@router.put("/password")
def update_password(
    payload: ChangeLecturerPasswordRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
):
    try:
        change_lecturer_password(
            db,
            current_user["id"],
            current_password=payload.currentPassword,
            new_password=payload.newPassword,
        )
        return {"status": "ok", "message": "Đổi mật khẩu thành công."}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.put("/notifications")
def update_notifications(
    payload: UpdateLecturerNotificationsRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
):
    update_lecturer_notifications(
        db,
        current_user["id"],
        report_deadline=payload.reportDeadline,
        student_messages=payload.studentMessages,
        internship_status=payload.internshipStatus,
        email_notifications=payload.emailNotifications,
    )
    return {"status": "ok", "notifications": payload.model_dump()}
