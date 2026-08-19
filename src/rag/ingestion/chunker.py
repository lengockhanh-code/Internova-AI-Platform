## Nhận dữ liệu đã được extraction từ PDF/DOCX → chia thành các chunk hợp lý →
# gắn metadata cho từng chunk →
# tạo report kiểm tra → trả về ChunkBuildReport cho ingestion pipeline
# ghi các chunk ra JSONL -> data/rag/chunks.jsonl
#
# ĐÃ TỐI ƯU (so với bản gốc):
#   1. Chia theo TOKEN (tiktoken) thay vì ký tự thô -> kiểm soát chi phí embedding
#      chính xác hơn, tránh chunk quá to/quá nhỏ so với ý định.
#   2. Overlap giảm và tính theo % kích thước chunk thay vì cố định 500 ký tự
#      cho mọi trường hợp -> giảm token dư thừa khi embed (giảm chi phí).
#   3. Ưu tiên cắt tại ranh giới đoạn văn ("\n\n") > dòng ("\n") > câu (". "/"; ")
#      thay vì chỉ tìm ". "/"; " -> giữ ngữ nghĩa/bảng biểu tốt hơn (tăng độ chính xác).
#   4. Gộp chunk "đuôi" quá nhỏ vào chunk trước đó -> giảm số lượng chunk dư thừa
#      (giảm số lần gọi embedding API -> giảm chi phí, giảm nhiễu retrieval).
#   5. Thêm helper `chunks_to_embed()` để chỉ embed các chunk MỚI/THAY ĐỔI dựa
#      trên chunk_id (đã bao gồm hash nội dung) -> tái ingest tài liệu không
#      tốn tiền re-embed toàn bộ (tối ưu chi phí lớn nhất khi cập nhật policy).
#   6. Không gộp chunk nhỏ qua ranh giới page/section/topic -> tránh làm sai metadata
#      nguồn và giúp reranker nhận đúng ngữ cảnh của từng chunk.
#   7. Chặn merge làm chunk vượt quá MAX_TOKENS + overlap -> giữ latency rerank và
#      embedding ổn định, không tạo chunk phình bất thường.
#   8. DOCX element tự thân quá dài cũng đi qua split_long_text() như PDF -> đảm bảo
#      dedicated reranker không phải nhận một chunk bất thường quá lớn.

from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Iterable
from pathlib import Path

from src.rag.ingestion.loader import ExtractedElement, ExtractionResult
from src.rag.schemas import ChunkBuildReport, DocumentChunk

# ---------------------------------------------------------------------------
# Token counting (tiktoken nếu có, fallback về ước lượng ký tự/4 nếu không có
# để không phá vỡ môi trường chưa cài tiktoken).
# ---------------------------------------------------------------------------
try:
    import tiktoken

    _ENCODER = tiktoken.get_encoding("cl100k_base")

    def count_tokens(text: str) -> int:
        if not text:
            return 0
        return len(_ENCODER.encode(text))

