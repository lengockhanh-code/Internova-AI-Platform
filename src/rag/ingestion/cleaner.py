from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path

from src.rag.ingestion.loader import ExtractedElement, ExtractionResult
from src.rag.schemas import DocumentChunk


# =============================================================================
# Text cleaning
# =============================================================================

# Standalone page numbers:
# "- 3 -", "Page 3", "3 of 12"
_PAGE_NUMBER_RE = re.compile(
    r"^[\s\-–—]*(?:page\s*)?\d+\s*(?:of\s*\d+)?[\s\-–—]*$",
    re.IGNORECASE | re.MULTILINE,
)

# Repeated dashes / underscores / asterisks used as horizontal rules.
_HRULE_RE = re.compile(
    r"^[-*_=\s]{4,}$",
    re.MULTILINE,
)

# Broken hyphenation at a PDF line break:
# "exter-\nnal" -> "external"
_BROKEN_HYPHEN_RE = re.compile(
    r"(\w)-\s*\n\s*(\w)"
)

# Null bytes and control characters.
# Keep \n and \t.
_CONTROL_CHAR_RE = re.compile(
    r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]"
)

# Three or more line breaks -> one blank line.
_MULTI_BLANK_RE = re.compile(
    r"\n{3,}"
)

# Common short header/footer boilerplate.
_BOILERPLATE_PHRASES: tuple[str, ...] = (
    "confidential",
    "all rights reserved",
    "vinuniversity",
    "www.vinuni.edu.vn",
    "tel:",
    "fax:",
)


def clean_text(text: str) -> str:
    """Apply all cleaning passes to raw extracted text."""
    if not text:
        return ""

    text = _fix_encoding(text)
    text = _CONTROL_CHAR_RE.sub(" ", text)
    text = _BROKEN_HYPHEN_RE.sub(r"\1\2", text)
    text = _PAGE_NUMBER_RE.sub("", text)
    text = _HRULE_RE.sub("", text)
    text = _remove_boilerplate_lines(text)
    text = _MULTI_BLANK_RE.sub("\n\n", text)

    return text.strip()


def _fix_encoding(text: str) -> str:
    """Normalize Unicode and remove common extraction artifacts."""
    text = unicodedata.normalize("NFC", text)
    text = text.replace("\ufffd", " ")
    text = text.replace("\u00a0", " ")
    text = text.replace("\u200b", "")
    return text


def _remove_boilerplate_lines(text: str) -> str:
    """Remove short lines that look like recurring header/footer boilerplate."""
    cleaned: list[str] = []

    for line in text.splitlines():
        stripped = line.strip()
        lower = stripped.lower()

        if (
            len(stripped) < 60
            and any(
                phrase in lower
                for phrase in _BOILERPLATE_PHRASES
            )
        ):
            continue

        cleaned.append(line)

    return "\n".join(cleaned)


def clean_element(
    element: ExtractedElement,
) -> ExtractedElement:
    """Return an ExtractedElement with cleaned text."""
    cleaned = clean_text(element.text)

    if cleaned == element.text:
        return element

    # ExtractedElement is a plain @dataclass (not a pydantic BaseModel), so
    # it has no .model_copy(). Use dataclasses.replace() instead.
    return replace(element, text=cleaned)


def clean_extraction_result(
    result: ExtractionResult,
) -> ExtractionResult:
    """Return a cleaned ExtractionResult."""
    cleaned_elements: list[ExtractedElement] = []

    for element in result.elements:
        cleaned = clean_element(element)

        # Remove elements that become empty after cleaning.
        if cleaned.text.strip():
            cleaned_elements.append(cleaned)

    # ExtractionResult is a plain @dataclass (not a pydantic BaseModel), so
    # it has no .model_copy(). Use dataclasses.replace() instead.
    return replace(
        result,
        elements=cleaned_elements,
        characters_extracted=sum(
            len(element.text)
            for element in cleaned_elements
        ),
    )


# =============================================================================
# Metadata enrichment
# =============================================================================

def enrich_chunk(
    chunk: DocumentChunk,
    source_path: Path,
) -> DocumentChunk:
    """Return a DocumentChunk enriched with source-file metadata."""
    ingested_at = datetime.now(
        timezone.utc
    ).isoformat()

    if not source_path.exists() or not source_path.is_file():
        return chunk.model_copy(
            update={
                "ingested_at": ingested_at,
            }
        )

    return chunk.model_copy(
        update={
            "ingested_at": ingested_at,
            "file_hash": compute_file_hash(source_path),
            "file_size_bytes": source_path.stat().st_size,
            "created_date": _get_file_mtime(source_path),
        }
    )


def enrich_chunks(
    chunks: list[DocumentChunk],
    source_dir: Path,
) -> list[DocumentChunk]:
    """Enrich chunks by matching document_name to files in source_dir."""
    path_cache = _build_source_path_cache(
        source_dir
    )

    enriched: list[DocumentChunk] = []

    for chunk in chunks:
        source_path = path_cache.get(
            chunk.document_name
        )

        if source_path is None:
            enriched.append(
                chunk.model_copy(
                    update={
                        "ingested_at": datetime.now(
                            timezone.utc
                        ).isoformat()
                    }
                )
            )
            continue

        enriched.append(
            enrich_chunk(
                chunk,
                source_path,
            )
        )

    return enriched


def _build_source_path_cache(
    source_dir: Path,
) -> dict[str, Path]:
    """Build a document-name -> source-path lookup cache."""
    if not source_dir.exists():
        return {}

    path_cache: dict[str, Path] = {}

    for path in source_dir.rglob("*"):
        if path.is_file():
            path_cache[path.name] = path

    return path_cache


def compute_file_hash(
    path: Path,
    algorithm: str = "sha256",
) -> str:
    """Compute a file-content hash for change detection."""
    hasher = hashlib.new(
        algorithm
    )

    with path.open("rb") as file:
        for block in iter(
            lambda: file.read(65536),
            b"",
        ):
            hasher.update(block)

    return (
        f"{algorithm}:"
        f"{hasher.hexdigest()}"
    )


def _get_file_mtime(
    path: Path,
) -> str | None:
    """Return file modification time as an ISO-8601 UTC string."""
    try:
        modified_time = path.stat().st_mtime

        return datetime.fromtimestamp(
            modified_time,
            tz=timezone.utc,
        ).isoformat()

    except OSError:
        return None