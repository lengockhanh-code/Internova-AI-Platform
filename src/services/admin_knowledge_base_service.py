from __future__ import annotations

import hashlib
import re
from datetime import date, datetime
from math import ceil
from pathlib import Path
from typing import Any

from fastapi import UploadFile
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


MAX_PAGE_SIZE = 100
DOCUMENT_STATUSES = {"ACTIVE", "INACTIVE", "ARCHIVED"}
VERSION_STATUSES = {"ACTIVE", "SUPERSEDED", "ARCHIVED"}
DOCUMENT_TYPES = {"PDF", "DOC"}
UPLOAD_ROOT = Path("data/knowledge_base/documents")


def _to_iso(value: datetime | date | str | None) -> str | None:
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return str(value)


def _normalize_page(value: int | None) -> int:
    return max(1, int(value or 1))


def _normalize_page_size(value: int | None) -> int:
    return min(MAX_PAGE_SIZE, max(1, int(value or 10)))


def _version_from_row(row: dict[str, Any], prefix: str = "version_") -> dict | None:
    version_id = row.get(f"{prefix}id")
    if version_id is None:
        return None

    return {
        "id": int(version_id),
        "version": row.get(f"{prefix}version") or "",
        "fileUrl": row.get(f"{prefix}file_url"),
        "fileHash": row.get(f"{prefix}file_hash"),
        "extractedTextPath": row.get(f"{prefix}extracted_text_path"),
        "chunkPath": row.get(f"{prefix}chunk_path"),
        "effectiveDate": _to_iso(row.get(f"{prefix}effective_date")),
        "status": row.get(f"{prefix}status") or "",
        "createdAt": _to_iso(row.get(f"{prefix}created_at")),
    }


def _index_job_from_row(row: dict[str, Any]) -> dict | None:
    job_id = row.get("job_id")
    if job_id is None:
        return None

    return {
        "id": int(job_id),
        "jobType": row.get("job_type") or "",
        "status": row.get("job_status") or "",
        "chunksCreated": int(row.get("chunks_created") or 0),
        "errorMessage": row.get("error_message"),
        "startedAt": _to_iso(row.get("started_at")),
        "completedAt": _to_iso(row.get("completed_at")),
        "createdAt": _to_iso(row.get("job_created_at")),
    }


def _document_from_row(row: dict[str, Any]) -> dict:
    uploaded_by = None
    if row.get("uploaded_by_id") is not None:
        uploaded_by = {
            "id": int(row["uploaded_by_id"]),
            "fullName": row.get("uploaded_by_name") or "",
            "email": str(row.get("uploaded_by_email") or ""),
        }

    return {
        "id": int(row["id"]),
        "title": row["title"],
        "documentType": row["document_type"],
        "description": row["description"],
        "fileUrl": row["file_url"],
        "currentVersion": row["current_version"],
        "year": int(row["year"]) if row["year"] is not None else None,
        "status": row["status"],
        "uploadedBy": uploaded_by,
        "createdAt": _to_iso(row["created_at"]),
        "updatedAt": _to_iso(row["updated_at"]),
        "currentVersionInfo": _version_from_row(row),
        "latestIndexJob": _index_job_from_row(row),
    }


