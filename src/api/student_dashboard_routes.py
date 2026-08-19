from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)

from sqlalchemy.orm import Session

from src.database.connection import (
    get_db,
)

from src.models.student_dashboard import (
    StudentDashboardResponse,
)

from src.security.auth import (
    get_current_user,
)

from src.services.student_dashboard_service import (
    get_student_dashboard,
)


router = APIRouter(
    prefix="/student",
    tags=["Student"],
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
    "/dashboard",
    response_model=
        StudentDashboardResponse,
)
def student_dashboard(
    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):

    try:
        return get_student_dashboard(
            db=db,

            student_id=
                current_user["id"],
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc