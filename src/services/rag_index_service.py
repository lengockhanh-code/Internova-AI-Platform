from __future__ import annotations

import hashlib
import json
import logging
import shutil
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.config import get_settings
from src.rag.ingestion.pipeline import run_ingestion
from src.rag.schemas import DocumentChunk
from src.services.admin_knowledge_base_service import (
    list_rag_index_source_versions,
    repair_missing_managed_current_versions,
)
from src.services.chat_service import chat_service
from src.services.redis_cache_service import redis_cache


logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).resolve().parents[2]
RAG_BUILDS_ROOT = ROOT_DIR / "data" / "rag_builds"

ACTIVE_INDEX_POINTER = ROOT_DIR / "data" / "rag" / "active_index.json"

_REINDEX_LOCK_TTL_SECONDS = 30 * 60
_REINDEX_LOCK_WAIT_SECONDS = 0.0

_RAG_BUILD_KEEP_COUNT = 2
_RAG_BUILD_MIN_AGE_SECONDS = 60 * 60

def _reindex_lock_key() -> str:
    settings = get_settings()
    prefix = settings.redis_key_prefix.rstrip(":")
    return f"{prefix}:lock:rag-reindex"

def rebuild_rag_index(db: Session) -> dict:
    """Run one globally coordinated RAG rebuild.

    Redis is required for re-index coordination. We fail closed when Redis
    cannot be reached because running multiple full rebuilds concurrently
    across workers could publish conflicting indexes.
    """
    settings = get_settings()

    if not settings.redis_enabled:
        raise RuntimeError(
            "RAG re-index coordination unavailable: Redis is disabled."
        )

    if not redis_cache.ping():
        raise RuntimeError(
            "RAG re-index coordination unavailable: Redis is not reachable."
        )

    lock_key = _reindex_lock_key()

    with redis_cache.lock(
        key=lock_key,
        ttl_seconds=_REINDEX_LOCK_TTL_SECONDS,
        wait_seconds=_REINDEX_LOCK_WAIT_SECONDS,
    ) as acquired:

        if not acquired:
            # Distinguish infrastructure failure from normal contention.
            if not redis_cache.ping():
                raise RuntimeError(
                    "RAG re-index coordination unavailable: "
                    "Redis lock could not be acquired."
                )

            raise RuntimeError(
                "A RAG re-index operation is already running."
            )

        logger.info(
            "Acquired distributed RAG re-index lock key=%s",
            lock_key,
        )

        return _rebuild_rag_index_locked(db)

