from io import BytesIO

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)

from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.database.connection import get_db

from  src.models.internship_registration import (
    RegistrationFormRequest,
)

from src.security.auth import get_current_user

from src.services.internship_registration_service import (
    delete_application_document,
    delete_draft,
    get_application_document,
    save_application_document,
    save_draft,
    serialize_registration,
    submit_application,
)


router = APIRouter(
    prefix="/student/internship-registration",
    tags=["Internship Registration"],
)


MAX_FILE_SIZE = 10 * 1024 * 1024

ALLOWED_EXTENSIONS = (
    ".pdf",
    ".doc",
    ".docx",
)


def require_student(
    current_user=Depends(
        get_current_user
    ),
):
    if (
        current_user["role"]
        != "STUDENT"
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Chỉ sinh viên mới "
                "được sử dụng chức năng này."
            ),
        )

    return current_user


@router.get("")
def get_registration(
    db: Session = Depends(get_db),

    current_user=Depends(
        require_student
    ),
):
    try:
        return serialize_registration(
            db,
            current_user["id"],
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.put("/draft")
def update_draft(
    payload: RegistrationFormRequest,

    db: Session = Depends(get_db),

    current_user=Depends(
        require_student
    ),
):
    try:
        save_draft(
            db,
            current_user["id"],
            payload.model_dump(),
        )

        return serialize_registration(
            db,
            current_user["id"],
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.post("/submit")
def submit(
    db: Session = Depends(get_db),

    current_user=Depends(
        require_student
    ),
):
    try:
        submit_application(
            db,
            current_user["id"],
        )

        return serialize_registration(
            db,
            current_user["id"],
        )

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.delete("")
def remove_draft(
    db: Session = Depends(get_db),

    current_user=Depends(
        require_student
    ),
):
    try:
        delete_draft(
            db,
            current_user["id"],
        )

        return {
            "status": "ok",
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.post(
    "/documents/{document_type}"
)
async def upload_document(
    document_type: str,

    file: UploadFile = File(...),

    db: Session = Depends(get_db),

    current_user=Depends(
        require_student
    ),
):
    filename = (
        file.filename
        or "document"
    )

    if not filename.lower().endswith(
        ALLOWED_EXTENSIONS
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Chỉ hỗ trợ PDF, DOC và DOCX."
            ),
        )

    file_data = await file.read()

    if not file_data:
        raise HTTPException(
            status_code=400,
            detail="File rỗng.",
        )

    if len(file_data) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=(
                "File không được vượt quá 10MB."
            ),
        )

    try:
        document_id = (
            save_application_document(
                db,
                current_user["id"],
                document_type.upper(),
                filename,
                file.content_type
                or "application/octet-stream",
                file_data,
            )
        )

        return {
            "status": "ok",
            "documentId": document_id,
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc


@router.get(
    "/documents/{document_id}/file"
)
def view_document(
    document_id: int,

    db: Session = Depends(get_db),

    current_user=Depends(
        require_student
    ),
):
    document = get_application_document(
        db,
        current_user["id"],
        document_id,
    )

    if document is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy tài liệu.",
        )

    filename = document[
        "original_file_name"
    ].replace('"', "")

    return StreamingResponse(
        BytesIO(
            bytes(
                document["file_data"]
            )
        ),

        media_type=document[
            "mime_type"
        ],

        headers={
            "Content-Disposition":
                f'inline; filename="{filename}"'
        },
    )


@router.delete(
    "/documents/{document_id}"
)
def remove_document(
    document_id: int,

    db: Session = Depends(get_db),

    current_user=Depends(
        require_student
    ),
):
    try:
        deleted = (
            delete_application_document(
                db,
                current_user["id"],
                document_id,
            )
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
        }

    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc