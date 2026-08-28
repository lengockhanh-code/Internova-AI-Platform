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
    ChecklistBatchCreate,
    ChecklistBatchCreateResponse,
    ChecklistGroupTasksCreate,
    ChecklistGroupUpdate,
    ChecklistItemCreate,
    ChecklistItemUpdate,
    ChecklistResponse,
    ChecklistStatusUpdate,
)

from src.security.auth import (
    get_current_user,
)

from src.services.checklist_service import (
    add_checklist_group_tasks,
    create_checklist_group,
    create_checklist_item,
    delete_checklist_group,
    delete_checklist_item,
    get_checklist,
    update_checklist_group,
    update_checklist_item,
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


@router.post(
    "/batch",
    response_model=ChecklistBatchCreateResponse,
)
def create_tasks(
    payload: ChecklistBatchCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_student),
):
    result = create_checklist_group(
        db=db,
        student_id=current_user["id"],
        title=payload.title,
        category=payload.category,
        priority=payload.priority,
        due_at=payload.dueAt,
        task_titles=[task.title for task in payload.tasks],
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Sinh viên chưa có kỳ thực tập.",
        )

    group_id, rows = result
    return ChecklistBatchCreateResponse(
        created=len(rows),
        groupId=group_id,
        ids=[int(row["id"]) for row in rows],
    )


@router.post("/groups/{group_id}/tasks")
def add_group_tasks(
    group_id: int,
    payload: ChecklistGroupTasksCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_student),
):
    rows = add_checklist_group_tasks(
        db=db,
        student_id=current_user["id"],
        group_id=group_id,
        task_titles=[task.title for task in payload.tasks],
    )
    if rows is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy nhóm checklist.",
        )
    return {
        "status": "ok",
        "created": len(rows),
        "ids": [int(row["id"]) for row in rows],
    }


@router.patch("/groups/{group_id}")
def update_group(
    group_id: int,
    payload: ChecklistGroupUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_student),
):
    row = update_checklist_group(
        db=db,
        student_id=current_user["id"],
        group_id=group_id,
        title=payload.title,
    )
    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy nhóm checklist.",
        )
    return {"status": "ok"}


@router.delete("/groups/{group_id}")
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(require_student),
):
    if not delete_checklist_group(
        db=db,
        student_id=current_user["id"],
        group_id=group_id,
    ):
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy nhóm checklist.",
        )
    return {"status": "ok"}


@router.patch("/{item_id}")
def update_task(
    item_id: int,
    payload: ChecklistItemUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(require_student),
):
    row = update_checklist_item(
        db=db,
        student_id=current_user["id"],
        item_id=item_id,
        title=payload.title,
    )
    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy công việc.",
        )
    return {"status": "ok"}


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
