from __future__ import annotations

from io import BytesIO

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)

from fastapi.responses import (
    StreamingResponse,
)

from sqlalchemy.orm import Session

from starlette.concurrency import (
    run_in_threadpool,
)

from src.database.connection import (
    get_db,
)

from src.models.student_reports import (
    ReportCreateRequest,
    ReportUpdateRequest,
)

from src.security.auth import (
    get_current_user,
)

from src.services.reports_ai_review_service import (
    extract_report_text,
    review_report_with_ai,
)

from src.services.student_report_service import (
    create_report,
    delete_report,
    get_completion_letter,
    get_report_file,
    get_report_for_ai,
    get_reports,
    save_completion_letter,
    save_report_file,
    submit_report,
    update_report,
)


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/student/reports",
    tags=["Student Reports"],
)


# ============================================================
# CONFIG
# ============================================================

MAX_FILE_SIZE = (
    10 * 1024 * 1024
)


DOCX_MIME = (
    "application/"
    "vnd.openxmlformats-officedocument."
    "wordprocessingml.document"
)


REPORT_FILE_TYPES = {
    "application/pdf",
    DOCX_MIME,
}


COMPLETION_LETTER_TYPES = {
    "application/pdf",
    DOCX_MIME,
    "image/jpeg",
    "image/png",
}


# ============================================================
# STUDENT GUARD
# ============================================================

def require_student(
    current_user=
        Depends(
            get_current_user
        ),
):

    if (
        current_user[
            "role"
        ]
        != "STUDENT"
    ):

        raise HTTPException(
            status_code=403,

            detail=(
                "Chức năng này chỉ dành cho sinh viên."
            ),
        )


    return current_user


# ============================================================
# GET REPORTS
# ============================================================

@router.get("")
def list_student_reports(
    db: Session =
        Depends(
            get_db
        ),

    current_user =
        Depends(
            require_student
        ),
):

    return get_reports(
        db=db,

        student_id=
            current_user[
                "id"
            ],
    )


# ============================================================
# CREATE
# ============================================================

@router.post("")
def create_student_report(
    payload:
        ReportCreateRequest,

    db: Session =
        Depends(
            get_db
        ),

    current_user =
        Depends(
            require_student
        ),
):

    try:

        report_id = (
            create_report(
                db=db,

                student_id=
                    current_user[
                        "id"
                    ],

                payload=
                    payload,
            )
        )


        return {
            "status":
                "ok",

            "report_id":
                report_id,
        }


    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


    except Exception as exc:

        db.rollback()


        print(
            "[CREATE REPORT ERROR]",
            repr(exc),
        )


        raise HTTPException(
            status_code=400,

            detail=(
                "Không thể tạo báo cáo. "
                "Báo cáo của tuần hoặc loại này "
                "có thể đã tồn tại."
            ),
        ) from exc


# ============================================================
# UPDATE
# ============================================================

@router.put(
    "/{report_id}"
)
def edit_student_report(
    report_id: int,

    payload:
        ReportUpdateRequest,

    db: Session =
        Depends(
            get_db
        ),

    current_user =
        Depends(
            require_student
        ),
):

    updated = update_report(
        db=db,

        student_id=
            current_user[
                "id"
            ],

        report_id=
            report_id,

        title=
            payload.title,

        content=
            payload.content,
    )


    if not updated:

        raise HTTPException(
            status_code=400,

            detail=(
                "Không thể chỉnh sửa báo cáo. "
                "Báo cáo có thể đã được nộp."
            ),
        )


    return {
        "status":
            "ok",
    }


# ============================================================
# DELETE
# ============================================================

@router.delete(
    "/{report_id}"
)
def delete_student_report(
    report_id: int,

    db: Session =
        Depends(
            get_db
        ),

    current_user =
        Depends(
            require_student
        ),
):

    deleted = delete_report(
        db=db,

        student_id=
            current_user[
                "id"
            ],

        report_id=
            report_id,
    )


    if not deleted:

        raise HTTPException(
            status_code=400,

            detail=(
                "Chỉ có thể xóa báo cáo ở trạng thái bản nháp."
            ),
        )


    return {
        "status":
            "ok",
    }


# ============================================================
# REPORT FILE UPLOAD
# ============================================================