def list_admin_knowledge_documents(
    db: Session,
    *,
    search: str | None = None,
    document_type: str | None = None,
    status: str | None = None,
    year: int | None = None,
    page: int | None = 1,
    page_size: int | None = 10,
) -> dict:
    page_value = _normalize_page(page)
    page_size_value = _normalize_page_size(page_size)
    offset = (page_value - 1) * page_size_value

    where_clauses: list[str] = []
    params: dict[str, Any] = {
        "limit": page_size_value,
        "offset": offset,
    }

    normalized_search = (search or "").strip()
    if normalized_search:
        where_clauses.append(
            "(kd.title ILIKE :search OR kd.description ILIKE :search OR kd.file_url ILIKE :search)"
        )
        params["search"] = f"%{normalized_search}%"

    if document_type:
        where_clauses.append("kd.document_type = :document_type")
        params["document_type"] = document_type

    if status:
        where_clauses.append("kd.status = :status")
        params["status"] = status

    if year is not None:
        where_clauses.append("kd.year = :year")
        params["year"] = year

    where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    total = db.execute(
        text(
            f"""
            SELECT COUNT(*)::INTEGER AS total
            FROM public.knowledge_documents AS kd
            {where_sql}
            """
        ),
        params,
    ).scalar_one()

    rows = db.execute(
        text(
            f"""
            SELECT
                kd.id,
                kd.title,
                kd.document_type,
                kd.description,
                kd.file_url,
                kd.current_version,
                kd.year,
                kd.status,
                kd.created_at,
                kd.updated_at,
                u.id AS uploaded_by_id,
                u.full_name AS uploaded_by_name,
                u.email AS uploaded_by_email,
                current_version.id AS version_id,
                current_version.version AS version_version,
                current_version.file_url AS version_file_url,
                current_version.file_hash AS version_file_hash,
                current_version.extracted_text_path AS version_extracted_text_path,
                current_version.chunk_path AS version_chunk_path,
                current_version.effective_date AS version_effective_date,
                current_version.status AS version_status,
                current_version.created_at AS version_created_at,
                latest_job.id AS job_id,
                latest_job.job_type,
                latest_job.status AS job_status,
                latest_job.chunks_created,
                latest_job.error_message,
                latest_job.started_at,
                latest_job.completed_at,
                latest_job.created_at AS job_created_at
            FROM public.knowledge_documents AS kd
            LEFT JOIN public.users AS u ON u.id = kd.uploaded_by
            LEFT JOIN LATERAL (
                SELECT kdv.*
                FROM public.knowledge_document_versions AS kdv
                WHERE kdv.document_id = kd.id
                ORDER BY
                    CASE
                        WHEN kd.current_version IS NOT NULL
                         AND kdv.version = kd.current_version THEN 0
                        ELSE 1
                    END,
                    kdv.effective_date DESC NULLS LAST,
                    kdv.created_at DESC,
                    kdv.id DESC
                LIMIT 1
            ) AS current_version ON TRUE
            LEFT JOIN LATERAL (
                SELECT rij.*
                FROM public.rag_index_jobs AS rij
                WHERE rij.document_version_id = current_version.id
                ORDER BY rij.created_at DESC, rij.id DESC
                LIMIT 1
            ) AS latest_job ON TRUE
            {where_sql}
            ORDER BY kd.updated_at DESC, kd.id DESC
            LIMIT :limit OFFSET :offset
            """
        ),
        params,
    ).mappings().all()

    filters = _get_document_filters(db)
    total_pages = ceil(int(total or 0) / page_size_value) if total else 0

    return {
        "items": [_document_from_row(dict(row)) for row in rows],
        "total": int(total or 0),
        "page": page_value,
        "pageSize": page_size_value,
        "totalPages": total_pages,
        "filters": filters,
    }


def get_admin_knowledge_document_detail(
    db: Session,
    document_id: int,
) -> dict:
    row = db.execute(
        text(
            """
            SELECT
                kd.id,
                kd.title,
                kd.document_type,
                kd.description,
                kd.file_url,
                kd.current_version,
                kd.year,
                kd.status,
                kd.created_at,
                kd.updated_at,
                u.id AS uploaded_by_id,
                u.full_name AS uploaded_by_name,
                u.email AS uploaded_by_email,
                current_version.id AS version_id,
                current_version.version AS version_version,
                current_version.file_url AS version_file_url,
                current_version.file_hash AS version_file_hash,
                current_version.extracted_text_path AS version_extracted_text_path,
                current_version.chunk_path AS version_chunk_path,
                current_version.effective_date AS version_effective_date,
                current_version.status AS version_status,
                current_version.created_at AS version_created_at,
                latest_job.id AS job_id,
                latest_job.job_type,
                latest_job.status AS job_status,
                latest_job.chunks_created,
                latest_job.error_message,
                latest_job.started_at,
                latest_job.completed_at,
                latest_job.created_at AS job_created_at
            FROM public.knowledge_documents AS kd
            LEFT JOIN public.users AS u ON u.id = kd.uploaded_by
            LEFT JOIN LATERAL (
                SELECT kdv.*
                FROM public.knowledge_document_versions AS kdv
                WHERE kdv.document_id = kd.id
                ORDER BY
                    CASE
                        WHEN kd.current_version IS NOT NULL
                         AND kdv.version = kd.current_version THEN 0
                        ELSE 1
                    END,
                    kdv.effective_date DESC NULLS LAST,
                    kdv.created_at DESC,
                    kdv.id DESC
                LIMIT 1
            ) AS current_version ON TRUE
            LEFT JOIN LATERAL (
                SELECT rij.*
                FROM public.rag_index_jobs AS rij
                WHERE rij.document_version_id = current_version.id
                ORDER BY rij.created_at DESC, rij.id DESC
                LIMIT 1
            ) AS latest_job ON TRUE
            WHERE kd.id = :document_id
            LIMIT 1
            """
        ),
        {"document_id": document_id},
    ).mappings().first()

    if row is None:
        raise ValueError("Knowledge document not found.")

    version_rows = _version_rows(db, document_id)

    document = _document_from_row(dict(row))
    document["versions"] = [
        _version_from_row(dict(version_row)) for version_row in version_rows
    ]

    return {"document": document}


