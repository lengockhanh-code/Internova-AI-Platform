from io import BytesIO

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)

from fastapi.responses import (
    StreamingResponse,
)

from sqlalchemy.orm import Session

from src.database.connection import (
    get_db,
)

from src.models.student_settings import (
    ChangePasswordRequest,
    StudentSettingsResponse,
    UpdateNotificationSettingsRequest,
    UpdateStudentProfileRequest,
)

from src.security.auth import (
    get_current_user,
)

from src.services.student_settings_service import (
    change_password,
    delete_avatar,
    get_avatar,
    get_student_settings,
    save_avatar,
    update_notification_preferences,
    update_student_profile,
)


router = APIRouter(
    prefix="/student/settings",
    tags=["Student Settings"],
)


MAX_AVATAR_SIZE = (
    5 * 1024 * 1024
)


ALLOWED_AVATAR_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}


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


# ============================================================
# GET SETTINGS
# ============================================================

@router.get(
    "",
    response_model=
        StudentSettingsResponse,
)
def read_settings(
    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):
    try:
        return get_student_settings(
            db,
            current_user["id"],
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc


# ============================================================
# UPDATE PROFILE
# ============================================================

@router.put("/profile")
def update_profile(
    payload:
        UpdateStudentProfileRequest,

    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):
    update_student_profile(
        db=db,

        student_id=
            current_user["id"],

        full_name=
            payload.fullName,

        phone=
            payload.phone,

        faculty=
            payload.faculty,

        major=
            payload.major,

        cohort=
            payload.cohort,
    )


    return get_student_settings(
        db,
        current_user["id"],
    )


# ============================================================
# UPLOAD AVATAR
# ============================================================

@router.post("/avatar")
async def upload_avatar(
    file: UploadFile =
        File(...),

    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):
    if (
        file.content_type
        not in ALLOWED_AVATAR_TYPES
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Chỉ hỗ trợ "
                "JPG, PNG hoặc WEBP."
            ),
        )


    data = await file.read()


    if not data:
        raise HTTPException(
            status_code=400,
            detail="Ảnh rỗng.",
        )


    if len(data) > MAX_AVATAR_SIZE:
        raise HTTPException(
            status_code=413,
            detail=(
                "Ảnh không được "
                "vượt quá 5MB."
            ),
        )


    save_avatar(
        db=db,

        student_id=
            current_user["id"],

        filename=
            file.filename
            or "avatar",

        mime_type=
            file.content_type,

        file_data=data,
    )


    return {
        "status": "ok",
    }


# ============================================================
# GET AVATAR
# ============================================================

@router.get("/avatar")
def read_avatar(
    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):
    avatar = get_avatar(
        db,
        current_user["id"],
    )


    if (
        avatar is None
        or avatar[
            "avatar_data"
        ] is None
    ):
        raise HTTPException(
            status_code=404,
            detail="Chưa có ảnh đại diện.",
        )


    return StreamingResponse(
        BytesIO(
            bytes(
                avatar[
                    "avatar_data"
                ]
            )
        ),

        media_type=
            avatar[
                "avatar_mime_type"
            ],

        headers={
            "Content-Disposition":
                "inline",
        },
    )


# ============================================================
# DELETE AVATAR
# ============================================================

@router.delete("/avatar")
def remove_avatar(
    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):
    delete_avatar(
        db,
        current_user["id"],
    )


    return {
        "status": "ok",
    }


# ============================================================
# PASSWORD
# ============================================================

@router.put("/password")
def update_password(
    payload:
        ChangePasswordRequest,

    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):
    try:
        change_password(
            db=db,

            student_id=
                current_user["id"],

            current_password=
                payload.currentPassword,

            new_password=
                payload.newPassword,
        )


        return {
            "status": "ok",
            "message":
                "Đổi mật khẩu thành công.",
        }


    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


# ============================================================
# NOTIFICATIONS
# ============================================================

@router.put("/notifications")
def update_notifications(
    payload:
        UpdateNotificationSettingsRequest,

    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):
    update_notification_preferences(
        db=db,

        student_id=
            current_user["id"],

        report_deadline=
            payload.reportDeadline,

        lecturer_feedback=
            payload.lecturerFeedback,

        internship_status=
            payload.internshipStatus,

        email_notifications=
            payload.emailNotifications,
    )


    return {
        "status": "ok",
        "notifications":
            payload.model_dump(),
    }