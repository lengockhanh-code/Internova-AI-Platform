from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from src.database.connection import get_db
from src.models.admin_knowledge_base import (
    AdminKnowledgeDocumentActionResponse,
    AdminKnowledgeDocumentCreateRequest,
    AdminKnowledgeDocumentDetailResponse,
    AdminKnowledgeDocumentsResponse,
    AdminKnowledgeDocumentUpdateRequest,
    AdminKnowledgeDocumentVersionsResponse,
    AdminKnowledgeVersionActionResponse,
    AdminRagChunkDetailResponse,
    AdminRagChunksResponse,
)
from src.security.auth import get_current_user
from src.services.admin_knowledge_base_service import (
    archive_admin_knowledge_document,
    create_admin_knowledge_document,
    create_admin_knowledge_document_version,
    delete_admin_knowledge_document,
    get_admin_knowledge_document_detail,
    get_admin_knowledge_document_version_file,
    list_admin_knowledge_document_versions,
    list_admin_knowledge_documents,
    set_admin_knowledge_current_version,
    update_admin_knowledge_document,
)
from src.services.rag_index_service import (
    get_admin_rag_chunk,
    get_rag_index_status,
    list_admin_rag_chunks,
    rebuild_rag_index,
)


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    role = str(current_user.get("role") or "").upper()
    if role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role is required",
        )
    return current_user


router = APIRouter(
    prefix="/api/v1/admin/knowledge",
    tags=["Admin Knowledge Base"],
    dependencies=[Depends(require_admin)],
)


@router.get(
    "/documents",
    response_model=AdminKnowledgeDocumentsResponse,
)
def list_documents(
    search: str | None = Query(default=None),
    document_type: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    year: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100, alias="page_size"),
    db: Session = Depends(get_db),
) -> AdminKnowledgeDocumentsResponse:
    return AdminKnowledgeDocumentsResponse(
        **list_admin_knowledge_documents(
            db=db,
            search=search,
            document_type=document_type,
            status=status_filter,
            year=year,
            page=page,
            page_size=page_size,
        )
    )


@router.post(
    "/documents",
    response_model=AdminKnowledgeDocumentDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_document(
    payload: AdminKnowledgeDocumentCreateRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
) -> AdminKnowledgeDocumentDetailResponse:
    try:
        return AdminKnowledgeDocumentDetailResponse(
            **create_admin_knowledge_document(
                db=db,
                payload=payload.model_dump(),
                uploaded_by=int(current_user["id"]),
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get(
    "/documents/{document_id}",
    response_model=AdminKnowledgeDocumentDetailResponse,
)
def get_document(
    document_id: int,
    db: Session = Depends(get_db),
) -> AdminKnowledgeDocumentDetailResponse:
    try:
        return AdminKnowledgeDocumentDetailResponse(
            **get_admin_knowledge_document_detail(
                db=db,
                document_id=document_id,
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.patch(
    "/documents/{document_id}",
    response_model=AdminKnowledgeDocumentDetailResponse,
)
def update_document(
    document_id: int,
    payload: AdminKnowledgeDocumentUpdateRequest,
    db: Session = Depends(get_db),
) -> AdminKnowledgeDocumentDetailResponse:
    try:
        return AdminKnowledgeDocumentDetailResponse(
            **update_admin_knowledge_document(
                db=db,
                document_id=document_id,
                payload=payload.model_dump(exclude_unset=True),
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post(
    "/documents/{document_id}/archive",
    response_model=AdminKnowledgeDocumentDetailResponse,
)
def archive_document(
    document_id: int,
    db: Session = Depends(get_db),
) -> AdminKnowledgeDocumentDetailResponse:
    try:
        return AdminKnowledgeDocumentDetailResponse(
            **archive_admin_knowledge_document(
                db=db,
                document_id=document_id,
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.delete(
    "/documents/{document_id}",
    response_model=AdminKnowledgeDocumentActionResponse,
)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
) -> AdminKnowledgeDocumentActionResponse:
    try:
        return AdminKnowledgeDocumentActionResponse(
            **delete_admin_knowledge_document(
                db=db,
                document_id=document_id,
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get(
    "/documents/{document_id}/versions",
    response_model=AdminKnowledgeDocumentVersionsResponse,
)
def list_document_versions(
    document_id: int,
    db: Session = Depends(get_db),
) -> AdminKnowledgeDocumentVersionsResponse:
    try:
        return AdminKnowledgeDocumentVersionsResponse(
            **list_admin_knowledge_document_versions(
                db=db,
                document_id=document_id,
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.post(
    "/documents/{document_id}/versions",
    response_model=AdminKnowledgeVersionActionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_document_version(
    document_id: int,
    version: str = Form(...),
    effective_date: date | None = Form(default=None),
    version_status: str = Form(default="ACTIVE", alias="status"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> AdminKnowledgeVersionActionResponse:
    try:
        return AdminKnowledgeVersionActionResponse(
            **create_admin_knowledge_document_version(
                db=db,
                document_id=document_id,
                version=version,
                effective_date=effective_date,
                status=version_status,
                file=file,
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post(
    "/documents/{document_id}/versions/{version_id}/set-current",
    response_model=AdminKnowledgeVersionActionResponse,
)


@router.get("/chunks", response_model=AdminRagChunksResponse)
def list_chunks(
    search: str | None = Query(default=None),
    document_name: str | None = Query(default=None),
    document_type: str | None = Query(default=None),
    language: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100, alias="page_size"),
) -> AdminRagChunksResponse:
    try:
        return AdminRagChunksResponse(
            **list_admin_rag_chunks(
                search=search,
                document_name=document_name,
                document_type=document_type,
                language=language,
                page=page,
                page_size=page_size,
            )
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc


@router.get("/chunks/{chunk_id}", response_model=AdminRagChunkDetailResponse)
def get_chunk(chunk_id: str) -> AdminRagChunkDetailResponse:
    try:
        return AdminRagChunkDetailResponse(**get_admin_rag_chunk(chunk_id))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
def set_current_version(
    document_id: int,
    version_id: int,
    db: Session = Depends(get_db),
) -> AdminKnowledgeVersionActionResponse:
    try:
        return AdminKnowledgeVersionActionResponse(
            **set_admin_knowledge_current_version(
                db=db,
                document_id=document_id,
                version_id=version_id,
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        ) from exc


@router.get("/documents/{document_id}/versions/{version_id}/file")
def open_document_version_file(
    document_id: int,
    version_id: int,
    download: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    try:
        file_info = get_admin_knowledge_document_version_file(
            db=db,
            document_id=document_id,
            version_id=version_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if file_info is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tệp của phiên bản tài liệu.",
        )

    disposition = "attachment" if download else "inline"
    return FileResponse(
        path=file_info["filePath"],
        media_type=file_info["mediaType"],
        filename=file_info["fileName"],
        content_disposition_type=disposition,
    )


@router.get("/index-status")
def get_index_status(
    db: Session = Depends(get_db),
) -> dict:
    """Return the currently serving RAG index health/status."""

    try:
        return get_rag_index_status(db)

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Could not read RAG index status: {exc}",
        ) from exc



@router.post("/reindex")
def reindex_knowledge_base(
    db: Session = Depends(get_db),
) -> dict:
    """Fully rebuild and activate RAG from ACTIVE/current Admin documents."""

    try:
        return rebuild_rag_index(db)

    except RuntimeError as exc:
        message = str(exc)

        if message == "A RAG re-index operation is already running.":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=message,
            ) from exc

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=message,
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG re-index failed: {exc}",
        ) from exc
