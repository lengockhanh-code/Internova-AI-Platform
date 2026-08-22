"""form_tool.py — Fully self-contained form-filling tool.

FIX: this used to import schemas/logic from src.rag.generation.form_filler.
That file does not exist in this repo (this branch was created specifically
to avoid depending on files owned/maintained outside form_agent/ — see the
folder-structure discussion in chat). Everything needed is now defined
directly in this file: field schemas for all 4 forms (student-fillable
portions only), LLM-based extraction, and docx writing. This module has
ZERO imports from outside form_agent/ (other than third-party packages
langchain_openai, python-docx, and this repo's own src.config for the
API key/model settings, which is a safe, stable, shared config module).

IMPORTANT SCOPE BOUNDARY: only fields the STUDENT is actually the right
person to provide are in these schemas. Host Company confirmation /
College approval (Form 1) and Faculty Mentor (4.1) / Employer (4.2)
evaluation sections are intentionally NOT included — this tool must
never generate content on behalf of someone else.

All docx writes are ADDITIVE (fills the first empty paragraph in the
target cell, or appends one), never destructive text-replacement.
"""

from __future__ import annotations

import io
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from src.config import get_settings

logger = logging.getLogger(__name__)

FormCode = Literal["Form 1", "Form 2", "Form 3", "Form 4.3"]

FORM_TEMPLATE_DIR = Path("data")


# =============================================================================
# Field schema
# =============================================================================

@dataclass
class FormField:
    name: str
    label_vi: str
    description_vi: str
    required: bool = True
    table_index: int = -1
    row_index: int = -1
    col_index: int = -1


FORM_1_FIELDS: list[FormField] = [
    # Nhóm A — sinh viên chắc chắn biết (quyết định học vụ của chính họ)
    FormField("host_company", "Tên công ty tiếp nhận", "Tên công ty thực tập", True, 3, 0, 1),
    FormField("intern_position", "Vị trí thực tập", "Chức danh/vị trí công việc", True, 3, 5, 1),
    FormField("type_of_internship", "Loại hình thực tập (5in5 / Summer / Work placement / khác)",
              "vd: 5in5, Summer, Work placement, hoặc mô tả khác", True, 1, 0, 1),
    FormField("credit_info", "Có tính tín chỉ không, mấy tín chỉ",
              "vd: 'Credit-bearing, 3 tín chỉ' hoặc 'Non credit-bearing'", True, 1, 1, 1),
    FormField("course_code", "Mã môn học (nếu có)", "Mã môn, có thể để trống nếu chưa đăng ký", False, 1, 2, 1),
    # Nhóm C — sinh viên thường biết sơ bộ, công ty xác nhận chính thức
    FormField("department", "Phòng ban", "Phòng ban sẽ thực tập, nếu biết", False, 3, 6, 1),
    FormField("internship_time", "Thời gian thực tập (từ ngày - đến ngày)", "vd: 01/09/2026 đến 30/11/2026, nếu biết", False, 3, 8, 1),
    # Nhóm B — thuộc về công ty, KHÔNG hỏi sinh viên đoán, chỉ nhận nếu
    # họ tự nguyện cung cấp; nếu không, để trống cho công ty tự điền
    # khi họ hoàn thiện form (xem collect_info.py — câu gợi ý cuối
    # cùng nói rõ điều này với sinh viên).
    FormField("industry", "Ngành nghề của công ty", "Thông tin công ty tự điền nếu sinh viên không rõ", False, 3, 1, 1),
    FormField("website", "Website công ty", "Thông tin công ty tự điền nếu sinh viên không rõ", False, 3, 2, 1),
    FormField("contact_person_name", "Tên người liên hệ phía công ty", "Thông tin công ty tự điền nếu sinh viên không rõ", False, 3, 3, 1),
    FormField("contact_person_title", "Chức danh người liên hệ", "Thông tin công ty tự điền nếu sinh viên không rõ", False, 3, 3, 3),
    FormField("contact_email", "Email người liên hệ", "Thông tin công ty tự điền nếu sinh viên không rõ", False, 3, 4, 1),
    FormField("contact_phone", "Số điện thoại người liên hệ", "Thông tin công ty tự điền nếu sinh viên không rõ", False, 3, 4, 3),
    FormField("internship_hours", "Số giờ thực tập (mỗi tuần/tháng)", "Thông tin công ty tự điền nếu sinh viên không rõ", False, 3, 7, 1),
    FormField("internship_details", "Mô tả công việc, lợi ích, kỹ năng cần, yêu cầu",
              "Thông tin công ty tự điền nếu sinh viên không rõ", False, 3, 9, 1),
]