def _rebuild_rag_index_locked(db: Session) -> dict:
    """Fully rebuild RAG from exact ACTIVE/current Admin Knowledge Base versions.

    The currently active chatbot index remains untouched until:
    - every source is validated,
    - ingestion succeeds,
    - all expected documents appear in the manifest,
    - BM25 + Chroma artifacts exist,
    - the candidate QueryPipeline can be installed.

    Builds are immutable/versioned under data/rag_builds/.
    """

    job_ids: dict[int, int] = {}
    build_root: Path | None = None

    try:
        # --------------------------------------------------------------
        # 1. Resolve strict ACTIVE/current sources from Admin DB.
        # --------------------------------------------------------------

        repaired_versions = repair_missing_managed_current_versions(db)
        if repaired_versions:
            logger.warning(
                "Restored %s missing knowledge document version record(s)",
                repaired_versions,
            )

        sources = list_rag_index_source_versions(db)

        if not sources:
            raise RuntimeError(
                "No ACTIVE/current knowledge documents are available for RAG."
            )

        _validate_source_filenames(sources)
        _validate_source_hashes(sources)

        # --------------------------------------------------------------
        # 2. Create DB jobs.
        # --------------------------------------------------------------

        job_ids = _create_index_jobs(
            db=db,
            sources=sources,
        )

        _mark_jobs_running(
            db=db,
            job_ids=job_ids,
        )

        # --------------------------------------------------------------
        # 3. Create immutable/versioned build workspace.
        # --------------------------------------------------------------

        build_id = _new_build_id()

        build_root = RAG_BUILDS_ROOT / build_id
        source_dir = build_root / "source"
        rag_dir = build_root / "rag"
        chroma_dir = build_root / "chroma"

        source_dir.mkdir(
            parents=True,
            exist_ok=False,
        )

        rag_dir.mkdir(
            parents=True,
            exist_ok=False,
        )

        # Do not pre-populate the Chroma directory with any old index.
        # run_ingestion() creates/builds it for this new versioned build.

        # --------------------------------------------------------------
        # 4. Copy exact current source versions into staging.
        #
        # Keep original filenames for source display, manifest validation,
        # and per-document chunk accounting.
        #
        # Semantic RAG type is provided explicitly by Admin metadata and
        # must no longer depend on filename classification.
        # --------------------------------------------------------------

        staged_sources: list[dict] = []
        document_type_overrides: dict[str, str] = {}

        for source in sources:
            original_path = _absolute_source_path(
                source["file_path"]
            )

            destination = source_dir / original_path.name

            shutil.copy2(
                original_path,
                destination,
            )

            if _sha256(destination) != _sha256(original_path):
                raise RuntimeError(
                    f"Staged file hash mismatch: {original_path.name}"
                )

            relative_key = destination.relative_to(
                source_dir
            ).as_posix()

            rag_document_type = str(
                source.get("rag_document_type") or ""
            ).strip().lower()

            if not rag_document_type:
                raise RuntimeError(
                    "Missing semantic RAG document type for "
                    f"{original_path.name}"
                )

            if relative_key in document_type_overrides:
                raise RuntimeError(
                    "Duplicate staged RAG source key: "
                    f"{relative_key}"
                )

            document_type_overrides[
                relative_key
            ] = rag_document_type

            staged_sources.append(
                {
                    **source,
                    "staged_path": destination,
                    "file_name": original_path.name,
                }
            )

        # --------------------------------------------------------------
        # 5. Run existing ingestion pipeline into this build only.
        # --------------------------------------------------------------

        report = run_ingestion(
            source_dir=source_dir,
            output_dir=rag_dir,
            chroma_dir=chroma_dir,
            document_type_overrides=document_type_overrides,
        )

        # --------------------------------------------------------------
        # 6. Validate ingestion report.
        # --------------------------------------------------------------

        expected_documents = len(staged_sources)

        if report.errors:
            raise RuntimeError(
                "RAG ingestion failed: "
                + " | ".join(str(error) for error in report.errors)
            )

        if report.documents_seen != expected_documents:
            raise RuntimeError(
                "RAG source count mismatch: "
                f"expected={expected_documents}, "
                f"seen={report.documents_seen}"
            )

        if report.documents_loaded != expected_documents:
            raise RuntimeError(
                "RAG loaded document count mismatch: "
                f"expected={expected_documents}, "
                f"loaded={report.documents_loaded}"
            )

        if report.chunks_created <= 0:
            raise RuntimeError(
                "RAG ingestion produced zero chunks."
            )

        # --------------------------------------------------------------
        # 7. Validate generated artifacts.
        # --------------------------------------------------------------

        chunks_path = rag_dir / "chunks.jsonl"
        bm25_path = rag_dir / "bm25.pkl"
        manifest_path = rag_dir / "index_manifest.json"

        if not chunks_path.is_file():
            raise RuntimeError(
                f"Missing chunks artifact: {chunks_path}"
            )

        if not bm25_path.is_file():
            raise RuntimeError(
                f"Missing BM25 artifact: {bm25_path}"
            )

        if not manifest_path.is_file():
            raise RuntimeError(
                f"Missing manifest artifact: {manifest_path}"
            )

        if not chroma_dir.is_dir():
            raise RuntimeError(
                f"Missing Chroma directory: {chroma_dir}"
            )

        if not any(
            path.is_file()
            for path in chroma_dir.rglob("*")
        ):
            raise RuntimeError(
                f"Chroma directory contains no files: {chroma_dir}"
            )

        # --------------------------------------------------------------
        # 8. Validate manifest contains every exact staged document.
        # --------------------------------------------------------------

        manifest = json.loads(
            manifest_path.read_text(
                encoding="utf-8"
            )
        )

        expected_names = sorted(
            source["file_name"]
            for source in staged_sources
        )

        indexed_names = sorted(
            str(name)
            for name in (
                manifest.get("documents_indexed") or []
            )
        )

        if int(manifest.get("documents") or 0) != expected_documents:
            raise RuntimeError(
                "RAG manifest document count mismatch: "
                f"expected={expected_documents}, "
                f"manifest={manifest.get('documents')}"
            )

        if indexed_names != expected_names:
            raise RuntimeError(
                "RAG manifest document list mismatch. "
                f"expected={expected_names}; "
                f"indexed={indexed_names}"
            )

        manifest_chunks = int(
            manifest.get("chunks") or 0
        )

        if manifest_chunks != report.chunks_created:
            raise RuntimeError(
                "RAG manifest chunk count mismatch: "
                f"report={report.chunks_created}, "
                f"manifest={manifest_chunks}"
            )

        # --------------------------------------------------------------
        # 9. Count chunks for each document/version for rag_index_jobs.
        # --------------------------------------------------------------

        chunk_counts = _count_chunks_by_document(
            chunks_path
        )

        for source in staged_sources:
            file_name = source["file_name"]

            if chunk_counts.get(file_name, 0) <= 0:
                raise RuntimeError(
                    f"Document produced zero chunks: {file_name}"
                )

        # --------------------------------------------------------------
        # 10. Activate candidate index.
        #
        # Candidate construction happens inside install_pipeline().
        # If it cannot load, current chatbot pipeline remains untouched.
        #
        # persist=True writes data/rag/active_index.json so restart keeps
        # using this successful build.
        # --------------------------------------------------------------

