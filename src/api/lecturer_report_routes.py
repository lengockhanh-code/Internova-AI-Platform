from __future__ import annotations

from io import BytesIO
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.models.lecturer_reports import (
    LecturerReportActionResponse,
    LecturerReportCommentRequest,
    LecturerReportCommentResponse,
    LecturerReportDetailResponse,
    LecturerReportReviewRequest,
    LecturerReportsResponse,
)
from src.security.auth import require_lecturer
from src.services.lecturer_report_service import (
    add_lecturer_report_comment,
    get_lecturer_report_detail,
    get_lecturer_report_file,
    get_lecturer_reports,
    review_lecturer_report,
)

router = APIRouter(
    prefix="/lecturers/reports",
    tags=["Lecturer Reports"],
    dependencies=[Depends(require_lecturer)],
)


@router.get("", response_model=LecturerReportsResponse)
def list_lecturer_reports(
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerReportsResponse:
    try:
        return LecturerReportsResponse(**get_lecturer_reports(
            db=db,
            lecturer_id=current_user["id"],
        ))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get("/{report_id}", response_model=LecturerReportDetailResponse)
def get_report_detail(
    report_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerReportDetailResponse:
    try:
        return LecturerReportDetailResponse(
            **get_lecturer_report_detail(
                db=db,
                report_id=report_id,
                lecturer_id=current_user["id"],
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.put("/{report_id}/review", response_model=LecturerReportActionResponse)
def review_report(
    report_id: int,
    payload: LecturerReportReviewRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerReportActionResponse:
    try:
        return LecturerReportActionResponse(
            **review_lecturer_report(
                db=db,
                report_id=report_id,
                payload=payload,
                lecturer_id=current_user["id"],
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post(
    "/{report_id}/comments",
    response_model=LecturerReportCommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_report_comment(
    report_id: int,
    payload: LecturerReportCommentRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
) -> LecturerReportCommentResponse:
    try:
        return LecturerReportCommentResponse(
            **add_lecturer_report_comment(
                db=db,
                report_id=report_id,
                payload=payload,
                lecturer_id=current_user["id"],
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


def _stream_report_file(file_row, download: bool):
    if file_row is None or not file_row["file_data"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Báo cáo chưa có file đính kèm.",
        )

    filename = file_row["file_name"] or "report-file"
    disposition = "attachment" if download else "inline"
    encoded_filename = quote(filename)

    return StreamingResponse(
        BytesIO(bytes(file_row["file_data"])),
        media_type=file_row["mime_type"] or "application/octet-stream",
        headers={
            "Content-Disposition": (
                f"{disposition}; filename*=UTF-8''{encoded_filename}"
            )
        },
    )


@router.get("/{report_id}/file")
def open_report_file(
    report_id: int,
    download: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
):
    return _stream_report_file(
        get_lecturer_report_file(
            db=db,
            report_id=report_id,
            lecturer_id=current_user["id"],
        ),
        download=download,
    )


@router.get("/{report_id}/completion-letter")
def open_completion_letter(
    report_id: int,
    download: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user=Depends(require_lecturer),
):
    return _stream_report_file(
        get_lecturer_report_file(
            db=db,
            report_id=report_id,
            completion_letter=True,
            lecturer_id=current_user["id"],
        ),
        download=download,
    )
