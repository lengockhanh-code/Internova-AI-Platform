from __future__ import annotations

from io import BytesIO
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.models.admin_reports import AdminReportDetailResponse, AdminReportsResponse
from src.security.auth import get_current_user
from src.services.admin_reports_service import (
    AdminReportNotFoundError,
    get_admin_report_detail,
    get_admin_report_file,
    list_admin_reports,
)


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if str(current_user.get("role") or "").upper() != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role is required",
        )
    return current_user


router = APIRouter(
    prefix="/api/v1/admin/reports",
    tags=["Admin Reports"],
    dependencies=[Depends(require_admin)],
)


@router.get("", response_model=AdminReportsResponse)
def list_reports(db: Session = Depends(get_db)) -> AdminReportsResponse:
    return AdminReportsResponse(**list_admin_reports(db))


@router.get("/{report_id}", response_model=AdminReportDetailResponse)
def get_report(
    report_id: int,
    db: Session = Depends(get_db),
) -> AdminReportDetailResponse:
    try:
        return AdminReportDetailResponse(**get_admin_report_detail(db, report_id))
    except AdminReportNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


def _stream_report_file(file_row, download: bool):
    if file_row is None or not file_row["file_data"]:
        raise HTTPException(status_code=404, detail="Báo cáo chưa có file đính kèm.")
    disposition = "attachment" if download else "inline"
    filename = quote(file_row["file_name"] or "report-file")
    return StreamingResponse(
        BytesIO(bytes(file_row["file_data"])),
        media_type=file_row["mime_type"] or "application/octet-stream",
        headers={
            "Content-Disposition": f"{disposition}; filename*=UTF-8''{filename}"
        },
    )


@router.get("/{report_id}/file")
def open_report_file(
    report_id: int,
    download: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return _stream_report_file(
        get_admin_report_file(db, report_id), download=download
    )


@router.get("/{report_id}/completion-letter")
def open_completion_letter(
    report_id: int,
    download: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    return _stream_report_file(
        get_admin_report_file(db, report_id, completion_letter=True),
        download=download,
    )