except Exception:  # pragma: no cover - fallback khi chưa cài tiktoken
    def count_tokens(text: str) -> int:
        if not text:
            return 0
        # Ước lượng thô: ~4 ký tự / token (đủ dùng để so sánh ngưỡng).
        return max(1, len(text) // 4)


## Kích thước chunk mục tiêu tính theo TOKEN (thay vì ký tự cố định như bản cũ).
## ~600 token/chunk là điểm cân bằng tốt giữa độ chính xác retrieval (chunk không
## quá to loãng chủ đề) và chi phí (không tạo quá nhiều chunk nhỏ).
MAX_TOKENS = 600
OVERLAP_TOKENS = 60  # ~10% kích thước chunk, đủ để giữ ngữ cảnh nối tiếp
MIN_TOKENS = 120  # chunk nhỏ hơn ngưỡng này sẽ được cân nhắc gộp vào chunk liền trước
# Cho phép một chút headroom khi merge tail nhỏ, nhưng không để chunk phình quá mức.
MERGE_MAX_TOKENS = MAX_TOKENS + OVERLAP_TOKENS

# Giữ lại tên biến cũ (theo ký tự) để tương thích ngược nếu module khác có import,
# quy đổi gần đúng từ token sang ký tự (~4 ký tự/token).
MAX_CHARS = MAX_TOKENS * 4
OVERLAP_CHARS = OVERLAP_TOKENS * 4


## Dùng để đánh giá độ ưu tiên của nguồn.
SOURCE_PRIORITIES = {
    "policy": 1,
    "form": 2,
    "agreement": 2,
    "talent_handbook": 3,
    "capstone_booklet": 4,
}

## Đây là danh sách các thông tin quan trọng cần kiểm tra sau khi chunk.

MANUAL_CHECKS = [
    "240 hours",
    "2.0 overall GPA",
    "Statement of Internship Grievance",
    "Withdrawal",
    "Evaluation",
]

## Đây là danh sách các từ khóa để suy ra topic của chunk.

TOPIC_KEYWORDS = (
    ("internship_grievance", ("grievance", "incident", "complaint", "statement of internship grievance")),
    ("form_guidance", ("form 1", "form 2", "form 3", "form 4", "request form")),
    ("internship_duration", ("duration", "hours", "weeks", "semester", "part-time", "full-time")),
    ("internship_credit", ("credit", "gpa", "pass/fail", "grading", "pre-requisite")),
    ("internship_withdrawal", ("withdrawal", "withdraw", "terminate", "termination")),
    ("internship_evaluation", ("evaluation", "evaluate", "faculty mentor", "employer evaluation")),
    ("student_responsibility", ("student", "responsibility", "liability", "agreement")),
    ("career_opportunity", ("career", "employer", "mentorship", "career portal")),
    ("capstone", ("capstone", "project")),
)

## Dùng để tìm heading/section

SECTION_PATTERNS = (
    re.compile(
        r"^\s*(APPENDIX\s+\d+\b[^\n]{0,160})\s*$",
        re.IGNORECASE,
    ),
    re.compile(
        r"^\s*(ARTICLE\s+\d+\b[^\n]{0,160})\s*$",
        re.IGNORECASE,
    ),
    re.compile(
        r"^\s*(\d+(?:\.\d+)+\.?\s+[A-Z][^\n]{3,140})\s*$",
    ),
)

## Ranh giới ưu tiên khi cắt văn bản dài, theo thứ tự "an toàn ngữ nghĩa" giảm dần.
## Đoạn văn > xuống dòng > câu > mệnh đề. Tránh cắt giữa dòng (bảo vệ bảng biểu,
## danh sách gạch đầu dòng vốn mỗi hàng là một dòng riêng).
_BOUNDARY_PATTERNS = ("\n\n", "\n", ". ", "; ")


## Hàm xây dựng chunk nhận dữ liệu từ document loader

def build_chunks(results: Iterable[ExtractionResult]) -> tuple[list[DocumentChunk], ChunkBuildReport]:
    chunks: list[DocumentChunk] = []
    skipped_documents: list[dict[str, str]] = []
    documents_seen = 0
    documents_chunked = 0

    for result in results:
        documents_seen += 1
        if result.status == "requires_ocr":
            skipped_documents.append(
                {"document_name": result.document_name, "reason": "requires_ocr"}
            )
            continue
        if not result.elements:
            skipped_documents.append(
                {"document_name": result.document_name, "reason": result.status}
            )
            continue

        document_chunks = chunk_document(result)
        chunks.extend(document_chunks)
        if document_chunks:
            documents_chunked += 1

    report = ChunkBuildReport(
        documents_seen=documents_seen,
        documents_chunked=documents_chunked,
        chunks_created=len(chunks),
        skipped_documents=skipped_documents,
        manual_checks=find_manual_checks(chunks),
    )
    return chunks, report


## phân luồng chunking dựa trên loại file, PDF hay DOCX
def chunk_document(result: ExtractionResult) -> list[DocumentChunk]:
    if result.file_type == "pdf":
        chunks = chunk_pdf(result)
    else:
        chunks = chunk_docx(result)
    return merge_small_tail_chunks(chunks, result)


## xử lý chunking cho PDF, mỗi element là một page
def chunk_pdf(result: ExtractionResult) -> list[DocumentChunk]:
    chunks: list[DocumentChunk] = []
    for element in result.elements:
        for part_index, content in enumerate(split_long_text(element.text), start=1):
            chunks.append(make_chunk(result, [element], content, part_index=part_index))
    return chunks

## xử lý chunking cho DOCX
def chunk_docx(result: ExtractionResult) -> list[DocumentChunk]:
    chunks: list[DocumentChunk] = []
    buffer: list[ExtractedElement] = []
    buffer_tokens = 0

    for element in result.elements:
        element_tokens = count_tokens(element.text)

        # Một paragraph/table element có thể tự thân > MAX_TOKENS. Bản cũ chỉ
        # kiểm tra overflow của buffer nên trường hợp này vẫn tạo chunk quá lớn.
        # Flush buffer trước, rồi dùng cùng split_long_text() như PDF để giữ
        # kích thước input cho embedding/reranker ổn định.
        if element_tokens > MAX_TOKENS:
            if buffer:
                chunks.append(
                    make_chunk(result, buffer, join_elements(buffer), len(chunks) + 1)
                )
                buffer = []
                buffer_tokens = 0

            for part in split_long_text(element.text):
                chunks.append(
                    make_chunk(result, [element], part, len(chunks) + 1)
                )
            continue

        starts_new_section = element.element_type == "heading" and buffer
        would_overflow = buffer_tokens + element_tokens > MAX_TOKENS and buffer
        if starts_new_section or would_overflow:
            chunks.append(make_chunk(result, buffer, join_elements(buffer), len(chunks) + 1))
            buffer = []
            buffer_tokens = 0

        buffer.append(element)
        buffer_tokens += element_tokens + 1

    if buffer:
        chunks.append(make_chunk(result, buffer, join_elements(buffer), len(chunks) + 1))
    return chunks


## Cắt text dài, ưu tiên ranh giới "an toàn" (đoạn > dòng > câu) thay vì chỉ
## tìm ". "/"; " như bản gốc -> giảm nguy cơ cắt giữa bảng/ý -> tăng độ chính xác.
def split_long_text(text: str) -> list[str]:
    if count_tokens(text) <= MAX_TOKENS:
        return [text] if text.strip() else []

    # Ước lượng số ký tự tương ứng MAX_TOKENS/OVERLAP_TOKENS cho văn bản này,
    # dựa trên tỉ lệ token/ký tự thực tế của đoạn text (chính xác hơn hằng số cố định).
    total_tokens = count_tokens(text)
    chars_per_token = max(1.0, len(text) / max(1, total_tokens))
    max_chars_local = int(MAX_TOKENS * chars_per_token)
    overlap_chars_local = int(OVERLAP_TOKENS * chars_per_token)

    parts: list[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + max_chars_local)
        if end < len(text):
            best_boundary = -1
            for pattern in _BOUNDARY_PATTERNS:
                boundary = text.rfind(pattern, start, end)
                if boundary > start + max_chars_local // 2:
                    best_boundary = boundary + len(pattern)
                    break  # đã tìm được ranh giới an toàn nhất theo thứ tự ưu tiên
            if best_boundary > 0:
                end = best_boundary
        chunk_text = text[start:end].strip()
        if chunk_text:
            parts.append(chunk_text)
        if end >= len(text):
            break
        start = max(0, end - overlap_chars_local)
    return parts


## Gộp chunk cuối cùng của mỗi tài liệu (hoặc bất kỳ chunk quá nhỏ nào) vào
## chunk liền trước nếu dưới ngưỡng MIN_TOKENS, để tránh sinh ra nhiều chunk
## "vụn" (mỗi chunk vẫn tốn 1 lần gọi embedding + 1 slot trong index).
def merge_small_tail_chunks(chunks: list[DocumentChunk], result: ExtractionResult) -> list[DocumentChunk]:
    if len(chunks) < 2:
        return chunks

    merged: list[DocumentChunk] = [chunks[0]]
    for chunk in chunks[1:]:
        previous = merged[-1]
        chunk_is_small = count_tokens(chunk.content_original) < MIN_TOKENS
        metadata_compatible = _can_merge_chunks(previous, chunk)
        combined_content = f"{previous.content_original}\n{chunk.content_original}".strip()
        combined_within_limit = count_tokens(combined_content) <= MERGE_MAX_TOKENS

        if chunk_is_small and metadata_compatible and combined_within_limit:
            merged[-1] = previous.model_copy(
                update={
                    "content_original": combined_content,
                    "source_element_ids": [*previous.source_element_ids, *chunk.source_element_ids],
                }
            )
        else:
            merged.append(chunk)
    return merged


def _can_merge_chunks(previous: DocumentChunk, current: DocumentChunk) -> bool:
    """Only merge chunks when their source metadata remains truthful.

    PDF chunks from different pages must stay separate, otherwise the merged chunk
    would keep only the previous page metadata and citations could point to the
    wrong source page. For DOCX, page is commonly None, so section/topic become
    the conservative compatibility checks.
    """
    if previous.page is not None or current.page is not None:
        if previous.page != current.page:
            return False

    if previous.section != current.section and (previous.section or current.section):
        return False

    if previous.topic != current.topic and (previous.topic or current.topic):
        return False

    return True


## gắn metedata vào mỗi chunk
def make_chunk(
    result: ExtractionResult,
    elements: list[ExtractedElement],
    content: str,
    part_index: int,
) -> DocumentChunk:
    page = first_non_null(element.page for element in elements)
    section = detect_section(content, result.document_type, page)
    topic = infer_topic(content, result.document_type, result.document_name)
    source_element_ids = [source_element_id(element) for element in elements]
    chunk_id = stable_chunk_id(result, page, section, part_index, content)

    return DocumentChunk(
        chunk_id=chunk_id,
        document_name=result.document_name,
        document_type=result.document_type,
        source_priority=SOURCE_PRIORITIES.get(result.document_type, 99),
        content_original=content,
        content_vi=None,
        language="en",
        page=page,
        section=section,
        subsection=None,
        topic=topic,
        policy_version=detect_policy_version(result.document_name),
        effective_date=detect_effective_date(result.document_name),
        source_element_ids=source_element_ids,
    )

## tạo id cho chunk dể dễ dàng truy xuất
## LƯU Ý: chunk_id phụ thuộc hash nội dung -> đây chính là cơ chế cho phép
## `chunks_to_embed()` bên dưới bỏ qua các chunk không đổi khi re-ingest.
def stable_chunk_id(
    result: ExtractionResult,
    page: int | None,
    section: str | None,
    part_index: int,
    content: str,
) -> str:
    prefix = {
        "policy": "policy",
        "form": form_prefix(result.document_name),
        "agreement": "form2",
        "talent_handbook": "talent",
        "capstone_booklet": "capstone",
    }.get(result.document_type, "doc")
    page_part = f"p{page:03d}" if page is not None else "p000"
    section_part = slugify(
        section or infer_topic(content, result.document_type, result.document_name) or "section"
    )
    digest = hashlib.sha1(content.encode("utf-8")).hexdigest()[:8]
    return f"{prefix}_{page_part}_{section_part}_{part_index:03d}_{digest}"

## lấy số của Form trong tên file.
def form_prefix(document_name: str) -> str:
    match = re.search(r"Form-(\d+)", document_name, flags=re.IGNORECASE)
    if match:
        return f"form{match.group(1)}"
    return "form"

## Chunk này được tạo từ element nào trong tài liệu gốc.
def source_element_id(element: ExtractedElement) -> str:
    parts = [element.document_name]
    if element.page is not None:
        parts.append(f"page:{element.page}")
    if element.element_index is not None:
        parts.append(f"element:{element.element_index}")
    if element.table_index is not None:
        parts.append(f"table:{element.table_index}")
    if element.row_index is not None:
        parts.append(f"row:{element.row_index}")
    return "|".join(parts)

## Nó ghép nhiều element thành một đoạn text lớn.
def join_elements(elements: list[ExtractedElement]) -> str:
    return "\n".join(element.text for element in elements if element.text).strip()

## Dùng để tìm heading/section
def detect_section(
    content: str,
    document_type: str,
    page: int | None,
) -> str | None:
    """Return section metadata only when a reliable document heading is present."""

    lines = [
        line.strip()
        for line in content.splitlines()
        if line.strip()
    ]

    if not lines:
        return None

    # Forms and agreements normally have a stable document/form title
    # as their first meaningful line.
    if document_type in {"form", "agreement"}:
        first_line = lines[0]
        return first_line[:120] if first_line else None

    # PDF policy extraction may contain table rows, continuation text,
    # headers, and multiple sections on the same page.
    #
    # Therefore section metadata must be conservative:
    # only trust heading-like standalone lines near the beginning
    # of the extracted page/chunk.
    if document_type == "policy":
        leading_lines = lines[:8]

        for line in leading_lines:
            for pattern in SECTION_PATTERNS:
                match = pattern.fullmatch(line)

                if match:
                    return match.group(1).strip()

        return None

    # Other document types: use the same conservative leading-heading rule.
    for line in lines[:8]:
        for pattern in SECTION_PATTERNS:
            match = pattern.fullmatch(line)

            if match:
                return match.group(1).strip()

    return None

## gán topic cho chunk dựa trên tên file và nội dung
def infer_topic(content: str, document_type: str, document_name: str = "") -> str | None:
    lower_content = content.lower()
    lower_name = document_name.lower()
    if "form-3" in lower_name:
        return "internship_grievance"
    if "form-4" in lower_name:
        return "internship_evaluation"
    if "form-1" in lower_name:
        return "internship_registration"
    if "form-2" in lower_name:
        return "student_responsibility"
    if document_type == "capstone_booklet":
        return "capstone"
    if document_type == "talent_handbook":
        return "career_opportunity"
    if "240 hours" in lower_content or "minimum duration" in lower_content:
        return "internship_duration"
    if "2.0 overall gpa" in lower_content or "pre-requisites" in lower_content:
        return "internship_credit"
    if "withdrawal from an internship" in lower_content:
        return "internship_withdrawal"
    for topic, keywords in TOPIC_KEYWORDS:
        if any(keyword in lower_content for keyword in keywords):
            return topic
    return None

def detect_policy_version(document_name: str) -> str | None:
    match = re.search(r"\bV(\d+(?:\.\d+)?)\b", document_name, flags=re.IGNORECASE)
    if match:
        return f"V{match.group(1)}"
    return None


def detect_effective_date(document_name: str) -> str | None:
    match = re.search(r"(\d{2})\.(\d{2})\.(\d{4})", document_name)
    if match:
        day, month, year = match.groups()
        return f"{year}-{month}-{day}"
    return None

## Kiểm tra chất lượng chunk.
def find_manual_checks(chunks: list[DocumentChunk]) -> dict[str, list[dict]]:
    checks: dict[str, list[dict]] = {}
    for term in MANUAL_CHECKS:
        matches = []
        needle = term.lower()
        for chunk in chunks:
            if needle in chunk.content_original.lower():
                matches.append(
                    {
                        "chunk_id": chunk.chunk_id,
                        "document_name": chunk.document_name,
                        "page": chunk.page,
                        "section": chunk.section,
                        "topic": chunk.topic,
                        "snippet": make_snippet(chunk.content_original, term),
                    }
                )
        checks[term] = matches
    return checks

## Nó tạo ra một đoạn trích ngắn xung quanh một từ khóa cần tìm.
def make_snippet(text: str, term: str, window: int = 120) -> str:
    lower_text = text.lower()
    index = lower_text.find(term.lower())
    if index < 0:
        return text[: window * 2]
    start = max(0, index - window)
    end = min(len(text), index + len(term) + window)
    return text[start:end].strip()

## Nó lưu danh sách chunk ra file:Chunk.json
def write_chunks_jsonl(chunks: list[DocumentChunk], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        for chunk in chunks:
            file.write(json.dumps(chunk.model_dump(), ensure_ascii=False) + "\n")


## MỚI: chỉ giữ lại các chunk CẦN embed (mới hoặc nội dung đã đổi) khi re-ingest.
## `existing_chunk_ids` là tập chunk_id đang có sẵn trong vector store.
## Vì chunk_id chứa hash nội dung, nội dung không đổi -> chunk_id không đổi
## -> được bỏ qua, tiết kiệm chi phí embedding đáng kể khi chỉ 1-2 file thay đổi.
def chunks_to_embed(
    chunks: list[DocumentChunk],
    existing_chunk_ids: set[str],
) -> list[DocumentChunk]:
    return [chunk for chunk in chunks if chunk.chunk_id not in existing_chunk_ids]


## MỚI: các chunk_id cũ không còn xuất hiện trong lần chunk mới -> nên xoá khỏi
## vector store (tài liệu đã bị sửa/xoá phần nội dung tương ứng).
def stale_chunk_ids(
    chunks: list[DocumentChunk],
    existing_chunk_ids: set[str],
) -> set[str]:
    current_ids = {chunk.chunk_id for chunk in chunks}
    return existing_chunk_ids - current_ids


## Lấy giá trị đầu tiên khác None.
def first_non_null(values: Iterable[int | None]) -> int | None:
    for value in values:
        if value is not None:
            return value
    return None

## Biến một đoạn text thành dạng phù hợp để tạo ID.
def slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "_", value.lower()).strip("_")
    return value[:48] or "section"