# Artifacts are now fully built and validated.
        previous_build_root = _resolve_active_build_root_from_pointer(
            strict=False,
        )

        _mark_jobs_completed(
            db=db,
            sources=staged_sources,
            job_ids=job_ids,
            chunk_counts=chunk_counts,
        )

        # Activate only after build/job persistence succeeded.
        # If activation fails, the outer exception will change these jobs
        # from COMPLETED to FAILED.
        chat_service.install_pipeline(
            chroma_dir=chroma_dir,
            bm25_path=bm25_path,
            persist=True,
        )

        removed_builds: list[str] = []

        try:
            removed_builds = cleanup_old_rag_builds(
                active_build_root=build_root,
                previous_build_root=previous_build_root,
            )
        except Exception as cleanup_exc:
            logger.warning(
                "RAG build cleanup failed; active index remains valid: %s",
                cleanup_exc,
                exc_info=True,
            )

        logger.info(
            "RAG re-index completed build_id=%s documents=%s chunks=%s",
            build_id,
            expected_documents,
            report.chunks_created,
        )

        return {
            "buildId": build_id,
            "status": "COMPLETED",
            "documentsIndexed": expected_documents,
            "chunksCreated": report.chunks_created,
            "sourceDir": _relative_or_absolute(source_dir),
            "ragDir": _relative_or_absolute(rag_dir),
            "chromaDir": _relative_or_absolute(chroma_dir),
            "bm25Path": _relative_or_absolute(bm25_path),
            "manifestPath": _relative_or_absolute(manifest_path),
            "documents": expected_names,
            "durationSeconds": report.duration_seconds,
            "removedBuilds": removed_builds,
        }

    except Exception as exc:
        logger.exception(
            "RAG re-index failed"
        )

        # Always clear any incomplete transaction first.
        db.rollback()

        if job_ids:
            try:
                _mark_jobs_failed(
                    db=db,
                    job_ids=job_ids,
                    error_message=str(exc),
                )

            except Exception:
                db.rollback()

                logger.exception(
                    "Failed to mark RAG index jobs as FAILED"
                )

        # The candidate never became the published index.
        # Remove its incomplete workspace best-effort so FAILED rebuilds
        # do not accumulate on disk.
        if build_root is not None:
            try:
                _cleanup_failed_rag_build(
                    build_root=build_root,
                )
            except Exception as cleanup_exc:
                logger.warning(
                    "Failed to clean incomplete RAG build path=%s: %s",
                    build_root,
                    cleanup_exc,
                    exc_info=True,
                )

        raise


def _resolve_active_build_root_from_pointer(
    *,
    strict: bool = False,
) -> Path | None:
    """Resolve the active versioned build root from active_index.json."""

    if not ACTIVE_INDEX_POINTER.is_file():
        return None

    try:
        payload = json.loads(
            ACTIVE_INDEX_POINTER.read_text(
                encoding="utf-8",
            )
        )

        chroma_value = str(
            payload.get("chroma_dir") or ""
        ).strip()

        if not chroma_value:
            raise ValueError(
                "Active index pointer does not contain chroma_dir."
            )

        chroma_dir = Path(chroma_value)

        if not chroma_dir.is_absolute():
            chroma_dir = ROOT_DIR / chroma_dir

        build_root = chroma_dir.resolve().parent
        builds_root = RAG_BUILDS_ROOT.resolve()

        if build_root.parent != builds_root:
            return None

        return build_root

    except Exception:
        if strict:
            raise

        logger.warning(
            "Could not resolve active RAG build from pointer.",
            exc_info=True,
        )
        return None


def _is_complete_rag_build(
    build_root: Path,
) -> bool:
    """Return whether a build contains the minimum rollback artifacts."""

    build_root = Path(build_root)

    rag_dir = build_root / "rag"
    chroma_dir = build_root / "chroma"

    return (
        (rag_dir / "chunks.jsonl").is_file()
        and (rag_dir / "bm25.pkl").is_file()
        and (rag_dir / "index_manifest.json").is_file()
        and chroma_dir.is_dir()
        and any(
            path.is_file()
            for path in chroma_dir.rglob("*")
        )
    )


def _cleanup_failed_rag_build(
    *,
    build_root: Path,
) -> bool:
    """Best-effort removal of a failed, never-published candidate build."""

    builds_root = RAG_BUILDS_ROOT.resolve()
    build_root = Path(build_root).resolve()

    if build_root.parent != builds_root:
        raise RuntimeError(
            f"Failed build is outside RAG builds root: {build_root}"
        )

    if not build_root.exists():
        return False

    # Fail closed: never remove a directory currently referenced by
    # active_index.json.
    active_build_root = _resolve_active_build_root_from_pointer(
        strict=ACTIVE_INDEX_POINTER.is_file(),
    )

    if (
        active_build_root is not None
        and active_build_root == build_root
    ):
        logger.warning(
            "Refusing to remove failed build because it is active: %s",
            build_root,
        )
        return False

    shutil.rmtree(build_root)

    logger.info(
        "Removed incomplete/failed RAG build path=%s",
        build_root,
    )

    return True


def cleanup_old_rag_builds(
    *,
    active_build_root: Path,
    previous_build_root: Path | None = None,
    keep_count: int = _RAG_BUILD_KEEP_COUNT,
    min_age_seconds: int = _RAG_BUILD_MIN_AGE_SECONDS,
) -> list[str]:
    """Retain ACTIVE + PREVIOUS and delete older builds conservatively.

    Safety rules:
    - never delete the active build,
    - prefer the exact previously-active build for rollback,
    - retain at least `keep_count` complete builds when possible,
    - never delete non-protected builds younger than `min_age_seconds`.
    """

    builds_root = RAG_BUILDS_ROOT.resolve()
    active_build_root = Path(active_build_root).resolve()

    if active_build_root.parent != builds_root:
        raise RuntimeError(
            f"Active build is outside RAG builds root: {active_build_root}"
        )

    if not builds_root.exists():
        return []

    keep_count = max(
        int(keep_count),
        1,
    )

    candidates: list[tuple[float, Path]] = []

    for path in builds_root.iterdir():
        if not path.is_dir():
            continue

        if not path.name.startswith("build-"):
            continue

        resolved = path.resolve()

        if resolved == active_build_root:
            continue

        try:
            modified_at = resolved.stat().st_mtime
        except FileNotFoundError:
            continue

        candidates.append(
            (
                modified_at,
                resolved,
            )
        )

    candidates.sort(
        key=lambda item: item[0],
        reverse=True,
    )

    protected: set[Path] = {
        active_build_root,
    }

    # Prefer the exact build that was serving immediately before the swap.
    if previous_build_root is not None:
        previous = Path(
            previous_build_root
        ).resolve()

        if (
            previous != active_build_root
            and previous.parent == builds_root
            and previous.is_dir()
            and _is_complete_rag_build(previous)
        ):
            protected.add(previous)

    # Backward-compatible fallback for the first migration or an old pointer:
    # keep the newest COMPLETE non-active build until the retention target
    # has been reached.
    if len(protected) < keep_count:
        for _, path in candidates:
            if path in protected:
                continue

            if not _is_complete_rag_build(path):
                continue

            protected.add(path)

            if len(protected) >= keep_count:
                break

    now = datetime.now(
        timezone.utc
    ).timestamp()

    removed: list[str] = []

    for modified_at, path in candidates:
        if path in protected:
            continue

        age_seconds = now - modified_at

        # Grace period protects requests/workers that may still be finishing
        # against an immutable build replaced very recently.
        if age_seconds < min_age_seconds:
            continue

        shutil.rmtree(path)

        removed.append(path.name)

        logger.info(
            "Removed old RAG build path=%s age_seconds=%.0f",
            path,
            age_seconds,
        )

    return removed