FORM_2_FIELDS: list[FormField] = [
    FormField("name_in_full", "Họ tên đầy đủ", "Tên đầy đủ sinh viên", True, 0, 0, 1),
    FormField("student_id", "Mã số sinh viên", "MSSV", True, 0, 0, 3),
    FormField("email", "Email", "Email VinUni", True, 0, 1, 1),
    FormField("intake", "Khóa (Intake)", "vd: K2023", True, 0, 1, 3),
    FormField("college", "College", "vd: CECS, CBM, CAS, CHS", True, 0, 2, 1),
    FormField("course_code", "Mã môn học (nếu có)", "Có thể để trống", False, 0, 5, 1),
    FormField("host_company", "Tên công ty tiếp nhận", "Công ty thực tập ở nước ngoài", True, 0, 6, 1),
    FormField("internship_position", "Vị trí thực tập", "Chức danh/vị trí", True, 0, 7, 1),
    FormField("student_name_printed", "Tên in (bên cạnh chữ ký)", "Tên đầy đủ để in", True, 1, 1, 2),
]

FORM_3_FIELDS: list[FormField] = [
    FormField("name_in_full", "Họ tên đầy đủ", "Tên đầy đủ sinh viên", True, 0, 0, 1),
    FormField("student_id", "Mã số sinh viên", "MSSV", True, 0, 0, 3),
    FormField("email", "Email", "Email VinUni", True, 0, 1, 1),
    FormField("intake", "Khóa (Intake)", "vd: K2023", True, 0, 1, 3),
    FormField("college", "College", "vd: CECS, CBM, CAS, CHS", True, 0, 2, 1),
    FormField("course_code", "Mã môn học (nếu có)", "Có thể để trống", False, 0, 5, 1),
    FormField("host_company", "Tên công ty tiếp nhận", "Công ty thực tập", True, 0, 6, 1),
    FormField("internship_position", "Vị trí thực tập", "Chức danh/vị trí", True, 0, 7, 1),
    FormField("industry_supervisor", "Người hướng dẫn tại công ty", "Tên industry supervisor", False, 0, 8, 1),
    FormField("faculty_supervisor", "Giảng viên hướng dẫn", "Tên faculty mentor", False, 0, 9, 1),
    FormField("date_of_incident", "Ngày xảy ra sự việc", "vd: 03/08/2026", True, 1, 0, 1),
    FormField("time_of_incident", "Giờ xảy ra sự việc", "vd: 14:00", False, 1, 0, 3),
    FormField("location_of_incident", "Địa điểm xảy ra sự việc", "vd: văn phòng công ty, tầng 5", True, 1, 2, 1),
    FormField("description", "Mô tả chi tiết sự việc",
              "Toàn bộ nội dung sự việc, càng cụ thể càng tốt", True, 1, 3, 1),
    FormField("witness_info", "Thông tin nhân chứng (nếu có)",
              "Tên và SĐT người chứng kiến, nếu có", False, 1, 4, 1),
    FormField("repeated_issue", "Đây có phải lần đầu phản ánh vấn đề này không (Yes/No)",
              "Yes nếu lần đầu, No nếu đã từng phản ánh trước đó", True, 1, 5, 1),
    FormField("suggestion", "Đề xuất hướng xử lý (nếu có)",
              "Sinh viên mong muốn được xử lý thế nào", False, 1, 6, 1),
    FormField("additional_info", "Thông tin bổ sung khác (nếu có)",
              "Bất kỳ thông tin nào khác liên quan", False, 1, 7, 1),
]