def create_admin_knowledge_document(
    db: Session,
    *,
    payload: dict[str, Any],
    uploaded_by: int,
) -> dict:
    title = _clean_required(payload.get("title"), "Document title is required.")
    document_type = _clean_document_type(payload.get("documentType"))
    status = _clean_status(payload.get("status") or "ACTIVE")

    row = db.execute(
        text(
            """
            INSERT INTO public.knowledge_documents (
                title,
                document_type,
                description,
                file_url,
                current_version,
                year,
                status,
                uploaded_by
            )
            VALUES (
                :title,
                :document_type,
                :description,
                :file_url,
                :current_version,
                :year,
                :status,
                :uploaded_by
            )
            RETURNING id
            """
        ),
        {
            "title": title,
            "document_type": document_type,
            "description": _clean_optional(payload.get("description")),
            "file_url": _clean_optional(payload.get("fileUrl")),
            "current_version": _clean_optional(payload.get("currentVersion")),
            "year": payload.get("year"),
            "status": status,
            "uploaded_by": uploaded_by,
        },
    ).mappings().first()
    db.commit()

    return get_admin_knowledge_document_detail(db, int(row["id"]))


def update_admin_knowledge_document(
    db: Session,
    *,
    document_id: int,
    payload: dict[str, Any],
) -> dict:
    _ensure_document_exists(db, document_id)
    if not payload:
        raise ValueError("No document fields were provided.")

    column_map = {
        "title": ("title", lambda value: _clean_required(value, "Document title is required.")),
        "documentType": (
            "document_type",
            _clean_document_type,
        ),
        "description": ("description", _clean_optional),
        "fileUrl": ("file_url", _clean_optional),
        "currentVersion": ("current_version", _clean_optional),
        "year": ("year", lambda value: value),
        "status": ("status", _clean_status),
    }

    assignments: list[str] = []
    params: dict[str, Any] = {"document_id": document_id}

    for index, (field, value) in enumerate(payload.items()):
        if field not in column_map:
            continue

        column, cleaner = column_map[field]
        param_name = f"value_{index}"
        assignments.append(f"{column} = :{param_name}")
        params[param_name] = cleaner(value)

    if not assignments:
        raise ValueError("No supported document fields were provided.")

    assignments.append("updated_at = NOW()")
    db.execute(
        text(
            f"""
            UPDATE public.knowledge_documents
            SET {", ".join(assignments)}
            WHERE id = :document_id
            """
        ),
        params,
    )
    db.commit()

    return get_admin_knowledge_document_detail(db, document_id)


def archive_admin_knowledge_document(
    db: Session,
    *,
    document_id: int,
) -> dict:
    _ensure_document_exists(db, document_id)
    db.execute(
        text(
            """
            UPDATE public.knowledge_documents
            SET status = 'ARCHIVED',
                updated_at = NOW()
            WHERE id = :document_id
            """
        ),
        {"document_id": document_id},
    )
    db.commit()

    return get_admin_knowledge_document_detail(db, document_id)


def delete_admin_knowledge_document(
    db: Session,
    *,
    document_id: int,
) -> dict:
    _ensure_document_exists(db, document_id)
    db.execute(
        text(
            """
            DELETE FROM public.knowledge_documents
            WHERE id = :document_id
            """
        ),
        {"document_id": document_id},
    )
    db.commit()

    return {
        "documentId": document_id,
        "message": "Knowledge document deleted.",
    }


def list_admin_knowledge_document_versions(
    db: Session,
    *,
    document_id: int,
) -> dict:
    _ensure_document_exists(db, document_id)
    rows = _version_rows(db, document_id)
    return {
        "items": [_version_from_row(dict(row)) for row in rows],
    }


def create_admin_knowledge_document_version(
    db: Session,
    *,
    document_id: int,
    version: str,
    file: UploadFile,
    effective_date: date | None = None,
    status: str = "ACTIVE",
) -> dict:
    _ensure_document_exists(db, document_id)
    version_value = _clean_required(version, "Version is required.")
    status_value = _clean_version_status(status)

    original_name = _safe_filename(file.filename or f"document-{document_id}")
    content = file.file.read()
    if not content:
        raise ValueError("Uploaded file is empty.")

    file_hash = hashlib.sha256(content).hexdigest()
    target_dir = UPLOAD_ROOT / str(document_id) / _safe_path_part(version_value)
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / original_name
    target_path.write_bytes(content)

    file_url = str(target_path.as_posix())

    try:
        row = db.execute(
            text(
                """
                INSERT INTO public.knowledge_document_versions (
                    document_id,
                    version,
                    file_url,
                    file_hash,
                    effective_date,
                    status
                )
                VALUES (
                    :document_id,
                    :version,
                    :file_url,
                    :file_hash,
                    :effective_date,
                    :status
                )
                RETURNING id
                """
            ),
            {
                "document_id": document_id,
                "version": version_value,
                "file_url": file_url,
                "file_hash": file_hash,
                "effective_date": effective_date,
                "status": status_value,
            },
        ).mappings().first()
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ValueError("This document version already exists.") from exc

    return {
        "documentId": document_id,
        "versionId": int(row["id"]),
        "message": "Knowledge document version created.",
    }