def get_rag_index_status(
    db: Session,
) -> dict:
    """Return the currently published RAG index status for Admin monitoring."""

    pointer_exists = ACTIVE_INDEX_POINTER.is_file()

    active_build_id: str | None = None
    activated_at_unix: int | None = None
    activated_at: str | None = None

    documents_indexed = 0
    chunks_indexed = 0

    chroma_ready = False
    bm25_ready = False
    manifest_ready = False

    pointer_error: str | None = None

    # --------------------------------------------------------------
    # 1. Read currently active index pointer.
    # --------------------------------------------------------------

    if pointer_exists:
        try:
            payload = json.loads(
                ACTIVE_INDEX_POINTER.read_text(
                    encoding="utf-8"
                )
            )

            chroma_value = str(
                payload.get("chroma_dir") or ""
            ).strip()

            bm25_value = str(
                payload.get("bm25_path") or ""
            ).strip()

            if not chroma_value or not bm25_value:
                raise ValueError(
                    "Active index pointer is incomplete."
                )

            chroma_dir = Path(chroma_value)
            bm25_path = Path(bm25_value)

            if not chroma_dir.is_absolute():
                chroma_dir = ROOT_DIR / chroma_dir

            if not bm25_path.is_absolute():
                bm25_path = ROOT_DIR / bm25_path

            chroma_dir = chroma_dir.resolve()
            bm25_path = bm25_path.resolve()

            chroma_ready = (
                chroma_dir.is_dir()
                and any(
                    path.is_file()
                    for path in chroma_dir.rglob("*")
                )
            )

            bm25_ready = bm25_path.is_file()

            # Expected structure:
            # data/rag_builds/<build-id>/chroma
            active_build_root = chroma_dir.parent

            if (
                active_build_root.parent.resolve()
                == RAG_BUILDS_ROOT.resolve()
            ):
                active_build_id = active_build_root.name

            manifest_path = (
                active_build_root
                / "rag"
                / "index_manifest.json"
            )

            if manifest_path.is_file():
                manifest = json.loads(
                    manifest_path.read_text(
                        encoding="utf-8"
                    )
                )

                manifest_ready = True

                documents_indexed = int(
                    manifest.get("documents") or 0
                )

                chunks_indexed = int(
                    manifest.get("chunks") or 0
                )

            raw_activated_at = payload.get(
                "activated_at_unix"
            )

            if raw_activated_at is not None:
                activated_at_unix = int(
                    raw_activated_at
                )

                if activated_at_unix > 0:
                    activated_at = datetime.fromtimestamp(
                        activated_at_unix,
                        tz=timezone.utc,
                    ).isoformat()

        except Exception as exc:
            pointer_error = str(exc)

            logger.warning(
                "Could not inspect active RAG index pointer: %s",
                exc,
                exc_info=True,
            )

    # --------------------------------------------------------------
    # 2. Read most recent indexing job.
    #
    # A failed rebuild may coexist with a perfectly healthy active
    # index, so lastJobStatus is reported separately from READY state.
    # --------------------------------------------------------------

    latest_job = db.execute(
        text(
            """
            SELECT
                id,
                status,
                started_at,
                completed_at,
                error_message
            FROM public.rag_index_jobs
            ORDER BY id DESC
            LIMIT 1
            """
        )
    ).mappings().first()

    last_job_status: str | None = None
    last_job_started_at: str | None = None
    last_job_completed_at: str | None = None
    last_job_error: str | None = None

    if latest_job is not None:
        last_job_status = str(
            latest_job["status"] or ""
        ) or None

        started_at = latest_job["started_at"]
        completed_at = latest_job["completed_at"]

        if started_at is not None:
            last_job_started_at = started_at.isoformat()

        if completed_at is not None:
            last_job_completed_at = completed_at.isoformat()

        last_job_error = (
            str(latest_job["error_message"])
            if latest_job["error_message"]
            else None
        )

    # --------------------------------------------------------------
    # 3. Determine serving readiness.
    # --------------------------------------------------------------

    ready = (
        pointer_exists
        and pointer_error is None
        and chroma_ready
        and bm25_ready
        and manifest_ready
        and documents_indexed > 0
        and chunks_indexed > 0
    )

    if ready:
        serving_status = "READY"
    elif pointer_exists:
        serving_status = "DEGRADED"
    else:
        serving_status = "NOT_READY"

    return {
        "status": serving_status,
        "activeBuildId": active_build_id,
        "documentsIndexed": documents_indexed,
        "chunksIndexed": chunks_indexed,
        "activatedAtUnix": activated_at_unix,
        "activatedAt": activated_at,
        "pointerExists": pointer_exists,
        "chromaReady": chroma_ready,
        "bm25Ready": bm25_ready,
        "manifestReady": manifest_ready,
        "pointerError": pointer_error,
        "lastJobStatus": last_job_status,
        "lastJobStartedAt": last_job_started_at,
        "lastJobCompletedAt": last_job_completed_at,
        "lastJobError": last_job_error,
    }


