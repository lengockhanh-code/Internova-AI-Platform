from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from pathlib import Path

from src.rag.ingestion.chunker import (
    build_chunks,
    write_chunks_jsonl,
)
from src.rag.ingestion.cleaner import (
    clean_extraction_result,
    enrich_chunks,
)
from src.rag.ingestion.loader import load_document
from src.rag.retrieval.indexer import build_rag_index
from src.rag.schemas import IngestionReport


logger = logging.getLogger(__name__)


SUPPORTED_EXTENSIONS = {
    ".pdf",
    ".docx",
}


# Default project paths. Keep them centralized so both documentation and the
# command-line entry point use the same lower-case ``data`` directory.
DEFAULT_SOURCE_DIR = Path("data")
DEFAULT_OUTPUT_DIR = Path("data/rag")
DEFAULT_CHROMA_DIR = Path("data/chroma")


def run_ingestion(
    source_dir: Path,
    output_dir: Path,
    chroma_dir: Path,
) -> IngestionReport:
    """Run the full ingestion pipeline.

    Args:
        source_dir:
            Directory containing source PDF/DOCX documents.

        output_dir:
            Directory containing generated RAG artifacts such as:
            - chunks.jsonl
            - bm25.pkl
            - index_manifest.json

        chroma_dir:
            Directory containing the ChromaDB vector store.

    Returns:
        IngestionReport containing processing statistics and errors.
    """

    start_time = time.time()

    errors: list[str] = []
    skipped: list[dict] = []

    # ---------------------------------------------------------------------
    # Validate paths
    # ---------------------------------------------------------------------

    source_dir = Path(source_dir)
    output_dir = Path(output_dir)
    chroma_dir = Path(chroma_dir)

    if not source_dir.exists():
        return IngestionReport(
            documents_seen=0,
            documents_loaded=0,
            documents_cleaned=0,
            chunks_created=0,
            chunks_enriched=0,
            skipped_documents=[],
            errors=[
                f"Source directory does not exist: {source_dir}"
            ],
            duration_seconds=round(
                time.time() - start_time,
                2,
            ),
            built_at=datetime.now(
                timezone.utc
            ).isoformat(),
        )

    output_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    chroma_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    # =====================================================================
    # Step 1: Load documents
    # =====================================================================

    doc_files = sorted(
        [
            path
            for path in source_dir.rglob("*")
            if (
                path.is_file()
                and path.suffix.lower()
                in SUPPORTED_EXTENSIONS
            )
        ]
    )

    logger.info(
        "Found %d documents in %s",
        len(doc_files),
        source_dir,
    )

    extraction_results = []

    for path in doc_files:
        try:
            result = load_document(path)

            extraction_results.append(
                result
            )

            if result.errors:
                logger.warning(
                    "Load warnings for %s: %s",
                    path.name,
                    result.errors,
                )

        except Exception as exc:
            logger.exception(
                "Failed to load %s",
                path.name,
            )

            errors.append(
                f"load:{path.name}:{exc}"
            )

    documents_loaded = len(
        extraction_results
    )

    # =====================================================================
    # Step 2: Clean
    # =====================================================================

    cleaned_results = []

    for result in extraction_results:
        try:
            cleaned = clean_extraction_result(
                result
            )

            cleaned_results.append(
                cleaned
            )

        except Exception as exc:
            logger.exception(
                "Failed to clean %s",
                result.document_name,
            )

            errors.append(
                f"clean:{result.document_name}:{exc}"
            )

            # Fall back to uncleaned extraction.
            cleaned_results.append(
                result
            )

    documents_cleaned = len(
        cleaned_results
    )

    # =====================================================================
    # Step 3: Chunk
    # =====================================================================

    try:
        chunks, chunk_report = build_chunks(
            cleaned_results
        )

    except Exception as exc:
        logger.exception(
            "Chunking failed"
        )

        errors.append(
            f"chunk:{exc}"
        )

        chunks = []
        chunk_report = None

    if chunk_report is not None:
        skipped.extend(
            chunk_report.skipped_documents
        )

    logger.info(
        "Created %d chunks from %d documents",
        len(chunks),
        documents_cleaned,
    )

    # =====================================================================
    # Step 4: Enrich metadata
    # =====================================================================

    enriched_chunks = []

    if chunks:
        try:
            enriched_chunks = enrich_chunks(
                chunks,
                source_dir,
            )

        except Exception as exc:
            logger.exception(
                "Metadata enrichment failed"
            )

            errors.append(
                f"enrich:{exc}"
            )

            # If enrichment fails, continue using normal chunks.
            enriched_chunks = chunks

    chunks_enriched = len(
        enriched_chunks
    )

    # =====================================================================
    # Save chunks.jsonl
    # =====================================================================

    chunks_path = (
        output_dir
        / "chunks.jsonl"
    )

    try:
        write_chunks_jsonl(
            enriched_chunks,
            chunks_path,
        )

    except Exception as exc:
        logger.exception(
            "Failed to write chunks JSONL"
        )

        errors.append(
            f"write_chunks:{exc}"
        )

    # =====================================================================
    # Step 5: Embedding + Indexing
    # =====================================================================

    if enriched_chunks:
        try:
            build_rag_index(
                chunks_path=chunks_path,
                output_dir=output_dir,
                chroma_dir=chroma_dir,
                skipped_documents=skipped,
            )

        except Exception as exc:
            logger.exception(
                "Index build failed"
            )

            errors.append(
                f"index:{exc}"
            )

    else:
        logger.warning(
            "No chunks to index — skipping "
            "vector and BM25 indexing."
        )

    # =====================================================================
    # Final report
    # =====================================================================

    duration = (
        time.time()
        - start_time
    )

    return IngestionReport(
        documents_seen=len(doc_files),
        documents_loaded=documents_loaded,
        documents_cleaned=documents_cleaned,
        chunks_created=len(chunks),
        chunks_enriched=chunks_enriched,
        skipped_documents=skipped,
        errors=errors,
        duration_seconds=round(
            duration,
            2,
        ),
        built_at=datetime.now(
            timezone.utc
        ).isoformat(),
    )


def main() -> None:
    """Run ingestion with the project's default lower-case data directories."""
    report = run_ingestion(
        source_dir=DEFAULT_SOURCE_DIR,
        output_dir=DEFAULT_OUTPUT_DIR,
        chroma_dir=DEFAULT_CHROMA_DIR,
    )
    print(report.model_dump_json(indent=2))


if __name__ == "__main__":
    main()