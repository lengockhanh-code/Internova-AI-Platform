from __future__ import annotations

from io import BytesIO
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.models.lecturer_applications import (
    LecturerApplicationActionResponse,
    LecturerApplicationDetailResponse,
    LecturerApplicationReviewRequest,
    LecturerApplicationsResponse,
)
from src.security.auth import require_lecturer
from src.services.lecturer_application_service import (
    get_lecturer_application_detail,
    get_lecturer_application_document,
    get_lecturer_applications,
    review_lecturer_application,
)

router = APIRouter(
    prefix="/lecturers/applications",
    tags=["Lecturer Applications"],
    dependencies=[Depends(require_lecturer)],
)


@router.get("", response_model=LecturerApplicationsResponse)
def list_applications(
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerApplicationsResponse:
    try:
        return LecturerApplicationsResponse(**get_lecturer_applications(
            db=db,
            lecturer_id=current_user["id"],
        ))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get(
    "/{application_id}",
    response_model=LecturerApplicationDetailResponse,
)
def get_application(
    application_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerApplicationDetailResponse:
    try:
        return LecturerApplicationDetailResponse(
            **get_lecturer_application_detail(
                db=db,
                application_id=application_id,
                lecturer_id=current_user["id"],
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.put(
    "/{application_id}/review",
    response_model=LecturerApplicationActionResponse,
)
def review_application(
    application_id: int,
    payload: LecturerApplicationReviewRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerApplicationActionResponse:
    try:
        return LecturerApplicationActionResponse(
            **review_lecturer_application(
                db=db,
                application_id=application_id,
                payload=payload,
                lecturer_id=current_user["id"],
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get("/{application_id}/documents/{document_id}/file")
def open_application_document(
    application_id: int,
    document_id: int,
    download: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
):
    document = get_lecturer_application_document(
        db=db,
        application_id=application_id,
        document_id=document_id,
        lecturer_id=current_user["id"],
    )
    if document is None or not document["file_data"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài liệu của hồ sơ.",
        )

    disposition = "attachment" if download else "inline"
    filename = quote(document["original_file_name"] or "application-document")
    return StreamingResponse(
        BytesIO(bytes(document["file_data"])),
        media_type=document["mime_type"] or "application/octet-stream",
        headers={
            "Content-Disposition": (
                f"{disposition}; filename*=UTF-8''{filename}"
            )
        },
    )