def list_admin_rag_chunks(
    *,
    search: str | None = None,
    document_name: str | None = None,
    document_type: str | None = None,
    language: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> dict:
    active_build_id, chunks = _load_active_rag_chunks()
    all_items = [
        _admin_chunk_item(chunk, position=index)
        for index, chunk in enumerate(chunks, start=1)
    ]

    normalized_search = _search_fold(search)
    search_terms = normalized_search.split()
    filtered: list[dict] = []
    for chunk, item in zip(chunks, all_items, strict=True):
        searchable = " ".join(
            value
            for value in (
                chunk.chunk_id,
                chunk.document_name,
                chunk.content_original,
                chunk.content_vi or "",
                chunk.section or "",
                chunk.subsection or "",
                chunk.topic or "",
            )
            if value
        )
        searchable = _search_fold(searchable)
        if search_terms and not all(term in searchable for term in search_terms):
            continue
        if document_name and chunk.document_name != document_name:
            continue
        if document_type and chunk.document_type != document_type:
            continue
        if language and chunk.language != language:
            continue
        filtered.append(item)

    page_value = max(1, int(page or 1))
    page_size_value = min(100, max(1, int(page_size or 25)))
    total = len(filtered)
    total_pages = (total + page_size_value - 1) // page_size_value if total else 0
    if total_pages and page_value > total_pages:
        page_value = total_pages
    offset = (page_value - 1) * page_size_value

    character_counts = [len(chunk.content_original) for chunk in chunks]
    return {
        "items": filtered[offset:offset + page_size_value],
        "summary": {
            "total": len(chunks),
            "documents": len({chunk.document_name for chunk in chunks}),
            "translated": sum(bool(chunk.content_vi) for chunk in chunks),
            "averageCharacters": (
                round(sum(character_counts) / len(character_counts))
                if character_counts
                else 0
            ),
        },
        "filters": {
            "documentNames": sorted({chunk.document_name for chunk in chunks}),
            "documentTypes": sorted({chunk.document_type for chunk in chunks}),
            "languages": sorted({chunk.language for chunk in chunks}),
        },
        "activeBuildId": active_build_id,
        "page": page_value,
        "pageSize": page_size_value,
        "total": total,
        "totalPages": total_pages,
    }


def get_admin_rag_chunk(chunk_id: str) -> dict:
    active_build_id, chunks = _load_active_rag_chunks()
    for position, chunk in enumerate(chunks, start=1):
        if chunk.chunk_id == chunk_id:
            return {
                "chunk": _admin_chunk_item(
                    chunk,
                    position=position,
                    include_content=True,
                ),
                "activeBuildId": active_build_id,
            }
    raise ValueError("RAG chunk not found in the active index.")


def _load_active_rag_chunks() -> tuple[str, list[DocumentChunk]]:
    try:
        build_root = _resolve_active_build_root_from_pointer(strict=True)
    except Exception as exc:
        raise RuntimeError(f"Could not resolve the active RAG build: {exc}") from exc

    if build_root is None:
        raise RuntimeError("No active RAG build is available.")

    chunks_path = build_root / "rag" / "chunks.jsonl"
    if not chunks_path.is_file():
        raise RuntimeError("The active RAG build has no chunks artifact.")

    chunks: list[DocumentChunk] = []
    try:
        with chunks_path.open("r", encoding="utf-8") as source:
            for line_number, line in enumerate(source, start=1):
                content = line.strip()
                if not content:
                    continue
                try:
                    chunks.append(DocumentChunk.model_validate_json(content))
                except Exception as exc:
                    raise RuntimeError(
                        f"Invalid RAG chunk at line {line_number}."
                    ) from exc
    except OSError as exc:
        raise RuntimeError(f"Could not read active RAG chunks: {exc}") from exc

    return build_root.name, chunks


def _admin_chunk_item(
    chunk: DocumentChunk,
    *,
    position: int,
    include_content: bool = False,
) -> dict:
    normalized_preview = " ".join(chunk.content_original.split())
    if len(normalized_preview) > 240:
        normalized_preview = f"{normalized_preview[:237].rstrip()}..."

    item = {
        "chunkId": chunk.chunk_id,
        "position": position,
        "documentName": chunk.document_name,
        "documentType": chunk.document_type,
        "sourcePriority": chunk.source_priority,
        "contentPreview": normalized_preview,
        "language": chunk.language,
        "page": chunk.page,
        "section": chunk.section,
        "subsection": chunk.subsection,
        "topic": chunk.topic,
        "policyVersion": chunk.policy_version,
        "effectiveDate": chunk.effective_date,
        "ingestedAt": chunk.ingested_at,
        "characterCount": len(chunk.content_original),
        "wordCount": len(chunk.content_original.split()),
        "sourceElementCount": len(chunk.source_element_ids),
        "hasTranslation": bool(chunk.content_vi),
    }
    if include_content:
        item.update(
            {
                "contentOriginal": chunk.content_original,
                "contentVi": chunk.content_vi,
                "fileHash": chunk.file_hash,
                "createdDate": chunk.created_date,
                "fileSizeBytes": chunk.file_size_bytes,
                "sourceElementIds": chunk.source_element_ids,
            }
        )
    return item


def _search_fold(value: str | None) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or "").casefold())
    without_marks = "".join(
        character
        for character in normalized
        if not unicodedata.combining(character)
    )
    return " ".join(without_marks.split())