@router.post(
    "/{report_id}/file"
)
async def upload_report_file(
    report_id: int,

    file: UploadFile =
        File(...),

    db: Session =
        Depends(
            get_db
        ),

    current_user =
        Depends(
            require_student
        ),
):

    mime_type = (
        file.content_type
        or ""
    )


    if (
        mime_type
        not in REPORT_FILE_TYPES
    ):

        raise HTTPException(
            status_code=400,

            detail=(
                "Báo cáo chỉ hỗ trợ file PDF và DOCX."
            ),
        )


    file_data = (
        await file.read()
    )


    if not file_data:

        raise HTTPException(
            status_code=400,

            detail="File rỗng.",
        )


    if (
        len(file_data)
        > MAX_FILE_SIZE
    ):

        raise HTTPException(
            status_code=413,

            detail=(
                "File không được vượt quá 10MB."
            ),
        )


    saved = save_report_file(
        db=db,

        student_id=
            current_user[
                "id"
            ],

        report_id=
            report_id,

        filename=
            file.filename
            or "report",

        mime_type=
            mime_type,

        file_data=
            file_data,
    )


    if not saved:

        raise HTTPException(
            status_code=400,

            detail=(
                "Không thể cập nhật file. "
                "Báo cáo có thể đã được nộp."
            ),
        )


    return {
        "status":
            "ok",

        "message":
            "Đã lưu file báo cáo.",
    }


# ============================================================
# VIEW / DOWNLOAD REPORT FILE
# ============================================================

@router.get(
    "/{report_id}/file"
)
def read_report_file(
    report_id: int,

    download: bool =
        False,

    db: Session =
        Depends(
            get_db
        ),

    current_user =
        Depends(
            require_student
        ),
):

    file_row = get_report_file(
        db=db,

        student_id=
            current_user[
                "id"
            ],

        report_id=
            report_id,
    )


    if (
        not file_row

        or

        file_row[
            "file_data"
        ]
        is None
    ):

        raise HTTPException(
            status_code=404,

            detail=(
                "Báo cáo chưa có file."
            ),
        )


    filename = (
        file_row[
            "file_name"
        ]
        or "report"
    ).replace(
        '"',
        "",
    )


    disposition = (
        "attachment"
        if download
        else "inline"
    )


    return StreamingResponse(
        BytesIO(
            bytes(
                file_row[
                    "file_data"
                ]
            )
        ),

        media_type=(
            file_row[
                "mime_type"
            ]
            or
            "application/octet-stream"
        ),

        headers={
            "Content-Disposition":
                (
                    f'{disposition}; '
                    f'filename="{filename}"'
                )
        },
    )


# ============================================================
# COMPLETION LETTER UPLOAD
# ============================================================

@router.post(
    "/{report_id}/completion-letter"
)
async def upload_completion_letter(
    report_id: int,

    file: UploadFile =
        File(...),

    db: Session =
        Depends(
            get_db
        ),

    current_user =
        Depends(
            require_student
        ),
):

    mime_type = (
        file.content_type
        or ""
    )


    if (
        mime_type
        not in COMPLETION_LETTER_TYPES
    ):

        raise HTTPException(
            status_code=400,

            detail=(
                "Letter of Completion chỉ hỗ trợ "
                "PDF, DOCX, JPG hoặc PNG."
            ),
        )


    file_data = (
        await file.read()
    )


    if not file_data:

        raise HTTPException(
            status_code=400,
            detail="File rỗng.",
        )


    if (
        len(file_data)
        > MAX_FILE_SIZE
    ):

        raise HTTPException(
            status_code=413,

            detail=(
                "File không được vượt quá 10MB."
            ),
        )


    saved = (
        save_completion_letter(
            db=db,

            student_id=
                current_user[
                    "id"
                ],

            report_id=
                report_id,

            filename=
                file.filename
                or
                "completion-letter",

            mime_type=
                mime_type,

            file_data=
                file_data,
        )
    )


    if not saved:

        raise HTTPException(
            status_code=400,

            detail=(
                "Letter of Completion chỉ được "
                "gắn với Final Report chưa được nộp."
            ),
        )


    return {
        "status":
            "ok",

        "message":
            "Đã lưu Letter of Completion.",
    }


# ============================================================
# VIEW / DOWNLOAD COMPLETION LETTER
# ============================================================

@router.get(
    "/{report_id}/completion-letter"
)
def read_completion_letter(
    report_id: int,

    download: bool =
        False,

    db: Session =
        Depends(
            get_db
        ),

    current_user =
        Depends(
            require_student
        ),
):

    file_row = (
        get_completion_letter(
            db=db,

            student_id=
                current_user[
                    "id"
                ],

            report_id=
                report_id,
        )
    )


    if (
        not file_row

        or

        file_row[
            "completion_letter_data"
        ]
        is None
    ):

        raise HTTPException(
            status_code=404,

            detail=(
                "Chưa có Letter of Completion."
            ),
        )


    filename = (
        file_row[
            "completion_letter_name"
        ]
        or "completion-letter"
    ).replace(
        '"',
        "",
    )


    disposition = (
        "attachment"
        if download
        else "inline"
    )


    return StreamingResponse(
        BytesIO(
            bytes(
                file_row[
                    "completion_letter_data"
                ]
            )
        ),

        media_type=(
            file_row[
                "completion_letter_mime_type"
            ]
            or
            "application/octet-stream"
        ),

        headers={
            "Content-Disposition":
                (
                    f'{disposition}; '
                    f'filename="{filename}"'
                )
        },
    )


# ============================================================
# AI REVIEW
#
# QUAN TRỌNG:
# Không INSERT.
# Không UPDATE weekly_reports.
# Không lưu kết quả AI.
# ============================================================

@router.post(
    "/{report_id}/ai-review"
)
async def ai_review_report(
    report_id: int,

    db: Session =
        Depends(
            get_db
        ),

    current_user =
        Depends(
            require_student
        ),
):

    report = (
        get_report_for_ai(
            db=db,

            student_id=
                current_user[
                    "id"
                ],

            report_id=
                report_id,
        )
    )


    if not report:

        raise HTTPException(
            status_code=404,

            detail=(
                "Không tìm thấy báo cáo."
            ),
        )


    # AI Review có ý nghĩa trước khi nộp
    # hoặc khi lecturer yêu cầu sửa.

    if (
        report[
            "status"
        ]
        not in {
            "DRAFT",
            "REVISION_REQUIRED",
        }
    ):

        raise HTTPException(
            status_code=400,

            detail=(
                "AI Review chỉ sử dụng "
                "khi báo cáo đang chỉnh sửa."
            ),
        )


    # ========================================================
    # 1. Ưu tiên content viết trực tiếp.
    # ========================================================

    report_content = (
        report[
            "content"
        ]
        or ""
    ).strip()


    # ========================================================
    # 2. Nếu không có content -> đọc PDF/DOCX.
    # ========================================================

    if (
        not report_content

        and

        report[
            "file_data"
        ]
        is not None
    ):

        try:

            report_content = (
                await run_in_threadpool(
                    extract_report_text,

                    bytes(
                        report[
                            "file_data"
                        ]
                    ),

                    report[
                        "mime_type"
                    ],
                )
            )


        except ValueError as exc:

            raise HTTPException(
                status_code=400,
                detail=str(exc),
            ) from exc


    # ========================================================
    # 3. Nothing to review
    # ========================================================

    if not report_content:

        raise HTTPException(
            status_code=400,

            detail=(
                "Báo cáo chưa có nội dung "
                "để AI Review."
            ),
        )


    # ========================================================
    # 4. AI CALL
    # ========================================================

    try:

        review_result = (
            await run_in_threadpool(
                review_report_with_ai,

                report[
                    "report_type"
                ],

                report_content,
            )
        )


        # ====================================================
        # CHỈ RETURN RESPONSE.
        #
        # Không save DB.
        # ====================================================

        return review_result


    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


    except Exception as exc:

        print(
            "[AI REPORT REVIEW ERROR]",
            repr(exc),
        )


        raise HTTPException(
            status_code=500,

            detail=(
                "AI Review hiện không thể "
                "xử lý báo cáo."
            ),
        ) from exc


# ============================================================
# SUBMIT / RESUBMIT
# ============================================================

@router.post(
    "/{report_id}/submit"
)
def submit_student_report(
    report_id: int,

    db: Session =
        Depends(
            get_db
        ),

    current_user =
        Depends(
            require_student
        ),
):

    try:

        report_status = (
            submit_report(
                db=db,

                student_id=
                    current_user[
                        "id"
                    ],

                report_id=
                    report_id,
            )
        )


        return {
            "status":
                "ok",

            "report_status":
                report_status,

            "message":
                "Đã nộp báo cáo.",
        }


    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc