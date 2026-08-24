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
target cell, or appends one — or, for checkbox-style fields, ticks the
matching ☐ inline; see _tick_checkbox_in_cell), never destructive
text-replacement.
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
    FormField("type_of_internship", "Loại hình thực tập (5in5 / Summer / Work placement / khác)",
              "vd: 5in5, Summer, Work placement, hoặc mô tả khác", False, 0, 3, 1),
    FormField("credit_info", "Có tính tín chỉ không, mấy tín chỉ",
              "vd: 'Credit-bearing, 3 tín chỉ' hoặc 'Non credit-bearing'", False, 0, 4, 1),
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
    FormField("type_of_internship", "Loại hình thực tập (5in5 / Summer / Work placement / khác)",
              "vd: 5in5, Summer, Work placement, hoặc mô tả khác", False, 0, 3, 1),
    FormField("credit_info", "Có tính tín chỉ không, mấy tín chỉ",
              "vd: 'Credit-bearing, 3 tín chỉ' hoặc 'Non credit-bearing'", False, 0, 4, 1),
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
    FormField("student_id", "Mã số sinh viên", "MSSV", True, 4, 0, 4),
    FormField("email", "Email", "Email VinUni", True, 4, 1, 1),
    FormField("intake", "Khóa (Intake)", "vd: K2023", True, 4, 1, 4),
    FormField("college", "College", "vd: CECS, CBM, CAS, CHS", True, 4, 2, 1),
    FormField("type_of_internship", "Loại hình thực tập (5in5 / Summer / Work placement / khác)",
              "vd: 5in5, Summer, Work placement, hoặc mô tả khác", False, 4, 3, 1),
    FormField("credit_info", "Có tính tín chỉ không, mấy tín chỉ",
              "vd: 'Credit-bearing, 3 tín chỉ' hoặc 'Non credit-bearing'", False, 4, 4, 1),
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
    FormField("overall_experience_notes", "Nhận xét/trải nghiệm tổng thể",
              "Nhận xét, đánh giá chi tiết trải nghiệm thực tập", False, -1, -1, -1),
    FormField("suggestions_to_improve", "Đề xuất cải thiện trải nghiệm thực tập",
              "Đề xuất cho công ty hoặc trường", False, -1, -1, -1),
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
5. CHỐNG TRÙNG LẶP: TUYỆT ĐỐI không lặp lại thông tin đã được trích xuất \
ở các field cụ thể (như repeated_issue, date_of_incident, time_of_incident, \
location_of_incident, description, witness_info) vào field additional_info \
hoặc suggestion. Field additional_info chỉ chứa thông tin ngoài lề MỚI \
chưa từng xuất hiện ở các field trên; nếu không có, BẮT BUỘC để null.
6. PHÂN BIỆT RÕ: type_of_internship CHỈ là loại hình thực tập học vụ \
(5in5, Summer, Work placement, hoặc khác). TUYỆT ĐỐI không điền chức danh/vị trí \
công việc (như Marketing Intern, Software Engineer...) vào type_of_internship \
(vị trí công việc phải điền vào internship_position hoặc intern_position).
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


def _sanitize_extracted_fields(
    field_values: dict[str, str | None],
    form_code: FormCode,
) -> dict[str, str | None]:
    """Clean and sanitize extracted fields to prevent hallucinated values,
    role-confusion (e.g. putting job titles into type_of_internship),
    and redundant duplicate strings across fields."""
    sanitized = dict(field_values)

    # 1. Sanitize type_of_internship: must relate to academic types (5in5, summer, work placement, other)
    type_val = (sanitized.get("type_of_internship") or "").lower().strip()
    if type_val:
        valid_types = ["5in5", "summer", "work placement", "placement", "hè", "he", "khác", "other"]
        is_valid = any(vt in type_val for vt in valid_types)
        if not is_valid or any(job in type_val for job in ["intern", "engineer", "analyst", "developer", "marketing", "pr", "designer", "researcher"]):
            if not any(vt in type_val for vt in ["5in5", "summer", "work placement"]):
                sanitized["type_of_internship"] = None

    # 2. Sanitize credit_info: must relate to credits (tín chỉ, credit, tc)
    credit_val = (sanitized.get("credit_info") or "").lower().strip()
    if credit_val:
        valid_credit_terms = ["credit", "tín chỉ", "tin chi", "tc", "non-credit", "non credit", "không tính", "khong tinh"]
        if not any(ct in credit_val for ct in valid_credit_terms):
            sanitized["credit_info"] = None

    # 3. Sanitize Form 3 additional_info: remove duplicate statements
    if form_code == "Form 3":
        add_info = (sanitized.get("additional_info") or "").strip()
        desc = (sanitized.get("description") or "").strip()

        if add_info:
            add_lower = add_info.lower()
            if any(p in add_lower for p in ["lần đầu", "lan dau", "first time", "chưa từng", "chua tung"]):
                sanitized["additional_info"] = None
            elif (desc and add_info.lower() in desc.lower()) or (desc and desc.lower() in add_info.lower()):
                sanitized["additional_info"] = None

    return sanitized


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

    cleaned = (conversation_text or "").strip()
    # Fast path: if the conversation text is just a short confirmation (e.g. "có", "ừ điền giúp mình"),
    # no student details exist yet — return immediately without waiting for LLM extraction batches.
    if len(cleaned.split()) < 5 and not any(char.isdigit() for char in cleaned):
        return empty_result

    if not settings.openai_api_key:
        logger.warning("OPENAI_API_KEY not configured; skipping extraction")
        return empty_result

    combined: dict[str, str | None] = {}

    for start in range(0, len(fields), _MAX_FIELDS_PER_EXTRACTION_CALL):
        batch = fields[start:start + _MAX_FIELDS_PER_EXTRACTION_CALL]
        batch_result = _extract_fields_batch(conversation_text, batch, settings)
        combined.update(batch_result)

    return _sanitize_extracted_fields(combined, form_code)


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
        "lời 'không cần' hoặc 'bỏ qua' để mình chốt luôn."
    )


# =============================================================================
# Filling the real .docx
# =============================================================================

# FIX (REAL fix): the checkbox-style fields on this template turned
# out to be genuine Word Checkbox Content Controls (<w:sdt> wrapping a
# <w14:checkbox>), not plain "☐" characters in ordinary run text.
# Their display glyph ("☐" / "☒") lives inside
# <w:sdtContent><w:r><w:t>, which python-docx's paragraph.runs does
# NOT surface (it only walks direct <w:r> children of <w:p>, skipping
# anything nested inside <w:sdt>) — this is exactly why a naive
# text-search approach can never find a "☐" to tick this way.
# Confirmed by inspecting the raw XML of an actual filled Form 1: each
# checkbox SDT defines <w14:checked w14:val="0"/>,
# <w14:checkedState w14:val="2612" .../> (hex Unicode code point for
# the CHECKED glyph "☒") and <w14:uncheckedState w14:val="2610" .../>
# ("☐"), with the currently displayed character duplicated as literal
# text inside sdtContent.
#
# Ticking a checkbox for real means: (1) set w14:checked's val to "1",
# and (2) replace the displayed glyph text with the checked-state
# character from w14:checkedState — done by walking the paragraph's
# raw XML directly (lxml), not through python-docx's higher-level
# paragraph.runs API. Verified end-to-end on a real filled Form 1: the
# resulting .docx still opens correctly afterward, and only the
# targeted checkbox's val flips to "1" (siblings stay "0").
from lxml import etree

_W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
_W14_NS = "{http://schemas.microsoft.com/office/word/2010/wordml}"

_CHECKBOX_OPTION_MAP: dict[str, tuple[str, ...]] = {
    "type_of_internship": ("5in5", "summer", "work placement", "other"),
    "credit_info": ("non credit", "non-credit", "credit-bearing", "credit bearing"),
    "repeated_issue": ("yes", "no"),
    "resources_used": ("career services", "faculty", "family", "friend", "previous employer", "internet", "other"),
    "overall_rating": ("excellent", "good", "average", "below average", "poor"),
    "would_recommend": ("highly recommend", "recommend with reservations", "would not recommend", "recommend"),
}


def _find_checkbox_options_in_paragraph(paragraph) -> list[dict]:
    """Walk a paragraph's raw XML in document order, pairing each
    checkbox Content Control with the plain-text label that follows it
    (up until the next checkbox or the end of the paragraph) — this
    mirrors how the template is laid out: [checkbox][label text]
    [checkbox][label text]... Returns a list of dicts, each with the
    XML elements needed to tick that specific checkbox plus its
    associated label text for matching against the extracted value.
    """
    p_elem = paragraph._p
    results: list[dict] = []
    pending: dict | None = None

    for child in p_elem:
        tag = etree.QName(child).localname

        if tag == "sdt":
            checkbox = child.find(f".//{_W14_NS}checkbox")
            if checkbox is None:
                pending = None
                continue

            checked_elem = checkbox.find(f"{_W14_NS}checked")
            checked_state = checkbox.find(f"{_W14_NS}checkedState")
            sdt_content = child.find(f"{_W_NS}sdtContent")
            t_elem = sdt_content.find(f".//{_W_NS}t") if sdt_content is not None else None

            if checked_elem is None or checked_state is None or t_elem is None:
                pending = None
                continue

            checked_val = checked_state.get(f"{_W14_NS}val")
            pending = {
                "checked_elem": checked_elem,
                "checked_char": chr(int(checked_val, 16)),
                "t_elem": t_elem,
                "label_text": "",
            }
            results.append(pending)
            continue

        if tag == "r" and pending is not None:
            t = child.find(f"{_W_NS}t")
            if t is not None and t.text:
                pending["label_text"] += t.text

    return results


def _tick_unicode_checkbox_in_cell(cell, field_name: str, value: str) -> bool:
    """For templates using plain Unicode ☐ characters (e.g. Form 2)."""
    val_lower = (value or "").lower()
    ticked = False
    for p in cell.paragraphs:
        txt = p.text
        if "5in5" in val_lower and "5in5" in txt and "☑ 5in5" not in txt:
            p.text = txt.replace("5in5", "☑ 5in5")
            ticked = True
        elif ("summer" in val_lower or "he" in val_lower or "hè" in val_lower) and "Summer" in txt:
            if "☐ Summer" in txt:
                p.text = txt.replace("☐ Summer", "☑ Summer")
            elif "☑ Summer" not in txt:
                p.text = txt.replace("Summer", "☑ Summer")
            ticked = True
        elif "work placement" in val_lower and "Work placement" in txt:
            if "☐ Work placement" in txt:
                p.text = txt.replace("☐ Work placement", "☑ Work placement")
            elif "☑ Work placement" not in txt:
                p.text = txt.replace("Work placement", "☑ Work placement")
            ticked = True
        elif any(k in val_lower for k in ["non", "khong tin", "không tín", "khong co tin", "0 tin", "0 tc"]) and "Non Credit-bearing" in txt:
            p.text = txt.replace("Non Credit-bearing", "☑ Non Credit-bearing")
            ticked = True
        elif any(k in val_lower for k in ["credit", "tin chi", "tín chỉ", "co tinh", "có tính", "tc"]) and "Credit-bearing" in txt and not any(k in val_lower for k in ["non", "khong", "không"]):
            import re
            m = re.search(r'(\d+)', value)
            cred_num = m.group(1) if m else ""
            if cred_num:
                p.text = txt.replace("☐ Credit-bearing\tcredit", f"☑ Credit-bearing: {cred_num} credit").replace("Credit-bearing\tcredit", f"☑ Credit-bearing: {cred_num} credit")
            else:
                p.text = txt.replace("☐ Credit-bearing", "☑ Credit-bearing")
            ticked = True
    return ticked


def _tick_checkbox_in_cell(cell, field_name: str, value: str) -> bool:
    """Tick the real Word checkbox matching `value` for this field, by
    setting its w14:checked val to "1" and swapping its displayed
    glyph to the checked-state character, or swapping Unicode ☐ to ☑."""
    keywords = _CHECKBOX_OPTION_MAP.get(field_name)
    if not keywords or not value:
        return False

    # Check Unicode checkboxes first (e.g. Form 2)
    if any("☐" in p.text for p in cell.paragraphs):
        if _tick_unicode_checkbox_in_cell(cell, field_name, value):
            return True

    val_lower = value.lower()
    for paragraph in cell.paragraphs:
        options = _find_checkbox_options_in_paragraph(paragraph)
        if not options:
            continue

        for option in options:
            lbl = option["label_text"].strip().lower()
            matched = False

            if field_name == "credit_info":
                is_non = any(k in val_lower for k in ["non", "khong tin", "không tín", "khong co tin", "0 tin", "0 tc"])
                is_cred = not is_non and any(k in val_lower for k in ["credit", "tin chi", "tín chỉ", "co tinh", "có tính", "tc", "3", "2", "4", "1"])
                if is_non and "non" in lbl:
                    matched = True
                elif is_cred and "non" not in lbl and ("credit" in lbl or "bearing" in lbl):
                    matched = True
                    import re
                    m = re.search(r'(\d+)', value)
                    if m:
                        cred_num = m.group(1)
                        for r in paragraph.runs:
                            if "credit-bearing" in r.text.lower() or "……" in r.text or "…" in r.text:
                                for dots in ["…………………………………………", "………………………………………", "………………………", "…………", "……", "…"]:
                                    if dots in r.text:
                                        r.text = r.text.replace(dots, f" {cred_num} ")
                                        break
            elif field_name == "repeated_issue":
                if "yes" in val_lower or "lan dau" in val_lower or "dung" in val_lower or "phai" in val_lower:
                    if lbl == "yes" or lbl.startswith("yes"):
                        matched = True
                elif "no" in val_lower or "da tung" in val_lower or "chua" in val_lower:
                    if lbl == "no" or lbl.startswith("no"):
                        matched = True
            else:
                for kw in keywords:
                    if kw in val_lower and kw in lbl:
                        matched = True
                        break

            if matched:
                option["checked_elem"].set(f"{_W14_NS}val", "1")
                option["t_elem"].text = option["checked_char"]
                return True

    return False


def _tick_checkboxes_in_paragraphs(paragraphs, field_name: str, value: str) -> bool:
    """Tick matching checkbox options in a list of document paragraphs (e.g. Form 4.3)."""
    keywords = _CHECKBOX_OPTION_MAP.get(field_name)
    if not keywords or not value:
        return False
    val_lower = value.lower()
    matched_keyword = None
    for kw in keywords:
        if kw in val_lower:
            matched_keyword = kw
            break
    if not matched_keyword:
        return False

    for p in paragraphs:
        opts = _find_checkbox_options_in_paragraph(p)
        for opt in opts:
            label = opt["label_text"].strip().lower()
            if matched_keyword in label:
                opt["checked_elem"].set(f"{_W14_NS}val", "1")
                opt["t_elem"].text = opt["checked_char"]
                return True
    return False


def _fill_form_4_3_matrix_and_notes(doc, field_values: dict[str, str | None]) -> None:
    """Specialized handler for Form 4.3 non-table fields: Table 5 matrix,
    paragraphs checkboxes, and free-text comments."""
    # 1. Fill Table 5 (19 evaluation statements)
    rating_val = (field_values.get("overall_rating") or "").lower()
    score_col = None
    if "excellent" in rating_val or "5" in rating_val or "xuat sac" in rating_val:
        score_col = 5
    elif "good" in rating_val or "4" in rating_val or "tot" in rating_val:
        score_col = 4
    elif "average" in rating_val or "3" in rating_val or "trung binh" in rating_val:
        score_col = 3
    elif "below average" in rating_val or "2" in rating_val:
        score_col = 2
    elif "poor" in rating_val or "1" in rating_val:
        score_col = 1

    if score_col is not None and len(doc.tables) > 5:
        t5 = doc.tables[5]
        for r_idx in list(range(1, 12)) + list(range(13, len(t5.rows))):
            try:
                cell = t5.rows[r_idx].cells[score_col]
                cell.text = "✓"
            except Exception:
                pass

    # 2. Tick checkboxes in Form 4.3 paragraphs (P84..end)
    form4_paras = doc.paragraphs[84:]
    if field_values.get("resources_used"):
        _tick_checkboxes_in_paragraphs(form4_paras, "resources_used", field_values["resources_used"])
    if field_values.get("overall_rating"):
        _tick_checkboxes_in_paragraphs(form4_paras, "overall_rating", field_values["overall_rating"])
    if field_values.get("would_recommend"):
        _tick_checkboxes_in_paragraphs(form4_paras, "would_recommend", field_values["would_recommend"])

    # 3. Fill free-text comments
    notes = field_values.get("overall_experience_notes")
    if notes and len(doc.paragraphs) > 110:
        doc.paragraphs[110].text = notes

    suggestions = field_values.get("suggestions_to_improve")
    if suggestions and len(doc.paragraphs) > 123:
        doc.paragraphs[123].text = suggestions


def _write_into_cell(cell, value: str, field_name: str = "") -> None:
    """Write a value into a table cell.

    For checkbox-style fields (type_of_internship, credit_info, repeated_issue):
    tick the real matching Word checkbox control (see _tick_checkbox_in_cell)
    — no extra text line is added, the ticked box IS the answer.

    For everything else: fill the first empty paragraph already in the cell,
    or append one.
    """
    if _tick_checkbox_in_cell(cell, field_name, value):
        return

    # If field is a pure checkbox field (like type_of_internship, credit_info, repeated_issue)
    # and the cell contains checkboxes, DO NOT write invalid non-matching text into the checkbox cell!
    if field_name in _CHECKBOX_OPTION_MAP:
        if any("<w:sdt" in p._p.xml or "☐" in p.text for p in cell.paragraphs):
            return

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

        if f.table_index < 0 or f.col_index < 0:
            # Non-table fields are handled specially below
            continue

        try:
            table = document.tables[f.table_index]
            row = table.rows[f.row_index]
            cell = row.cells[f.col_index]
            _write_into_cell(cell, value, field_name=f.name)
        except (IndexError, AttributeError) as exc:
            logger.warning(
                "Could not write field '%s' for %s at (table=%d, row=%d, col=%d): %s",
                f.name, form_code, f.table_index, f.row_index, f.col_index, exc,
            )
            continue

    if form_code == "Form 4.3":
        _fill_form_4_3_matrix_and_notes(document, field_values)

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