def _new_build_id() -> str:
    timestamp = datetime.now(
        timezone.utc
    ).strftime("%Y%m%dT%H%M%SZ")

    return (
        f"build-{timestamp}-"
        f"{uuid4().hex[:8]}"
    )


def _absolute_source_path(
    value: str | Path,
) -> Path:
    path = Path(value)

    if not path.is_absolute():
        path = ROOT_DIR / path

    path = path.resolve()

    if not path.is_file():
        raise FileNotFoundError(
            f"RAG source file not found: {path}"
        )

    return path


def _validate_source_filenames(
    sources: list[dict],
) -> None:
    """Fail closed on filename collisions.

    The staging directory is intentionally flat and downstream manifests
    and chunk accounting identify documents by filename. Duplicate
    basenames would therefore be ambiguous.
    """

    seen: dict[str, str] = {}

    for source in sources:
        path = _absolute_source_path(
            source["file_path"]
        )

        normalized = path.name.casefold()

        previous = seen.get(normalized)

        if previous is not None:
            raise RuntimeError(
                "Duplicate RAG source filename detected: "
                f"{previous} and {path.name}"
            )

        seen[normalized] = path.name


def _validate_source_hashes(
    sources: list[dict],
) -> None:
    """Ensure Admin DB metadata still matches the physical uploaded file."""

    for source in sources:
        expected_hash = str(
            source.get("file_hash") or ""
        ).strip()

        if not expected_hash:
            continue

        path = _absolute_source_path(
            source["file_path"]
        )

        actual_hash = _sha256(path)

        if actual_hash.lower() != expected_hash.lower():
            raise RuntimeError(
                "Knowledge document file hash mismatch: "
                f"{path.name}"
            )