FORM_4_3_FIELDS: list[FormField] = [
    FormField("name_in_full", "Họ tên đầy đủ", "Tên đầy đủ sinh viên", True, 4, 0, 1),
    FormField("student_id", "Mã số sinh viên", "MSSV", True, 4, 0, 3),
    FormField("email", "Email", "Email VinUni", True, 4, 1, 1),
    FormField("intake", "Khóa (Intake)", "vd: K2023", True, 4, 1, 3),
    FormField("college", "College", "vd: CECS, CBM, CAS, CHS", True, 4, 2, 1),
    FormField("course_code", "Mã môn học (nếu có)", "Có thể để trống", False, 4, 5, 1),
    FormField("host_company", "Tên công ty tiếp nhận", "Công ty thực tập", True, 4, 6, 1),
    FormField("internship_position", "Vị trí thực tập", "Chức danh/vị trí", True, 4, 7, 1),
    FormField("industry_supervisor", "Người hướng dẫn tại công ty", "Tên industry supervisor", False, 4, 8, 1),
    FormField("department", "Phòng ban", "Phòng ban đã thực tập", False, 4, 10, 1),
    FormField("faculty_supervisor", "Giảng viên hướng dẫn", "Tên faculty mentor", False, 4, 11, 1),
    FormField("resources_used", "Nguồn tìm được thực tập",
              "vd: Career Services, Faculty, bạn bè, nhà tuyển dụng cũ, mạng...", False, -1, -1, -1),
    FormField("overall_rating", "Đánh giá tổng quan về kỳ thực tập (1-5 hoặc mô tả)",
              "vd: Excellent/Good/Average/Below Average/Poor learning experience", True, -1, -1, -1),
    FormField("would_recommend", "Có giới thiệu thực tập này cho bạn khác không",
              "Highly recommend / Recommend / Recommend with reservations / Would not recommend", True, -1, -1, -1),
    FormField("overall_experience_notes", "Nhận xét/trải nghiệm tổng thể + đề xuất cải thiện",
              "Gộp mọi nhận xét, điểm mạnh/yếu, đề xuất cải thiện trải nghiệm thực tập",
              True, 5, 0, -1),
]

FORM_SCHEMAS: dict[FormCode, list[FormField]] = {
    "Form 1": FORM_1_FIELDS,
    "Form 2": FORM_2_FIELDS,
    "Form 3": FORM_3_FIELDS,
    "Form 4.3": FORM_4_3_FIELDS,
}

FORM_TEMPLATE_FILENAMES: dict[FormCode, str] = {
    "Form 1": "Form-1-Internship-Request-Form-IRF.docx",
    "Form 2": "Form-2-Release-of-Liability-Hold-Harmless-Agreement.docx",
    "Form 3": "Form-3-Statement-of-Internship-Grievance.docx",
    "Form 4.3": "Form-4-Sample-Evaluations.docx",
}


# =============================================================================
# Extraction — one LLM call, structured JSON output
# =============================================================================

_EXTRACTION_SYSTEM_PROMPT = """\
Bạn là công cụ trích xuất thông tin có cấu trúc từ hội thoại giữa sinh \
viên và trợ lý AI, để điền vào 1 biểu mẫu hành chính của trường.

QUY TẮC BẮT BUỘC:
1. CHỈ trích xuất thông tin mà sinh viên đã THỰC SỰ nói ra trong hội \
thoại. TUYỆT ĐỐI không suy đoán, không bịa, không tự điền thông tin \
sinh viên chưa từng cung cấp.
2. Nếu 1 field chưa có đủ thông tin trong hội thoại, để giá trị là null.
3. Trả về ĐÚNG định dạng JSON theo schema được cung cấp, không thêm \
giải thích, không thêm markdown code fence.
4. Giữ nguyên văn phong, số liệu, tên riêng chính xác như sinh viên đã \
cung cấp — không diễn giải lại hay tóm tắt làm mất chi tiết quan trọng \
(đặc biệt với các field mô tả sự việc).
"""

_EXTRACTION_USER_TEMPLATE = """\
Hội thoại giữa sinh viên và trợ lý (từ đầu tới giờ):
---
{conversation_text}
---

Các field cần trích xuất (tên field — mô tả):
{field_descriptions}

Trả về JSON với đúng các key là tên field ở trên, value là nội dung \
trích được (string) hoặc null nếu chưa có thông tin.
"""


def _build_field_descriptions(fields: list[FormField]) -> str:
    lines = []
    for f in fields:
        req = "bắt buộc" if f.required else "không bắt buộc"
        lines.append(f"- {f.name} ({req}): {f.label_vi} — {f.description_vi}")
    return "\n".join(lines)


_MAX_FIELDS_PER_EXTRACTION_CALL = 6


def _extract_fields_batch(
    conversation_text: str,
    fields: list[FormField],
    settings,
) -> dict[str, str | None]:
    """Run one LLM extraction call for a single batch of fields."""
    empty_result: dict[str, str | None] = {f.name: None for f in fields}

    try:
        from langchain_openai import ChatOpenAI

        llm = ChatOpenAI(
            model=settings.openai_chat_model or settings.model_name,
            api_key=settings.openai_api_key,
            temperature=0.0,
            model_kwargs={"response_format": {"type": "json_object"}},
        )

        user_prompt = _EXTRACTION_USER_TEMPLATE.format(
            conversation_text=conversation_text,
            field_descriptions=_build_field_descriptions(fields),
        )

        response = llm.invoke(
            [
                ("system", _EXTRACTION_SYSTEM_PROMPT),
                ("human", user_prompt),
            ]
        )

        raw = str(response.content).strip()
        parsed = json.loads(raw)

        result: dict[str, str | None] = {}
        for f in fields:
            value = parsed.get(f.name)
            result[f.name] = value if isinstance(value, str) and value.strip() else None

        return result

    except Exception as exc:  # noqa: BLE001
        field_names = [f.name for f in fields]
        # FIX: print in addition to logger.warning — in some setups
        # (e.g. running a plain script without logging configured),
        # logger.warning() output is easy to miss or gets suppressed,
        # making an extraction failure look identical to "the AI just
        # didn't find this info" when it's actually a real error. This
        # makes the failure visible directly in the terminal.
        print(f"⚠️ [extract_fields] Lỗi khi trích xuất batch {field_names}: {exc}")
        logger.warning("Field extraction batch failed for %s: %s", field_names, exc)
        return empty_result


def extract_fields(conversation_text: str, form_code: FormCode) -> dict[str, str | None]:
    """Pull whatever field values the student has already mentioned in
    the conversation. Never invents a value not actually stated.

    FIX: split into batches of at most
    _MAX_FIELDS_PER_EXTRACTION_CALL fields per LLM call instead of one
    call listing all fields at once. Two benefits: (1) reduces the
    risk of the model losing track of / skipping fields near the end
    of a long list — observed in testing where the LAST 2 fields in a
    15-field single call consistently came back empty despite clear
    matching text in the conversation; (2) limits the blast radius of
    a failed call — if one batch's API call errors out, only that
    batch's fields are affected, not all 15.
    """
    fields = FORM_SCHEMAS[form_code]
    settings = get_settings()

    empty_result: dict[str, str | None] = {f.name: None for f in fields}

    if not settings.openai_api_key:
        logger.warning("OPENAI_API_KEY not configured; skipping extraction")
        return empty_result

    combined: dict[str, str | None] = {}

    for start in range(0, len(fields), _MAX_FIELDS_PER_EXTRACTION_CALL):
        batch = fields[start:start + _MAX_FIELDS_PER_EXTRACTION_CALL]
        batch_result = _extract_fields_batch(conversation_text, batch, settings)
        combined.update(batch_result)

    return combined


def find_missing_required(
    field_values: dict[str, str | None],
    form_code: FormCode,
) -> list[str]:
    """Return the internal field *names* still missing a value."""
    fields = FORM_SCHEMAS[form_code]
    return [
        f.name
        for f in fields
        if f.required and not (field_values.get(f.name) or "").strip()
    ]


def build_ask_message(
    missing_field_names: list[str],
    form_code: FormCode,
) -> str:
    """Compose one friendly follow-up question covering all still-missing
    required fields at once."""
    fields_by_name = {f.name: f for f in FORM_SCHEMAS[form_code]}
    labels = [
        fields_by_name[name].label_vi
        for name in missing_field_names
        if name in fields_by_name
    ]

    if not labels:
        return ""

    bullet_list = "\n".join(f"- {label}" for label in labels)

    return (
        "Để hoàn thiện đơn, mình cần thêm thông tin sau:\n\n"
        f"{bullet_list}\n\n"
        "Bạn cung cấp giúp mình nhé (có thể trả lời gộp trong 1 tin nhắn)."
    )


