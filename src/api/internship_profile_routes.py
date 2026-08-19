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

from src.database.connection import (
    get_db,
)

from src.models.internship_profile import (
    InternshipProfileResponse,
)

from src.security.auth import (
    get_current_user,
)

from src.services.internship_profile_service import (
    delete_document,
    get_document_file,
    get_internship_profile,
    save_internship_document,
)


router = APIRouter(
    prefix="/student/internship-profile",
    tags=["Student Internship Profile"],
)


ALLOWED_CONTENT_TYPES = {
    "application/pdf",

    "application/msword",

    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
}


MAX_FILE_SIZE = (
    10 * 1024 * 1024
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


# ============================================================
# GET PROFILE
# ============================================================

@router.get(
    "",
    response_model=
        InternshipProfileResponse,
)
def read_profile(
    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):

    try:

        return get_internship_profile(
            db=db,

            student_id=
                current_user["id"],
        )

    except ValueError as exc:

        raise HTTPException(
            status_code=404,
            detail=str(exc),
        ) from exc


# ============================================================
# UPLOAD DOCUMENT
# ============================================================

@router.post(
    "/documents/{document_type}"
)
async def upload_document(
    document_type: str,

    file: UploadFile =
        File(...),

    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):

    document_type = (
        document_type.upper()
    )


    # --------------------------------------------------------
    # FILE NAME
    # --------------------------------------------------------

    filename = (
        file.filename
        or "document"
    )


    lower_filename = (
        filename.lower()
    )


    extension_valid = any(
        lower_filename.endswith(
            extension
        )
        for extension
        in ALLOWED_EXTENSIONS
    )


    if not extension_valid:

        raise HTTPException(
            status_code=400,

            detail=(
                "Chỉ hỗ trợ "
                "PDF, DOC và DOCX."
            ),
        )


    # --------------------------------------------------------
    # MIME
    # --------------------------------------------------------

    content_type = (
        file.content_type
        or "application/octet-stream"
    )


    if (
        content_type
        not in ALLOWED_CONTENT_TYPES
    ):
        raise HTTPException(
            status_code=400,

            detail=(
                "Định dạng file "
                "không được hỗ trợ."
            ),
        )


    # --------------------------------------------------------
    # READ FILE
    # --------------------------------------------------------

    file_data = (
        await file.read()
    )


    if not file_data:

        raise HTTPException(
            status_code=400,

            detail=(
                "File rỗng."
            ),
        )


    if (
        len(file_data)
        > MAX_FILE_SIZE
    ):
        raise HTTPException(
            status_code=413,

            detail=(
                "File không được "
                "vượt quá 10MB."
            ),
        )


    try:

        result = (
            save_internship_document(
                db=db,

                student_id=
                    current_user["id"],

                document_type=
                    document_type,

                original_file_name=
                    filename,

                mime_type=
                    content_type,

                file_data=
                    file_data,
            )
        )


        return {
            "status":
                "ok",

            "message":
                "Tải tài liệu thành công.",

            "document": {
                "id":
                    result["id"],

                "documentType":
                    result[
                        "document_type"
                    ],

                "originalFileName":
                    result[
                        "original_file_name"
                    ],

                "fileSize":
                    int(
                        result[
                            "file_size"
                        ]
                    ),

                "status":
                    result[
                        "status"
                    ],
            },
        }


    except ValueError as exc:

        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


# ============================================================
# DOWNLOAD / VIEW
# ============================================================

@router.get(
    "/documents/{document_id}/file"
)
def download_document(
    document_id: int,

    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):

    document = (
        get_document_file(
            db=db,

            student_id=
                current_user["id"],

            document_id=
                document_id,
        )
    )


    if document is None:

        raise HTTPException(
            status_code=404,

            detail=(
                "Không tìm thấy tài liệu."
            ),
        )


    return StreamingResponse(
        BytesIO(
            bytes(
                document[
                    "file_data"
                ]
            )
        ),

        media_type=
            document[
                "mime_type"
            ],

        headers={
            "Content-Disposition":
                (
                    'inline; filename="'
                    + document[
                        "original_file_name"
                    ].replace(
                        '"',
                        "",
                    )
                    + '"'
                )
        },
    )


# ============================================================
# DELETE
# ============================================================

@router.delete(
    "/documents/{document_id}"
)
def remove_document(
    document_id: int,

    db: Session =
        Depends(get_db),

    current_user =
        Depends(require_student),
):

    deleted = delete_document(
        db=db,

        student_id=
            current_user["id"],

        document_id=
            document_id,
    )


    if not deleted:

        raise HTTPException(
            status_code=404,

            detail=(
                "Không tìm thấy tài liệu."
            ),
        )


    return {
        "status": "ok",

        "message":
            "Đã xóa tài liệu.",
    }