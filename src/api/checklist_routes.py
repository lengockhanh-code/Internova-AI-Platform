from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from sqlalchemy.orm import Session

from src.database.connection import (
    get_db,
)

from src.models.checklist import (
    ChecklistItemCreate,
    ChecklistResponse,
    ChecklistStatusUpdate,
)

from src.security.auth import (
    get_current_user,
)

from src.services.checklist_service import (
    create_checklist_item,
    delete_checklist_item,
    get_checklist,
    update_checklist_status,
)


router = APIRouter(
    prefix="/checklist",
    tags=["Student Checklist"],
)


def require_student(
    current_user =
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


@router.get(
    "",
    response_model=
        ChecklistResponse,
)
def read_checklist(
    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):

    return get_checklist(
        db=db,
        student_id=
            current_user["id"],
    )


@router.post("")
def create_task(
    payload:
        ChecklistItemCreate,

    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):

    result = (
        create_checklist_item(
            db=db,

            student_id=
                current_user["id"],

            title=
                payload.title,

            description=
                payload.description,

            category=
                payload.category,

            priority=
                payload.priority,

            due_at=
                payload.dueAt,
        )
    )


    if result is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Sinh viên chưa có "
                "kỳ thực tập."
            ),
        )


    return {
        "status": "ok"
    }


@router.patch(
    "/{item_id}/status"
)
def update_status(
    item_id: int,

    payload:
        ChecklistStatusUpdate,

    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):

    result = (
        update_checklist_status(
            db=db,

            student_id=
                current_user["id"],

            item_id=
                item_id,

            status=
                payload.status,
        )
    )


    if result is None:
        raise HTTPException(
            status_code=404,
            detail=(
                "Không tìm thấy "
                "công việc."
            ),
        )


    return {
        "status": "ok"
    }


@router.delete(
    "/{item_id}"
)
def delete_task(
    item_id: int,

    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):

    deleted = (
        delete_checklist_item(
            db=db,

            student_id=
                current_user["id"],

            item_id=
                item_id,
        )
    )


    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=(
                "Không tìm thấy "
                "công việc."
            ),
        )


    return {
        "status": "ok"
    }