def _sha256(path: Path) -> str:
    hasher = hashlib.sha256()

    with path.open("rb") as file:
        for block in iter(
            lambda: file.read(1024 * 1024),
            b"",
        ):
            hasher.update(block)

    return hasher.hexdigest()


def _create_index_jobs(
    *,
    db: Session,
    sources: list[dict],
) -> dict[int, int]:
    job_ids: dict[int, int] = {}

    for source in sources:
        version_id = int(
            source["version_id"]
        )

        row = db.execute(
            text(
                """
                INSERT INTO public.rag_index_jobs (
                    document_version_id,
                    job_type,
                    status
                )
                VALUES (
                    :document_version_id,
                    'FULL_INDEX',
                    'PENDING'
                )
                RETURNING id
                """
            ),
            {
                "document_version_id": version_id,
            },
        ).mappings().one()

        job_ids[version_id] = int(
            row["id"]
        )

    db.commit()

    return job_ids


def _mark_jobs_running(
    *,
    db: Session,
    job_ids: dict[int, int],
) -> None:
    for job_id in job_ids.values():
        db.execute(
            text(
                """
                UPDATE public.rag_index_jobs
                SET status = 'RUNNING',
                    started_at = NOW(),
                    completed_at = NULL,
                    error_message = NULL,
                    chunks_created = 0
                WHERE id = :job_id
                """
            ),
            {
                "job_id": job_id,
            },
        )

    db.commit()


def _mark_jobs_completed(
    *,
    db: Session,
    sources: list[dict],
    job_ids: dict[int, int],
    chunk_counts: Counter,
) -> None:
    for source in sources:
        version_id = int(
            source["version_id"]
        )

        job_id = job_ids[version_id]
        file_name = str(
            source["file_name"]
        )

        db.execute(
            text(
                """
                UPDATE public.rag_index_jobs
                SET status = 'COMPLETED',
                    chunks_created = :chunks_created,
                    error_message = NULL,
                    completed_at = NOW()
                WHERE id = :job_id
                """
            ),
            {
                "job_id": job_id,
                "chunks_created": int(
                    chunk_counts.get(
                        file_name,
                        0,
                    )
                ),
            },
        )

    db.commit()


def _mark_jobs_failed(
    *,
    db: Session,
    job_ids: dict[int, int],
    error_message: str,
) -> None:
    message = (
        error_message.strip()
        or "Unknown RAG index failure."
    )

    for job_id in job_ids.values():
        db.execute(
            text(
                """
                UPDATE public.rag_index_jobs
                SET status = 'FAILED',
                    error_message = :error_message,
                    completed_at = NOW()
                WHERE id = :job_id
                """
            ),
            {
                "job_id": job_id,
                "error_message": message,
            },
        )

    db.commit()


def _count_chunks_by_document(
    chunks_path: Path,
) -> Counter:
    counts: Counter = Counter()

    with chunks_path.open(
        "r",
        encoding="utf-8",
    ) as file:
        for line in file:
            stripped = line.strip()

            if not stripped:
                continue

            chunk = DocumentChunk.model_validate_json(
                stripped
            )

            counts[chunk.document_name] += 1

    return counts


def _relative_or_absolute(
    path: Path,
) -> str:
    resolved = Path(path).resolve()

    try:
        return resolved.relative_to(
            ROOT_DIR
        ).as_posix()

    except ValueError:
        return resolved.as_posix()
