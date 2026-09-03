from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.models.admin_evaluations import (
    AdminEvaluationDetailResponse,
    AdminEvaluationsResponse,
)
from src.security.auth import get_current_user
from src.services.admin_evaluation_service import (
    AdminEvaluationNotFoundError,
    get_admin_evaluation_detail,
    list_admin_evaluations,
)


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if str(current_user.get("role") or "").upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role is required",
        )
    return current_user


router = APIRouter(
    prefix="/api/v1/admin/evaluations",
    tags=["Admin Evaluations"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=AdminEvaluationsResponse)
def list_evaluations(
    db: Session = Depends(get_db),
) -> AdminEvaluationsResponse:
    return AdminEvaluationsResponse(**list_admin_evaluations(db))


@router.get(
    "/{internship_id}/{evaluation_type}",
    response_model=AdminEvaluationDetailResponse,
)
def get_evaluation(
    internship_id: int,
    evaluation_type: str,
    db: Session = Depends(get_db),
) -> AdminEvaluationDetailResponse:
    try:
        return AdminEvaluationDetailResponse(
            **get_admin_evaluation_detail(
                db=db,
                internship_id=internship_id,
                evaluation_type=evaluation_type.upper(),
            )
        )
    except AdminEvaluationNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