def build_optional_info_offer_message(
    field_values: dict[str, str | None],
    form_code: FormCode,
) -> str | None:
    """One-time gentle offer for OPTIONAL fields the student hasn't
    provided, asked AFTER all required fields are satisfied.

    FIX: reframed from "do you happen to know this?" to suggesting the
    student paste the actual job posting / offer email / JD the
    company sent them. In practice these Group-B details (industry,
    job description, hours, contact person) are almost always already
    WRITTEN DOWN somewhere by the company — the student doesn't need
    to recall them from memory, just relay the text they already have.
    This is both more realistic (much higher chance the student
    actually has this) and produces better extraction (real company
    wording beats a vague paraphrase from memory).

    Explicitly reassures the student that fields they don't know are
    NOT their responsibility — many optional fields on Form 1 in
    particular are company-side HR details that the Host Company fills
    in when they complete the form. Returns None if there's nothing
    optional left to ask about (everything is already filled).
    """
    fields = FORM_SCHEMAS[form_code]
    unfilled_optional = [
        f for f in fields
        if not f.required and not (field_values.get(f.name) or "").strip()
    ]

    if not unfilled_optional:
        return None

    bullet_list = "\n".join(f"- {f.label_vi}" for f in unfilled_optional)

    return (
        "Mình đã có đủ thông tin bắt buộc rồi. Nếu bạn có **tin tuyển "
        "dụng, email mời nhận thực tập, hoặc bản mô tả công việc (JD)** "
        "mà công ty đã gửi, cứ **dán nguyên văn vào đây** — mình sẽ tự "
        "trích đúng các thông tin sau từ đó:\n\n"
        f"{bullet_list}\n\n"
        "Không có cũng không sao — những phần này thường do phía công "
        "ty tự điền khi họ hoàn thiện form, bạn không cần lo. Cứ trả "
        "lời 'không cần' để mình chốt luôn."
    )


# =============================================================================
# Filling the real .docx
# =============================================================================

def _write_into_cell(cell, value: str) -> None:
    """Write a value into a table cell, preferring to fill the first
    empty paragraph already in the cell (common in these templates —
    several blank lines reserved as writing space) rather than always
    appending after everything.
    """
    for paragraph in cell.paragraphs:
        if not paragraph.text.strip():
            paragraph.add_run(value)
            return

    cell.add_paragraph(value)


def fill_form(
    form_code: FormCode,
    field_values: dict[str, str | None],
    template_dir: Path | None = None,
) -> bytes:
    """Fill the real .docx template with collected field values.

    ADDITIVE only: never replaces or deletes existing text (labels,
    instructions). Returns the filled document as bytes — never writes
    to disk directly.
    """
    from docx import Document

    resolved_dir = template_dir or FORM_TEMPLATE_DIR
    template_path = resolved_dir / FORM_TEMPLATE_FILENAMES[form_code]

    if not template_path.exists():
        raise FileNotFoundError(f"Form template not found: {template_path}")

    document = Document(str(template_path))
    fields = FORM_SCHEMAS[form_code]

    for f in fields:
        value = field_values.get(f.name)

        if not value:
            continue

        if f.table_index < 0:
            # Field with no direct table cell mapping (e.g. Form 4.3's
            # checkbox-style "resources_used") — intentionally skipped
            # rather than guessing a location.
            continue

        try:
            table = document.tables[f.table_index]
            row = table.rows[f.row_index]
            cell = row.cells[f.col_index]
            _write_into_cell(cell, value)
        except (IndexError, AttributeError) as exc:
            logger.warning(
                "Could not write field '%s' for %s at (table=%d, row=%d, col=%d): %s",
                f.name, form_code, f.table_index, f.row_index, f.col_index, exc,
            )
            continue

    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def build_review_summary(
    field_values: dict[str, str | None],
    form_code: FormCode,
) -> str:
    """Human-readable Markdown summary for the human_review step."""
    fields = FORM_SCHEMAS[form_code]
    lines = [f"**Xem trước thông tin sẽ điền vào {form_code}:**", ""]

    for f in fields:
        value = field_values.get(f.name)
        display_value = value if value else "_(chưa có thông tin)_"
        lines.append(f"- **{f.label_vi}**: {display_value}")

    return "\n".join(lines)