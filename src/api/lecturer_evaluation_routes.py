from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.models.lecturer_evaluations import (
    LecturerEvaluationActionResponse,
    LecturerEvaluationDetailResponse,
    LecturerEvaluationSaveRequest,
    LecturerEvaluationsResponse,
)
from src.security.auth import require_lecturer
from src.services.lecturer_evaluation_service import (
    get_lecturer_evaluation_detail,
    get_lecturer_evaluations,
    save_lecturer_evaluation,
)

router = APIRouter(
    prefix="/lecturers/evaluations",
    tags=["Lecturer Evaluations"],
    dependencies=[Depends(require_lecturer)],
)


@router.get("", response_model=LecturerEvaluationsResponse)
def list_evaluations(
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerEvaluationsResponse:
    try:
        return LecturerEvaluationsResponse(**get_lecturer_evaluations(
            db=db,
            lecturer_id=current_user["id"],
        ))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get(
    "/{internship_id}/{evaluation_type}",
    response_model=LecturerEvaluationDetailResponse,
)
def get_evaluation(
    internship_id: int,
    evaluation_type: str,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerEvaluationDetailResponse:
    try:
        return LecturerEvaluationDetailResponse(
            **get_lecturer_evaluation_detail(
                db=db,
                internship_id=internship_id,
                evaluation_type=evaluation_type.upper(),
                lecturer_id=current_user["id"],
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.put(
    "/{internship_id}/{evaluation_type}",
    response_model=LecturerEvaluationActionResponse,
)
def save_evaluation(
    internship_id: int,
    evaluation_type: str,
    payload: LecturerEvaluationSaveRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerEvaluationActionResponse:
    try:
        return LecturerEvaluationActionResponse(
            **save_lecturer_evaluation(
                db=db,
                internship_id=internship_id,
                evaluation_type=evaluation_type.upper(),
                payload=payload,
                lecturer_id=current_user["id"],
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
