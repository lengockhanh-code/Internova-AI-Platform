from __future__ import annotations

import json
import shutil
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from src.config import get_settings
from src.rag.retrieval.bm25_store import build_bm25_store
from src.rag.schemas import DocumentChunk
from src.rag.retrieval.vector_store import COLLECTION_NAME, build_chroma_store


def load_chunks(chunks_path: Path) -> list[DocumentChunk]:
    chunks: list[DocumentChunk] = []
    with chunks_path.open(encoding="utf-8") as file:
        for line in file:
            stripped = line.strip()
            if stripped:
                chunks.append(DocumentChunk.model_validate_json(stripped))
    return chunks


def build_rag_index(
    chunks_path: Path,
    output_dir: Path,
    chroma_dir: Path,
    skipped_documents: list[dict] | None = None,
) -> dict:
    chunks = load_chunks(chunks_path)
    if not chunks:
        raise RuntimeError(f"No chunks found at {chunks_path}")

    with safe_build_dirs(output_dir, chroma_dir) as (tmp_output_dir, tmp_chroma_dir):
        bm25_path = tmp_output_dir / "bm25.pkl"
        build_bm25_store(chunks, bm25_path)
        reuse_from_dir = (
            chroma_dir
            if can_reuse_embeddings(output_dir)
            else None
        )
        build_chroma_store(
            chunks,
            tmp_chroma_dir,
            reuse_from_dir=reuse_from_dir,
        )

        manifest = build_manifest(chunks, skipped_documents)
        manifest_path = tmp_output_dir / "index_manifest.json"
        manifest_path.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    return manifest


def build_manifest(
    chunks: list[DocumentChunk],
    skipped_documents: list[dict] | None = None,
) -> dict:
    settings = get_settings()
    documents_indexed = sorted({chunk.document_name for chunk in chunks})
    return {
        "documents": len(documents_indexed),
        "documents_indexed": documents_indexed,
        # Reflects the documents actually skipped during this ingestion run
        # (passed in from the pipeline), instead of a hardcoded placeholder.
        "documents_skipped": skipped_documents or [],
        "chunks": len(chunks),
        "embedding_provider": "openai",
        "embedding_model": settings.openai_embedding_model,
        "source_language": "en",
        "supported_query_languages": ["vi", "en"],
        "vector_store": "chroma",
        "vector_collection": COLLECTION_NAME,
        "keyword_store": "bm25",
        "built_at_unix": int(time.time()),
    }


def can_reuse_embeddings(output_dir: Path) -> bool:
    """Return True only when the previous index used the same embedding model."""
    manifest_path = Path(output_dir) / "index_manifest.json"
    if not manifest_path.exists():
        return False

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        return False

    settings = get_settings()
    return (
        manifest.get("embedding_provider") == "openai"
        and manifest.get("embedding_model") == settings.openai_embedding_model
    )


