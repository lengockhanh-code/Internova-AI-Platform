from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from sqlalchemy.orm import Session

from src.database.connection import (
    get_db,
)
from src.models.lecturer_students import (
    LecturerNoteCreate,
    LecturerReminderCreate,
)
from src.security.auth import require_lecturer
from src.services.lecturer_students_service import (
    create_student_note,
    create_student_reminder,
    get_lecturer_students,
    get_student_detail,
)

router = APIRouter(
    prefix="/lecturers/students",
    tags=["Lecturer Students"],
    dependencies=[Depends(require_lecturer)],
)


@router.get("")
def list_students(
    db: Session = Depends(
        get_db
    ),
    current_user=Depends(require_lecturer),
):
    return get_lecturer_students(
        db=db,
        lecturer_id=current_user["id"],
    )


@router.get(
    "/{student_id}"
)
def student_detail(
    student_id: int,

    db: Session = Depends(
        get_db
    ),
    current_user=Depends(require_lecturer),
):
    result = get_student_detail(
        db=db,
        student_id=student_id,
        lecturer_id=current_user["id"],
    )


    if result is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Không tìm thấy sinh viên."
            ),
        )


    return result


@router.post(
    "/{student_id}/notes"
)
def add_note(
    student_id: int,

    payload: LecturerNoteCreate,

    db: Session = Depends(
        get_db
    ),
    current_user=Depends(require_lecturer),
):
    result = create_student_note(
        db=db,

        student_id=student_id,

        content=payload.content,
        lecturer_id=current_user["id"],
    )

    if result is None:
        raise HTTPException(status_code=404, detail="Sinh viên không thuộc quyền hướng dẫn.")

    return result


@router.post(
    "/{student_id}/reminders"
)
def add_reminder(
    student_id: int,

    payload: LecturerReminderCreate,

    db: Session = Depends(
        get_db
    ),
    current_user=Depends(require_lecturer),
):
    result = create_student_reminder(
        db=db,

        student_id=student_id,

        title=payload.title,

        description=payload.description,

        remind_at=payload.remindAt,
        lecturer_id=current_user["id"],
    )


    if result is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Sinh viên chưa có "
                "kỳ thực tập."
            ),
        )


    return result
