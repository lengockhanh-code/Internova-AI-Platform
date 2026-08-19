## Nó lấy toàn bộ các DocumentChunk đã được chunking,biến chúng thành dạng BM25 
# có thể tìm kiếm theo từ khóa
# rồi lưu index ra file để bước retrieval dùng lại->

from __future__ import annotations

import pickle
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from rank_bm25 import BM25Okapi

from src.rag.schemas import DocumentChunk

# regex dùng để tách text thành token.
TOKEN_RE = re.compile(r"[a-z0-9]+(?:[._-][a-z0-9]+)*", re.IGNORECASE)


def _normalize_bm25_text(text: str) -> str:
    """Normalize Unicode/accents so Vietnamese keyword search is deterministic."""
    normalized = (text or "").replace("đ", "d").replace("Đ", "D")
    normalized = unicodedata.normalize("NFKD", normalized)
    normalized = "".join(
        char
        for char in normalized
        if not unicodedata.combining(char)
    )
    return normalized.lower()

## Đây là một biến để gom tất cả dữ liệu cần lưu của BM25 store.
@dataclass
class BM25StorePayload:
    tokenized_corpus: list[list[str]]
    chunk_ids: list[str]
    chunks: list[dict]
    bm25: BM25Okapi


# Đây là hàm tokenize text trước khi đưa vào BM25.
def tokenize_for_bm25(text: str) -> list[str]:
    normalized = _normalize_bm25_text(text)
    return TOKEN_RE.findall(normalized)

# Quyết định những trường nào của một chunk sẽ được đưa vào BM25 để search.
def chunk_search_text(chunk: DocumentChunk) -> str:
    """Build BM25 text from document-derived searchable content."""

    parts = [
        chunk.document_name,
        chunk.document_type,
        chunk.section or "",
        chunk.content_original,
        chunk.content_vi or "",
    ]

    return "\n".join(
        part
        for part in parts
        if part
    )

# Nhận danh sách chunks → build BM25 index → lưu index xuống ổ đĩa.
def build_bm25_store(chunks: list[DocumentChunk], output_path: Path) -> None:
    tokenized_corpus = [tokenize_for_bm25(chunk_search_text(chunk)) for chunk in chunks]
    payload = BM25StorePayload(
        tokenized_corpus=tokenized_corpus,
        chunk_ids=[chunk.chunk_id for chunk in chunks],
        chunks=[chunk.model_dump() for chunk in chunks],
        bm25=BM25Okapi(tokenized_corpus),
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("wb") as file:
        pickle.dump(payload, file)