@contextmanager
def safe_build_dirs(output_dir: Path, chroma_dir: Path) -> Iterator[tuple[Path, Path]]:
    """Build indexes in temporary paths and atomically publish them.

    If any publish step fails, already-published artifacts are restored from
    their backups. Backups are deleted only after the whole swap succeeds.
    """
    tmp_output_dir = output_dir.with_name(f"{output_dir.name}.tmp-build")
    tmp_chroma_dir = chroma_dir.with_name(f"{chroma_dir.name}.tmp-build")
    backup_bm25_path = output_dir / "bm25.pkl.backup"
    backup_manifest_path = output_dir / "index_manifest.json.backup"
    backup_chroma_dir = chroma_dir.with_name(f"{chroma_dir.name}.backup")

    for path in (tmp_output_dir, tmp_chroma_dir):
        if path.exists():
            shutil.rmtree(path)
        path.mkdir(parents=True, exist_ok=True)

    # Recover a backup only when its target is missing (possible interrupted
    # previous publish). If both target and backup exist, the target is the
    # active copy and the leftover backup can be removed safely.
    recover_stale_file_backup(output_dir / "bm25.pkl", backup_bm25_path)
    recover_stale_file_backup(
        output_dir / "index_manifest.json",
        backup_manifest_path,
    )
    recover_stale_dir_backup(chroma_dir, backup_chroma_dir)

    published: list[tuple[str, Path, Path]] = []
    committed = False

    try:
        yield tmp_output_dir, tmp_chroma_dir

        output_dir.mkdir(parents=True, exist_ok=True)

        swap_dir(tmp_chroma_dir, chroma_dir, backup_chroma_dir)
        published.append(("dir", chroma_dir, backup_chroma_dir))

        swap_file(
            tmp_output_dir / "bm25.pkl",
            output_dir / "bm25.pkl",
            backup_bm25_path,
        )
        published.append(("file", output_dir / "bm25.pkl", backup_bm25_path))

        swap_file(
            tmp_output_dir / "index_manifest.json",
            output_dir / "index_manifest.json",
            backup_manifest_path,
        )
        published.append(
            ("file", output_dir / "index_manifest.json", backup_manifest_path)
        )

        committed = True

    except Exception:
        # Roll back in reverse publish order. If rollback itself fails, retain
        # the backup on disk rather than deleting the only known-good copy.
        for kind, target, backup in reversed(published):
            try:
                if kind == "dir":
                    restore_dir(target, backup)
                else:
                    restore_file(target, backup)
            except Exception:
                pass
        raise

    finally:
        if tmp_output_dir.exists():
            shutil.rmtree(tmp_output_dir, ignore_errors=True)
        if tmp_chroma_dir.exists():
            shutil.rmtree(tmp_chroma_dir, ignore_errors=True)

        # Only discard backups after every artifact was published successfully.
        if committed:
            for path in (backup_bm25_path, backup_manifest_path):
                if path.exists():
                    path.unlink()
            if backup_chroma_dir.exists():
                shutil.rmtree(backup_chroma_dir, ignore_errors=True)


def swap_file(tmp_path: Path, target_path: Path, backup_path: Path) -> None:
    """Replace a file while keeping the previous version available for rollback."""
    if not tmp_path.exists():
        raise FileNotFoundError(f"Temporary index file not found: {tmp_path}")

    if backup_path.exists():
        backup_path.unlink()

    had_target = target_path.exists()
    if had_target:
        target_path.replace(backup_path)

    try:
        tmp_path.replace(target_path)
    except Exception:
        if target_path.exists():
            target_path.unlink()
        if had_target and backup_path.exists():
            backup_path.replace(target_path)
        raise


def swap_dir(tmp_dir: Path, target_dir: Path, backup_dir: Path) -> None:
    """Replace a directory while keeping the previous version for rollback."""
    if not tmp_dir.exists():
        raise FileNotFoundError(f"Temporary index directory not found: {tmp_dir}")

    if backup_dir.exists():
        shutil.rmtree(backup_dir)

    had_target = target_dir.exists()
    if had_target:
        shutil.move(str(target_dir), str(backup_dir))

    try:
        shutil.move(str(tmp_dir), str(target_dir))
    except Exception:
        if target_dir.exists():
            shutil.rmtree(target_dir, ignore_errors=True)
        if had_target and backup_dir.exists():
            shutil.move(str(backup_dir), str(target_dir))
        raise


def recover_stale_file_backup(target_path: Path, backup_path: Path) -> None:
    """Recover an interrupted file swap without discarding a lone backup."""
    if not backup_path.exists():
        return
    if target_path.exists():
        backup_path.unlink()
    else:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        backup_path.replace(target_path)


def recover_stale_dir_backup(target_dir: Path, backup_dir: Path) -> None:
    """Recover an interrupted directory swap without discarding a lone backup."""
    if not backup_dir.exists():
        return
    if target_dir.exists():
        shutil.rmtree(backup_dir, ignore_errors=True)
    else:
        shutil.move(str(backup_dir), str(target_dir))


def restore_file(target_path: Path, backup_path: Path) -> None:
    """Restore a previously published file from its backup, if one exists."""
    if backup_path.exists():
        if target_path.exists():
            target_path.unlink()
        backup_path.replace(target_path)
    elif target_path.exists():
        # No backup means the target did not exist before this build.
        target_path.unlink()


def restore_dir(target_dir: Path, backup_dir: Path) -> None:
    """Restore a previously published directory from its backup, if one exists."""
    if backup_dir.exists():
        if target_dir.exists():
            shutil.rmtree(target_dir, ignore_errors=True)
        shutil.move(str(backup_dir), str(target_dir))
    elif target_dir.exists():
        # No backup means the target did not exist before this build.
        shutil.rmtree(target_dir, ignore_errors=True)