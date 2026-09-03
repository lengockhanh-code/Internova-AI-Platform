from __future__ import annotations

from io import BytesIO
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.models.admin_internships import (
    AdminInternshipActionResponse,
    AdminInternshipAssignmentRequest,
    AdminInternshipDetailResponse,
    AdminInternshipReviewRequest,
    AdminInternshipsResponse,
)
from src.security.auth import get_current_user
from src.services.admin_internships_service import (
    AdminInternshipNotFoundError,
    assign_admin_internship,
    get_admin_internship_detail,
    get_admin_internship_document,
    list_admin_internships,
    review_admin_internship,
)


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if str(current_user.get("role") or "").upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role is required",
        )
    return current_user


router = APIRouter(
    prefix="/api/v1/admin/internships",
    tags=["Admin Internship Applications"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=AdminInternshipsResponse)
def list_internships(db: Session = Depends(get_db)) -> AdminInternshipsResponse:
    return AdminInternshipsResponse(**list_admin_internships(db))


@router.get(
    "/{application_id}",
    response_model=AdminInternshipDetailResponse,
)
def get_internship(
    application_id: int,
    db: Session = Depends(get_db),
) -> AdminInternshipDetailResponse:
    try:
        return AdminInternshipDetailResponse(**get_admin_internship_detail(db, application_id))
    except AdminInternshipNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.put(
    "/{application_id}/assignment",
    response_model=AdminInternshipActionResponse,
)
def assign_internship(
    application_id: int,
    payload: AdminInternshipAssignmentRequest,
    db: Session = Depends(get_db),
) -> AdminInternshipActionResponse:
    try:
        return AdminInternshipActionResponse(**assign_admin_internship(db, application_id, payload.lecturerId))
    except AdminInternshipNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put(
    "/{application_id}/review",
    response_model=AdminInternshipActionResponse,
)
def review_internship(
    application_id: int,
    payload: AdminInternshipReviewRequest,
    db: Session = Depends(get_db),
) -> AdminInternshipActionResponse:
    try:
        return AdminInternshipActionResponse(**review_admin_internship(db, application_id, payload))
    except AdminInternshipNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{application_id}/documents/{document_id}/file")
def open_internship_document(
    application_id: int,
    document_id: int,
    download: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    document = get_admin_internship_document(db, application_id, document_id)
    if document is None or not document["file_data"]:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu hồ sơ.")

    disposition = "attachment" if download else "inline"
    filename = quote(document["original_file_name"] or "application-document")
    return StreamingResponse(
        BytesIO(bytes(document["file_data"])),
        media_type=document["mime_type"] or "application/octet-stream",
        headers={"Content-Disposition": f"{disposition}; filename*=UTF-8''{filename}"},
    )