def set_admin_knowledge_current_version(
    db: Session,
    *,
    document_id: int,
    version_id: int,
) -> dict:
    _ensure_document_exists(db, document_id)
    version_row = db.execute(
        text(
            """
            SELECT id, version, file_url
            FROM public.knowledge_document_versions
            WHERE id = :version_id
              AND document_id = :document_id
            LIMIT 1
            """
        ),
        {
            "document_id": document_id,
            "version_id": version_id,
        },
    ).mappings().first()

    if version_row is None:
        raise ValueError("Knowledge document version not found.")

    db.execute(
        text(
            """
            UPDATE public.knowledge_documents
            SET current_version = :version,
                file_url = COALESCE(:file_url, file_url),
                updated_at = NOW()
            WHERE id = :document_id
            """
        ),
        {
            "document_id": document_id,
            "version": version_row["version"],
            "file_url": version_row["file_url"],
        },
    )
    db.commit()

    return {
        "documentId": document_id,
        "versionId": version_id,
        "message": "Current document version updated.",
    }


def _get_document_filters(db: Session) -> dict:
    rows = db.execute(
        text(
            """
            SELECT
                ARRAY_REMOVE(ARRAY_AGG(DISTINCT document_type ORDER BY document_type), NULL) AS types,
                ARRAY_REMOVE(ARRAY_AGG(DISTINCT status ORDER BY status), NULL) AS statuses,
                ARRAY_REMOVE(ARRAY_AGG(DISTINCT year ORDER BY year), NULL) AS years
            FROM public.knowledge_documents
            """
        )
    ).mappings().first()

    return {
        "types": list(rows["types"] or []) if rows else [],
        "statuses": list(rows["statuses"] or []) if rows else [],
        "years": [int(year) for year in (rows["years"] or [])] if rows else [],
    }


def _version_rows(db: Session, document_id: int):
    return db.execute(
        text(
            """
            SELECT
                id AS version_id,
                version AS version_version,
                file_url AS version_file_url,
                file_hash AS version_file_hash,
                extracted_text_path AS version_extracted_text_path,
                chunk_path AS version_chunk_path,
                effective_date AS version_effective_date,
                status AS version_status,
                created_at AS version_created_at
            FROM public.knowledge_document_versions
            WHERE document_id = :document_id
            ORDER BY effective_date DESC NULLS LAST, created_at DESC, id DESC
            """
        ),
        {"document_id": document_id},
    ).mappings().all()


def _ensure_document_exists(db: Session, document_id: int) -> None:
    exists = db.execute(
        text(
            """
            SELECT 1
            FROM public.knowledge_documents
            WHERE id = :document_id
            LIMIT 1
            """
        ),
        {"document_id": document_id},
    ).scalar()

    if not exists:
        raise ValueError("Knowledge document not found.")


def _clean_required(value: Any, message: str) -> str:
    cleaned = str(value or "").strip()
    if not cleaned:
        raise ValueError(message)
    return cleaned


def _clean_optional(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _clean_status(value: Any) -> str:
    cleaned = str(value or "").strip().upper()
    if cleaned not in DOCUMENT_STATUSES:
        raise ValueError("Document status must be ACTIVE, INACTIVE, or ARCHIVED.")
    return cleaned


def _clean_document_type(value: Any) -> str:
    cleaned = str(value or "").strip().upper()
    if cleaned not in DOCUMENT_TYPES:
        raise ValueError("Document type must be PDF or DOC.")
    return cleaned


def _clean_version_status(value: Any) -> str:
    cleaned = str(value or "").strip().upper()
    if cleaned not in VERSION_STATUSES:
        raise ValueError("Version status must be ACTIVE, SUPERSEDED, or ARCHIVED.")
    return cleaned


def _safe_filename(value: str) -> str:
    name = Path(value).name.strip()
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip(".-")
    return cleaned or "document-file"


def _safe_path_part(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip(".-")
    return cleaned or "version"
