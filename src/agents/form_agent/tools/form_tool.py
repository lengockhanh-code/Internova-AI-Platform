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
import re as _re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Literal

from src.config import get_settings
from docx.enum.text import WD_ALIGN_PARAGRAPH

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
    paragraph_index: int = -1
    """Set (>=0) for fields living in a STANDALONE paragraph outside
    any table — e.g. Form 1's "Full name" line under "Commitment from
    Student", which is a plain document paragraph, not a table cell.
    When set, fill_form() writes here instead of a table cell (see
    _write_into_paragraph). Leave -1 (default) for the normal
    table-cell case — existing FormField(...) calls that don't pass
    this argument are unaffected."""


FORM_1_FIELDS: list[FormField] = [
    # Nhóm A — sinh viên chắc chắn biết (quyết định học vụ của chính họ)
    FormField("host_company", "Tên công ty tiếp nhận", "Tên công ty thực tập", True, 3, 0, 1),
    FormField("intern_position", "Vị trí thực tập", "Chức danh/vị trí công việc", True, 3, 5, 1),
    FormField("type_of_internship", "Loại hình thực tập (5in5 / Summer / Work placement / khác)",
              "vd: 5in5, Summer, Work placement, hoặc mô tả khác", True, 1, 0, 1),
    FormField("credit_info", "Có tính tín chỉ không, mấy tín chỉ",
              "vd: 'Credit-bearing, 3 tín chỉ' hoặc 'Non credit-bearing'", True, 1, 1, 1),
    FormField("course_code", "Mã môn học (nếu có)", "Mã môn, có thể để trống nếu chưa đăng ký", False, 1, 2, 1),
    # FIX: "Full name" dưới phần "Commitment from Student" — đây là
    # cam kết CỦA SINH VIÊN (không phải Host Company/College), nên
    # sinh viên phải điền. Nằm NGOÀI mọi bảng (1 đoạn văn độc lập
    # trong file gốc, đã xác nhận bằng cách đọc trực tiếp doc.paragraphs),
    # nên dùng paragraph_index thay vì table_index — cơ chế ghi mới,
    # trước đây fill_form() chỉ hỗ trợ ghi vào ô bảng nên field này
    # từng bị bỏ sót hoàn toàn khỏi schema.
    # KHÔNG điền "Date"/"Signature" trên cùng khu vực — chữ ký thật và
    # ngày ký không được tự động hóa, đúng nguyên tắc xuyên suốt toàn
    # bộ form_agent (xem Form 2's student_name_printed cho tiền lệ
    # tương tự: chỉ điền tên in, không đụng chữ ký).
    FormField("student_full_name", "Họ tên đầy đủ (phần cam kết của sinh viên)",
              "Tên đầy đủ sinh viên, để điền vào dòng 'Full name' dưới phần Commitment from Student",
              True, paragraph_index=11),
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
              "Thông tin công ty tự điền nếu sinh viên không rõ. QUAN TRỌNG: "
              "template thật có 4 mục con riêng biệt — trả về value theo "
              "ĐÚNG cấu trúc sau, mỗi phần bắt đầu bằng đúng nhãn (giữ "
              "nguyên viết hoa, có dấu ':'), chỉ điền phần nào có thông "
              "tin thật, bỏ qua phần không có: "
              "'PROJECT_DESC: <mô tả dự án/công việc dự kiến>' "
              "'BENEFIT: <lợi ích cho sinh viên/công ty>' "
              "'SKILLS: <kỹ năng kỹ thuật/mềm cần có>' "
              "'QUALIFICATIONS: <yêu cầu về trình độ, năm học...>' "
              "— các phần cách nhau bằng dấu xuống dòng.",
              False, 3, 9, 1),
]

FORM_2_FIELDS: list[FormField] = [
    FormField("name_in_full", "Họ tên đầy đủ", "Tên đầy đủ sinh viên", True, 0, 0, 1),
    FormField("student_id", "Mã số sinh viên", "MSSV", True, 0, 0, 3),
    FormField("email", "Email", "Email VinUni", True, 0, 1, 1),
    FormField("intake", "Khóa (Intake)", "vd: K2023", True, 0, 1, 3),
    FormField("college", "College", "vd: CECS, CBM, CAS, CHS", True, 0, 2, 1),
    # FIX: template thật cũng có khu vực checkbox Type of
    # internship/Credit y hệt Form 1 (đã xác nhận bằng cách đọc trực
    # tiếp file gốc) — trước đây bị bỏ sót hoàn toàn khỏi schema, nên
    # 2 checkbox này luôn để trống dù template có sẵn.
    FormField("type_of_internship", "Loại hình thực tập (5in5 / Summer / Work placement / khác)",
              "vd: 5in5, Summer, Work placement, hoặc mô tả khác", True, 0, 3, 1),
    FormField("credit_info", "Có tính tín chỉ không, mấy tín chỉ",
              "vd: 'Credit-bearing, 3 tín chỉ' hoặc 'Non credit-bearing'", True, 0, 4, 1),
    FormField("course_code", "Mã môn học (nếu có)", "Có thể để trống", False, 0, 5, 1),
    FormField("host_company", "Tên công ty tiếp nhận", "Công ty thực tập ở nước ngoài", True, 0, 6, 1),
    FormField("internship_position", "Vị trí thực tập", "Chức danh/vị trí", True, 0, 7, 1),
    # FIX: label "Student's name:" và 2 dòng trống dành cho câu trả
    # lời NẰM CHUNG 1 Ô (row0, col2) — trước đây trỏ nhầm sang row1
    # (1 ô KHÁC, tách rời), khiến tên bị ghi vào chỗ không liên quan
    # gì tới label, "trôi" ra xa. Đã xác nhận qua đọc trực tiếp cấu
    # trúc paragraph thật trong file gốc.
    FormField("student_name_printed", "Tên in (bên cạnh chữ ký)", "Tên đầy đủ để in", True, 1, 0, 2),
]

FORM_3_FIELDS: list[FormField] = [
    FormField("name_in_full", "Họ tên đầy đủ", "Tên đầy đủ sinh viên", True, 0, 0, 1),
    FormField("student_id", "Mã số sinh viên", "MSSV", True, 0, 0, 3),
    FormField("email", "Email", "Email VinUni", True, 0, 1, 1),
    FormField("intake", "Khóa (Intake)", "vd: K2023", True, 0, 1, 3),
    FormField("college", "College", "vd: CECS, CBM, CAS, CHS", True, 0, 2, 1),
    # FIX: template thật cũng có khu vực checkbox Type of
    # internship/Credit y hệt Form 1 (đã xác nhận bằng cách đọc trực
    # tiếp file gốc) — trước đây bị bỏ sót hoàn toàn khỏi schema.
    FormField("type_of_internship", "Loại hình thực tập (5in5 / Summer / Work placement / khác)",
              "vd: 5in5, Summer, Work placement, hoặc mô tả khác", True, 0, 3, 1),
    FormField("credit_info", "Có tính tín chỉ không, mấy tín chỉ",
              "vd: 'Credit-bearing, 3 tín chỉ' hoặc 'Non credit-bearing'", True, 0, 4, 1),
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
              "vd: 5in5, Summer, Work placement, hoặc mô tả khác", True, 4, 3, 1),
    FormField("credit_info", "Có tính tín chỉ không, mấy tín chỉ",
              "vd: 'Credit-bearing, 3 tín chỉ' hoặc 'Non credit-bearing'", True, 4, 4, 1),
    FormField("course_code", "Mã môn học (nếu có)", "Có thể để trống", False, 4, 5, 1),
    FormField("host_company", "Tên công ty tiếp nhận", "Công ty thực tập", True, 4, 6, 1),
    FormField("internship_position", "Vị trí thực tập", "Chức danh/vị trí", True, 4, 7, 1),
    FormField("industry_supervisor", "Người hướng dẫn tại công ty", "Tên industry supervisor", False, 4, 8, 1),
    FormField("department", "Phòng ban", "Phòng ban đã thực tập", False, 4, 10, 1),
    FormField("faculty_supervisor", "Giảng viên hướng dẫn", "Tên faculty mentor", False, 4, 11, 1),
    FormField("resources_used", "Nguồn tìm được thực tập (Career Services / Faculty / Bạn bè / Nhà tuyển dụng cũ / Internet / Khác)",
              "vd: Career Services, Faculty, bạn bè, internet...", False, -1, -1, -1),
    FormField("likert_score", "Điểm đánh giá các tiêu chí trải nghiệm và kỹ năng (1-5)",
              "vd: 5 (Strongly Agree) hoặc 4 (Agree) hoặc điểm cụ thể 1-5", False, -1, -1, -1),
    FormField("overall_rating", "Đánh giá tổng quan về kỳ thực tập (Excellent / Good / Average / Below Average / Poor)",
              "vd: Excellent learning experience, Good, Average, Below Average, Poor", True, -1, -1, -1),
    FormField("overall_comments", "Nhận xét thêm về trải nghiệm thực tập (nếu có)",
              "Nhận xét, điểm mạnh/yếu, trải nghiệm thực tế", False, -1, -1, -1),
    FormField("would_recommend", "Có giới thiệu thực tập này cho bạn khác không (Highly recommend / Recommend / Recommend with reservations / Would not recommend)",
              "Highly recommend, Recommend, Recommend with reservations, hoặc Would not recommend", True, -1, -1, -1),
    FormField("suggestions_to_improve", "Đề xuất cải thiện trải nghiệm thực tập (nếu có)",
              "Đề xuất cho nhà trường hoặc công ty", False, -1, -1, -1),
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
# Student profile pre-fill — maps student_settings_service's DB field
# names to this module's FormField.name convention, so bridge.py can
# pre-fill field_values from the logged-in student's profile without
# needing to know form-schema internals itself.
# =============================================================================

_PROFILE_FIELD_MAP: dict[str, str] = {
    "fullName": "name_in_full",
    "full_name": "name_in_full",
    "studentCode": "student_id",
    "student_code": "student_id",
    "email": "email",
    "faculty": "college",
    "cohort": "intake",
}


def build_profile_field_values(profile: Any) -> dict[str, str | None]:
    """Convert a student profile (dict or object from get_student_settings) into
    field_values keyed by this module's FormField.name convention. Accepts either
    nested {"profile": {...}} dict or flattened dict/object. Drops keys with no
    mapping or falsy values. Safe with None (returns {}).
    """
    if not profile:
        return {}

    data = profile
    if isinstance(profile, dict) and "profile" in profile and isinstance(profile["profile"], dict):
        data = profile["profile"]

    values: dict[str, str | None] = {}
    for source_key, target_name in _PROFILE_FIELD_MAP.items():
        if isinstance(data, dict):
            value = data.get(source_key)
        else:
            value = getattr(data, source_key, None)
        if value:
            values[target_name] = str(value).strip()

    # Form 1 uses student_full_name, Form 2 also has student_name_printed
    if "name_in_full" in values:
        values["student_full_name"] = values["name_in_full"]
        values["student_name_printed"] = values["name_in_full"]

    return values



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
5. Chỉ trích từ tin nhắn thực sự nhằm CUNG CẤP THÔNG TIN để điền form. \
Nếu tin nhắn gần nhất của sinh viên là một CÂU HỎI khác (hỏi tư vấn, \
hỏi về form/chính sách khác, không liên quan tới việc điền đơn hiện \
tại), TUYỆT ĐỐI không trích xuất bất kỳ giá trị nào từ câu đó — kể cả \
khi câu đó tình cờ nhắc tới tên riêng, số liệu, hoặc từ khóa trùng với \
tên field cần điền.
6. KIỂM TRA TÍNH HỢP LÝ: với mỗi giá trị định trích xuất, đánh giá xem \
nó có VÔ LÝ, RÕ RÀNG LÀ BỊA/ĐÙA, HOẶC KHÔNG PHÙ HỢP để đưa vào 1 văn \
bản hành chính chính thức hay không. Ví dụ vi phạm: tên công ty là \
câu chửi thề/nội dung phản cảm; email/MSSV rõ ràng là chuỗi ký tự vô \
nghĩa (vd "asdasd", "xxx123"); mô tả sự việc chứa nội dung kích động \
thù ghét, phân biệt đối xử, hoặc yêu cầu làm việc phi pháp; giá trị \
hoàn toàn không liên quan tới field đang hỏi (vd field hỏi "vị trí \
thực tập" nhưng câu trả lời là 1 câu chuyện không liên quan). \
7. KHÔNG TÁI SỬ DỤNG giá trị đã rõ ràng trả lời cho 1 field CỤ THỂ \
khác sang field này, trừ khi sinh viên THỰC SỰ lặp lại/xác nhận giá \
trị đó cho đúng field hiện tại. Ví dụ: nếu sinh viên nói "vị trí: \
backend", giá trị "backend" CHỈ được điền vào field vị trí — TUYỆT \
ĐỐI không tự suy diễn rồi điền "backend" vào field "Phòng ban" hay \
"Mô tả công việc" chỉ vì nghe có vẻ liên quan. Nếu field hiện tại \
KHÔNG được sinh viên nhắc tới RIÊNG, để null, dù có 1 từ nào đó trong \
hội thoại nghe "có vẻ hợp lý" cho field này. \
Nếu phát hiện, để giá trị field đó là null VÀ thêm vào object "flags" \
theo dạng {"ten_field": "lý do ngắn gọn bằng tiếng Việt"}. Field nào \
không có vấn đề gì thì KHÔNG đưa vào "flags".

Trả về JSON có 2 phần: "values" (các field-value như thường lệ) và \
"flags" (chỉ chứa field có vấn đề, có thể để trống {} nếu không field \
nào có vấn đề).
"""

_EXTRACTION_USER_TEMPLATE = """\
Hội thoại giữa sinh viên và trợ lý (từ đầu tới giờ):
---
{conversation_text}
---

Các field cần trích xuất (tên field — mô tả):
{field_descriptions}

Trả về JSON đúng cấu trúc:
{{
  "values": {{"ten_field": "gia_tri hoặc null", ...}},
  "flags": {{"ten_field": "lý do ngắn gọn nếu giá trị có vấn đề"}}
}}
"values" chứa TẤT CẢ field ở trên (key là tên field). "flags" CHỈ chứa \
field có vấn đề (xem quy tắc 6), có thể để trống {{}}.
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
) -> tuple[dict[str, str | None], dict[str, str]]:
    """Run one LLM extraction call for a single batch of fields.

    Returns (values, flags): values maps field name -> extracted
    value (or None); flags maps field name -> short reason, only for
    fields the model judged unreasonable/fake/inappropriate for an
    official document (see rule 6 in _EXTRACTION_SYSTEM_PROMPT) — a
    flagged field's value is always None even if the model somehow
    also returned one under "values", since a flagged value must never
    be silently accepted.
    """
    empty_values: dict[str, str | None] = {f.name: None for f in fields}

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

        raw_values = parsed.get("values", {}) if isinstance(parsed, dict) else {}
        raw_flags = parsed.get("flags", {}) if isinstance(parsed, dict) else {}
        if not isinstance(raw_values, dict):
            raw_values = {}
        if not isinstance(raw_flags, dict):
            raw_flags = {}

        field_names = {f.name for f in fields}

        flags: dict[str, str] = {
            name: str(reason)
            for name, reason in raw_flags.items()
            if name in field_names and reason
        }

        values: dict[str, str | None] = {}
        for f in fields:
            if f.name in flags:
                # Flagged -> never accept a value for this field this
                # round, regardless of what "values" contained.
                values[f.name] = None
                continue
            value = raw_values.get(f.name)
            values[f.name] = value if isinstance(value, str) and value.strip() else None

        return values, flags

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
        return empty_values, {}


# =============================================================================
# Guardrail: validate extracted values before trusting them
# =============================================================================
#
# FIX: extract_fields() previously trusted whatever the LLM returned
# with no post-hoc check — a real, observed case: a student mid-way
# through collecting_info sent an unrelated question that happened to
# mention a company name ("Shopee"), and it got silently accepted as
# host_company. The system prompt above (rule 5) is the FIRST line of
# defense (tells the model not to extract from off-topic messages at
# all); this validation is the SECOND line of defense, specifically
# for fields with a checkable, machine-verifiable format — if the
# extracted value doesn't even look like a valid email / student ID,
# it's discarded (set back to None) rather than written into the
# form, regardless of what the LLM claimed. This does NOT try to
# validate free-text fields (company name, position, descriptions —
# there's no reliable format to check), only the handful of fields
# with an actual structural pattern.

_FIELD_VALIDATORS: dict[str, "Callable[[str], bool]"] = {
    "email": lambda v: bool(_re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", v.strip())),
    # VinUni student IDs look like "21CECS099", "20CAS045", "2A202601001", etc.
    "student_id": lambda v: bool(_re.match(r"^[0-9A-Za-z\-_]{5,20}$", v.strip())),
}


def _validate_extracted_value(field_name: str, value: str | None) -> str | None:
    if value is None:
        return None

    validator = _FIELD_VALIDATORS.get(field_name)
    if validator is None:
        # No machine-checkable format for this field (free text) —
        # nothing to validate here; rely on the system prompt's rule 5
        # and the human review step for these.
        return value

    if validator(value.strip()):
        return value

    logger.warning(
        "Extracted value for '%s' failed format validation, discarding: %r",
        field_name, value,
    )
    print(
        f"⚠️ [extract_fields] Giá trị '{value}' cho field '{field_name}' "
        f"không đúng định dạng mong đợi — bỏ qua, không ghi vào form."
    )
    return None


def extract_fields(
    conversation_text: str, form_code: FormCode,
) -> tuple[dict[str, str | None], dict[str, str]]:
    """Pull whatever field values the student has already mentioned in
    the conversation. Never invents a value not actually stated.

    Returns (values, flags). flags maps field name -> short Vietnamese
    reason, combining two sources: (a) fields the extraction LLM
    itself judged unreasonable/fake/inappropriate (see rule 6 in
    _EXTRACTION_SYSTEM_PROMPT), and (b) fields whose value passed the
    LLM but failed a machine-checkable format validator (email,
    student_id — see _validate_extracted_value). Either way, a flagged
    field's value is always None in the returned values dict — never
    silently written into the form. The caller (collect_info.py) uses
    `flags` to build a corrective message asking the student to
    re-provide that specific information, rather than treating it the
    same as a field that's simply still missing.

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

    empty_values: dict[str, str | None] = {f.name: None for f in fields}

    cleaned = (conversation_text or "").strip()
    # Fast path: if the conversation text is just a short initial command or confirmation
    # (e.g. "có", "ừ điền giúp mình", "điền giúp mik form 3", "bắt đầu điền đơn"),
    # without specific field values, return immediately without wasting LLM extraction batches.
    words = cleaned.split()
    if len(words) <= 7 and not any(char in cleaned for char in ("@", ":", ",", "\n")):
        return empty_values, {}

    if not settings.openai_api_key:
        logger.warning("OPENAI_API_KEY not configured; skipping extraction")
        return empty_values, {}

    combined_values: dict[str, str | None] = {}
    combined_flags: dict[str, str] = {}

    # FIX (reverted): an earlier attempt to run these batches
    # concurrently via ThreadPoolExecutor (for speed) caused ALL
    # batches to fail with "Connection error" simultaneously when
    # tested on a real network — confirmed 100% failure rate, firing
    # multiple simultaneous outbound HTTPS connections to the OpenAI
    # API apparently isn't reliably handled by the network/firewall in
    # that environment (school network, VPN, or antivirus deep-packet
    # inspection choking on concurrent connection bursts), even though
    # sequential (one-at-a-time) calls work fine. A form that extracts
    # ZERO fields (total failure) is far worse than one that's just
    # slow — reliability takes priority over speed here. Reverted to
    # sequential processing, proven stable throughout this project.
    # Revisit parallelization later only with careful, LIMITED
    # concurrency (e.g. max 2 at a time) and proper retry/backoff, with
    # time to test network behavior properly — not under deadline
    # pressure.
    for start in range(0, len(fields), _MAX_FIELDS_PER_EXTRACTION_CALL):
        batch = fields[start:start + _MAX_FIELDS_PER_EXTRACTION_CALL]
        batch_values, batch_flags = _extract_fields_batch(conversation_text, batch, settings)
        combined_values.update(batch_values)
        combined_flags.update(batch_flags)

    # Guardrail: discard any value that fails format validation for
    # fields with a checkable format (email, student_id) — see
    # _validate_extracted_value's docstring above. A field already
    # flagged by the LLM itself keeps its (more specific) reason
    # rather than being overwritten by the generic format-check one.
    validated: dict[str, str | None] = {}
    for name, value in combined_values.items():
        if name in combined_flags:
            validated[name] = None
            continue
        checked_value = _validate_extracted_value(name, value)
        if checked_value is None and value is not None:
            # Passed the LLM but failed format validation.
            combined_flags[name] = "định dạng chưa hợp lệ"
        validated[name] = checked_value

    return validated, combined_flags


def build_rejection_message(
    flags: dict[str, str],
    form_code: FormCode,
    attempt_counts: dict[str, int],
) -> str:
    """Compose a corrective message for fields the student just tried
    to provide but were rejected (see extract_fields' `flags`).

    First attempt at a given field: polite, explains the specific
    issue, asks for a corrected value. Repeated attempts (student
    tried again with still-invalid info) escalate to a firmer warning
    — still polite, but explicit that the form cannot be completed
    with placeholder/invalid information.
    """
    fields_by_name = {f.name: f for f in FORM_SCHEMAS[form_code]}

    first_time_lines = []
    repeated_lines = []

    for name, reason in flags.items():
        label = fields_by_name[name].label_vi if name in fields_by_name else name
        count = attempt_counts.get(name, 0)
        if count >= 1:
            repeated_lines.append(f"- **{label}**: {reason}")
        else:
            first_time_lines.append(f"- **{label}**: {reason}")

    parts: list[str] = []

    if first_time_lines:
        parts.append(
            "Mình chưa thể nhận thông tin sau vì có vẻ chưa hợp lệ:\n\n"
            + "\n".join(first_time_lines)
            + "\n\nBạn vui lòng cung cấp lại thông tin chính xác giúp mình nhé."
        )

    if repeated_lines:
        parts.append(
            "⚠️ Mình vẫn chưa nhận được thông tin hợp lệ cho:\n\n"
            + "\n".join(repeated_lines)
            + "\n\nĐể hoàn thiện đơn, thông tin bắt buộc phải chính xác và có "
            "thật — mình không thể điền thông tin không hợp lệ vào văn bản "
            "chính thức. Bạn kiểm tra lại và cung cấp đúng thông tin nhé, "
            "hoặc gõ 'hủy' nếu muốn dừng lại."
        )

    return "\n\n".join(parts)


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
    student_name: str | None = None,
    student_id: str | None = None,
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

    prefix = ""
    if student_name and student_id:
        prefix = f"ℹ️ *Đã tự động điền thông tin cá nhân của bạn: **{student_name}** (MSSV: **{student_id}**).*\n\n"
    elif student_name:
        prefix = f"ℹ️ *Đã tự động điền thông tin cá nhân của bạn: **{student_name}**.*\n\n"

    return (
        f"{prefix}"
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
    "type_of_internship": ("5in5", "summer", "work placement"),
    "credit_info": ("non credit", "non-credit", "credit-bearing", "credit bearing"),
    # FIX: Form 3's "Repeated issue" question has REAL Word checkbox
    # controls for Yes/No (confirmed: 2 <w:sdt> elements found in that
    # cell) — previously this field was written as plain text ("Yes"/
    # "No") via the generic fallback, ignoring the actual checkboxes
    # present in the template.
    "repeated_issue": ("yes", "no"),
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


def _tick_checkbox_in_cell(cell, field_name: str, value: str) -> bool:
    """Tick the real Word checkbox matching `value` for this field, by
    setting its w14:checked val to "1" and swapping its displayed
    glyph to the checked-state character — see
    _find_checkbox_options_in_paragraph for how checkboxes are paired
    with their label text. Returns False (caller falls back to plain
    text append) when this field isn't a checkbox field, or no option
    matched, or the paragraph doesn't actually contain checkbox
    controls (e.g. an unexpected template layout — fail safe rather
    than guessing).
    """
    keywords = _CHECKBOX_OPTION_MAP.get(field_name)
    if not keywords:
        return False

    matched_keyword = None

    # FIX (priority reorder): check the credit-count rule FIRST, ahead
    # of generic keyword matching, for credit_info specifically —
    # NOT only as a fallback when no keyword matched. Previously this
    # only ran when matched_keyword was still None after the keyword
    # loop below; if the extracted value happened to ALSO contain
    # wording resembling "non credit" anywhere (e.g. a noisy/confused
    # multi-turn extraction re-reading a long conversation), that
    # keyword would win first and this correct, stronger signal never
    # got a chance to run — confirmed on a real filled form where
    # "Non Credit-bearing" got ticked despite the student explicitly
    # stating "3 tín chỉ".
    #
    # A specific credit COUNT is unambiguous domain evidence (VinUni's
    # schema is strictly binary; there is no credit number under "Non
    # Credit-bearing") — stronger and more reliable than a keyword
    # match that may have been extracted noisily, so it takes
    # precedence rather than being a last-resort fallback.
    if field_name == "credit_info" and _re.search(r"\d", value):
        matched_keyword = "credit-bearing"
    else:
        value_lower = value.lower()
        for keyword in keywords:
            if keyword in value_lower:
                matched_keyword = keyword
                break

    if matched_keyword is None:
        return False

    for paragraph in cell.paragraphs:
        options = _find_checkbox_options_in_paragraph(paragraph)

        if options:
            for option in options:
                # FIX (root cause, been broken since the first checkbox-
                # tick attempt): using `in` (substring anywhere) instead
                # of a prefix check meant "credit-bearing" always matched
                # the "Non Credit-bearing" option FIRST — since "non
                # credit-bearing" (lowercased) literally CONTAINS
                # "credit-bearing" as a substring. Every previous attempt
                # to tick "Credit-bearing" was silently ticking "Non
                # Credit-bearing" instead; this was never actually caught
                # because earlier verification only checked "is SOME
                # checkbox ticked", not which physical option it
                # corresponds to via its label text. Using startswith()
                # on the stripped label correctly distinguishes them,
                # since each option's label text begins with its own
                # distinguishing word ("Non ..." vs "Credit-bearing...").
                # Normalize hyphen vs space before comparing — the
                # keyword list has both "non credit" and "non-credit"
                # variants, but the real label text always uses a space
                # ("Non Credit-bearing"); without this, a match on the
                # hyphenated keyword variant would fail to tick anything
                # at all (safe, but silently does nothing).
                normalized_label = option["label_text"].strip().lower().replace("-", " ")
                normalized_keyword = matched_keyword.replace("-", " ")
                if normalized_label.startswith(normalized_keyword):
                    option["checked_elem"].set(f"{_W14_NS}val", "1")
                    option["t_elem"].text = option["checked_char"]

                    if field_name == "credit_info" and matched_keyword == "credit-bearing":
                        _insert_credit_number(paragraph, value)

                    return True
            continue

        # FIX: this paragraph has NO Word Checkbox Content Controls at
        # all (confirmed on Form 2's Type of internship / Credit
        # lines — 0 <w:sdt> elements, a completely different template
        # authoring style than Form 1/3/4.3). Try the alternate
        # mechanism before giving up on this paragraph.
        if _tick_plain_text_checkbox(paragraph, matched_keyword, field_name, value):
            return True

    return False


def _tick_plain_text_checkbox(
    paragraph, matched_keyword: str, field_name: str, value: str,
) -> bool:
    """For templates using a literal Unicode "☐" character as its OWN
    standalone run, immediately before the option's label run(s) —
    confirmed on Form 2's Type of internship/Credit lines, which do
    NOT use Word Checkbox Content Controls at all (0 <w:sdt> elements
    found there, unlike Form 1/3/4.3). Ticks by flipping the specific
    "☐" run belonging to the matched option to "☒".

    FIX: only attempts to START a match at a genuine option BOUNDARY —
    the very first run in the paragraph, or a run immediately
    following a literal "☐" — rather than trying every possible
    starting run index. Confirmed real bug: Form 2's Credit line is
    "Non Credit-bearing☐ Credit-bearing…credit" — the FIRST option's
    own label ("Non Credit-bearing") literally CONTAINS the words
    "Credit-bearing" as a substring within it. Starting the search
    from every index found a false match beginning partway through
    "Non Credit-bearing" (e.g. from its embedded space run) BEFORE
    ever reaching the true second option after the real "☐" —
    identical in spirit to the earlier-fixed SDT label collision, but
    resurfacing here because the old version didn't restrict WHERE a
    match attempt could begin.

    Returns False (caller falls back to the safe old text-append
    behavior) when the matched option has no such literal "☐" run
    right before it — a REAL, confirmed limitation for the FIRST
    option on each of these lines ("5in5", "Non Credit-bearing"),
    which use a Word list/bullet numbering style (<w:numPr>) instead
    of a literal character; there is no safe way to toggle a list
    bullet's appearance via simple text manipulation, so this case is
    intentionally left as a known gap rather than risking incorrect
    XML surgery under time pressure. The student's answer still gets
    written as plain text (old behavior) in this case — not lost,
    just not visually ticked.
    """
    runs = paragraph.runs
    normalized_keyword = matched_keyword.replace("-", " ").lower()

    boundaries = [0] + [
        i for i in range(1, len(runs)) if runs[i - 1].text.strip() == "☐"
    ]

    for start in boundaries:
        accumulated = ""
        end_idx = None
        for j in range(start, min(start + 6, len(runs))):
            accumulated += runs[j].text
            normalized_accum = accumulated.strip().lower().replace("-", " ")

            if normalized_accum.startswith(normalized_keyword):
                end_idx = j
                break

            if len(normalized_accum) > len(normalized_keyword) + 10:
                break

        if end_idx is None:
            continue

        if start == 0:
            return False  # first option, no "☐" to flip

        # Guaranteed by construction: runs[start-1] is a literal "☐"
        # (that's how `start` got into `boundaries` in the first place).
        runs[start - 1].text = runs[start - 1].text.replace("☐", "☒")

        if field_name == "credit_info" and matched_keyword == "credit-bearing":
            # FIX: unlike Form 1 (which has "…………" ellipsis dots as an
            # existing blank to replace), Form 2's template has NO
            # placeholder space between "Credit-bearing" and the
            # "credit" unit word at all (confirmed: runs go directly
            # from "Credit-bearing" to "\t" to "credit", no dots) — so
            # _insert_credit_number() (which searches for "…") would
            # find nothing here. Insert a brand-new run holding the
            # number right after the matched label run instead.
            match_digit = _re.search(r"\d+", value)
            if match_digit:
                # FIX: the run immediately after the matched label is
                # a literal TAB character ("\t") that jumps to a tab
                # stop with a DOT LEADER (confirmed:
                # <w:tab w:leader="dot" w:pos="6629"/> in this
                # paragraph's tab-stop definitions) — Word
                # auto-fills the gap up to that tab stop with a long
                # run of dots, which is exactly the long dashed/dotted
                # line the student saw stretching after the number.
                # Replace that tab with a plain space so "credit"
                # follows immediately, giving a clean "4 credit"
                # cluster instead of "4 ......................credit".
                next_run = runs[end_idx + 1] if end_idx + 1 < len(runs) else None
                if next_run is not None and next_run.text == "\t":
                    next_run.text = " "

                number_run = paragraph.add_run(f" {match_digit.group(0)}")
                runs[end_idx]._r.addnext(number_run._r)

        return True

    return False


def _insert_credit_number(paragraph, value: str) -> None:
    """After ticking "Credit-bearing", also write the actual credit
    COUNT into the template's "Credit-bearing:…………………………………………credit"
    blank — replacing the ellipsis placeholder dots (Unicode "…",
    U+2026, repeated — confirmed by inspecting the real template's raw
    run text) with the number, e.g. becomes
    "Credit-bearing:3 credit". No-op if `value` doesn't contain a
    digit (nothing to insert) or the paragraph has no such dots run
    (unexpected layout — fail safe rather than guessing).

    Cosmetic tidy-up, requested after seeing the checkbox tick
    correctly but the actual credit number never appearing anywhere.
    Safe under the additive-only principle for the same reason as the
    blank-underscore cleanup in _write_into_paragraph: ellipsis/dot
    placeholder characters carry no information of their own, so
    replacing them once the real number is known does not destroy any
    actual content.
    """
    match = _re.search(r"\d+", value)
    if not match:
        return
    number = match.group(0)

    for run in paragraph.runs:
        if "…" in run.text:
            run.text = _re.sub("…+", f" {number} ", run.text, count=1)
            return


def _write_into_cell(cell, value: str, field_name: str = "") -> None:
    """Write a value into a table cell.

    For checkbox-style fields (type_of_internship, credit_info): tick
    the real matching Word checkbox control (see
    _tick_checkbox_in_cell) — no extra text line is added in this
    case, the ticked box IS the answer, exactly like a human filling
    it in by hand.

    For everything else: unchanged — fill the first empty paragraph
    already in the cell (common in these templates — several blank
    lines reserved as writing space), or append one.
    """
    if _tick_checkbox_in_cell(cell, field_name, value):
        return

    for paragraph in cell.paragraphs:
        if not paragraph.text.strip():
            paragraph.add_run(value)
            return

    cell.add_paragraph(value)


def _write_into_paragraph(paragraph, value: str) -> None:
    """Insert a value right after the field label's ':' — BEFORE the
    blank-line underscores — instead of appending at the very end of
    the paragraph.

    FIX: the original version used paragraph.add_run(value), which
    always appends a NEW run at the END of the paragraph — after every
    existing run, including the long underscore blank line (e.g.
    "Full name: ________________________________"). On a real filled
    Form 1, this visibly placed the student's name far to the right,
    disconnected from the "Full name:" label, past the whole blank
    line — confirmed confusing on an actual test.

    Now: find the run containing the field's ':' separator, split it
    there (keep "Label: " in that run), and insert the value
    immediately after — so it reads "Full name: Nguyễn Văn An
    ________________" (name right after the label, any leftover blank
    space trails after, same as someone handwriting their name right
    after the printed label). Still fully additive: nothing existing
    is deleted, only relocated — the leftover blank-line text becomes
    its own run placed right after the inserted value.
    """
    target_run = None
    colon_pos_in_run = -1

    for run in paragraph.runs:
        idx = run.text.rfind(":")
        if idx != -1:
            target_run = run
            colon_pos_in_run = idx

    if target_run is None:
        # No ':' found anywhere (unexpected layout) — fall back to the
        # old, safe append-at-end behavior rather than guessing.
        paragraph.add_run(value)
        return

    original_text = target_run.text
    split_at = colon_pos_in_run + 1
    if split_at < len(original_text) and original_text[split_at] == " ":
        split_at += 1

    label_part = original_text[:split_at]
    remainder_part = original_text[split_at:]

    target_run.text = label_part

    # add_run() appends at the end of the paragraph; then move those
    # new run elements to sit right after target_run in the
    # underlying XML (lxml's addnext() relocates an element already
    # in the tree — it does not duplicate it).
    value_run = paragraph.add_run(value)
    target_run._r.addnext(value_run._r)

    # FIX: drop the leftover blank-line placeholder (a run of pure
    # underscore/whitespace characters, e.g.
    # "________________________________") once a value has been
    # written — requested for a cleaner look ("Full name: Nguyễn Văn
    # An" instead of trailing off into a long unused blank line).
    # This is safe under the additive-only principle: underscore/dot
    # placeholder runs carry no information of their own (they only
    # mark where a human would handwrite something) — unlike a real
    # label or existing answer, discarding them once filled doesn't
    # destroy any actual content, the same way a human filling in a
    # paper form naturally covers/replaces the blank line with their
    # handwriting. A remainder containing anything OTHER than
    # underscores/whitespace (unexpected layout) is still preserved,
    # never dropped.
    if remainder_part and not _re.fullmatch(r"[_\s]*", remainder_part):
        remainder_run = paragraph.add_run(remainder_part)
        value_run._r.addnext(remainder_run._r)


_INTERNSHIP_DETAILS_MARKERS = ("PROJECT_DESC", "BENEFIT", "SKILLS", "QUALIFICATIONS")

_INTERNSHIP_DETAILS_LABEL_KEYWORDS = {
    "PROJECT_DESC": "description of proposed",
    "BENEFIT": "expected benefit",
    "SKILLS": "specified skills required",
    "QUALIFICATIONS": "required qualifications",
}


def _parse_internship_details_sections(value: str) -> dict[str, str]:
    """Parse a value expected to contain the 4 markers instructed in
    internship_details' field description ("PROJECT_DESC:", "BENEFIT:",
    "SKILLS:", "QUALIFICATIONS:") into {marker: content}. Returns an
    empty dict if none of the markers are found — the caller falls
    back to the old single-blob behavior for robustness (e.g. an
    older/simpler extraction that didn't follow the new format).
    """
    pattern = "|".join(_INTERNSHIP_DETAILS_MARKERS)
    parts = _re.split(f"({pattern}):", value)

    sections: dict[str, str] = {}
    for i in range(1, len(parts) - 1, 2):
        marker = parts[i]
        content = parts[i + 1].strip()
        if content:
            sections[marker] = content
    return sections


def _distribute_internship_details(cell, value: str) -> None:
    """Write internship_details' 4 logical sections into their
    correct, DISTINCT sub-areas within the cell — see module-level
    note in fill_form() for why the generic single-blank write is
    wrong for this specific field (confirmed on a real filled form:
    everything landed under "Description of Proposed..." only, the
    other 3 sub-sections stayed empty).

    FIX (per explicit request): REPLACES each English instructional
    label's own text directly with the Vietnamese content, rather
    than keeping the English label intact and adding the answer on a
    blank line below it. This is a deliberate exception to this
    subtree's usual additive-only/non-destructive principle — applied
    here because the English labels are template AUTHORING TEXT
    (instructions to whoever fills the form), not information the
    form is trying to preserve, and the requester explicitly asked
    for the English text to be replaced rather than kept alongside
    the answer.

    Falls back to the old behavior (whole value into the first empty
    paragraph in the cell) if no recognizable markers are found in
    `value` — still additive in that fallback case, since there's no
    specific label being targeted for replacement.
    """
    sections = _parse_internship_details_sections(value)

    if not sections:
        for paragraph in cell.paragraphs:
            if not paragraph.text.strip():
                paragraph.add_run(value)
                return
        cell.add_paragraph(value)
        return

    paragraphs = cell.paragraphs

    for marker, content in sections.items():
        keyword = _INTERNSHIP_DETAILS_LABEL_KEYWORDS.get(marker)
        if not keyword:
            continue

        label_idx = None
        for idx, p in enumerate(paragraphs):
            if keyword in p.text.strip().lower():
                label_idx = idx
                break

        if label_idx is None:
            continue

        label_para = paragraphs[label_idx]

        # Replace the label paragraph's own text with the VN content:
        # clear every existing run, then put the content into the
        # first run (preserving that run's font/formatting) so the
        # English instructional text is gone, not just supplemented.
        runs = label_para.runs
        for run in runs:
            run.text = ""
        if runs:
            runs[0].text = content
        else:
            label_para.add_run(content)


def _fill_date_range_placeholder(paragraph, value: str) -> bool:
    """Insert start/end dates into a "From ... to" template line,
    replacing the blank space between "From" and "to" — e.g. becomes
    "From 01/09/2026 to 30/11/2026" instead of appending the raw
    value as a stray line below the unfilled placeholder (same class
    of issue fixed earlier for checkboxes and "Full name").

    Finds date-like patterns (dd/mm/yyyy or similar, "/" or "-"
    separated) in `value` rather than relying on a specific separator
    word ("đến") — students may phrase the range in various ways.
    Returns False (caller falls back to the old append behavior) if
    fewer than 2 dates are found, or the "From ... to" placeholder
    text isn't present — fail safe rather than guessing.
    """
    dates = _re.findall(r"\d{1,2}[/-]\d{1,2}[/-]\d{2,4}", value)
    if len(dates) < 2:
        return False

    start, end = dates[0], dates[-1]

    for run in paragraph.runs:
        if "from" in run.text.lower() and "to" in run.text.lower():
            run.text = _re.sub(
                r"from(\s+)to",
                f"From {start} to {end}",
                run.text,
                count=1,
                flags=_re.IGNORECASE,
            )
            return True

    return False


def _write_into_last_blank_paragraph(cell, value: str) -> None:
    """Write into the LAST empty paragraph in the cell (closest to
    the cell/row's bottom edge) instead of the first.

    FIX: used for Form 2's "Student's name:" field — that cell has 3
    paragraphs (label + 2 blanks), and the table's SECOND row (a
    separate, entirely empty <w:tr> right below) has its own default
    border, visually reading as an underline/signature line. Writing
    into the FIRST blank paragraph (right after the label) — the old
    generic behavior — left a visible gap between the name and that
    line below it, confirmed on a real filled form ("tên nổi lơ
    lửng"). Writing into the LAST blank paragraph instead sits the
    name right next to that line, matching the expected "name
    written right above the signature line" look, without deleting
    or restructuring the actual empty table row (safer than removing
    table structure under time pressure).
    """
    empty_paragraphs = [p for p in cell.paragraphs if not p.text.strip()]
    if empty_paragraphs:
        empty_paragraphs[-1].add_run(value)
    else:
        cell.add_paragraph(value)


def _fill_hours_placeholder(paragraph, value: str) -> bool:
    """Insert the actual hours value right before the "(hours per
    week/month)" unit hint, e.g. becomes "40 giờ/tuần (hours per
    week/month)" instead of appending as a stray line below. Returns
    False (caller falls back to the old append behavior) if the hint
    text isn't found — fail safe rather than guessing.

    FIX: also resets the paragraph's alignment to LEFT. The template
    sets this specific paragraph's alignment to RIGHT (confirmed by
    inspecting the real template's paragraph properties) — harmless
    when the cell only contained the short static hint text, but once
    real content is inserted, right-alignment visibly pushes it
    toward the far side of the cell, looking noticeably off.
    """
    for run in paragraph.runs:
        if "hours per week" in run.text.lower():
            run.text = f"{value} {run.text}"
            paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
            return True

    return False


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

        # FIX: fields living in a standalone paragraph OUTSIDE any
        # table (e.g. Form 1's "Full name" under "Commitment from
        # Student") — check this BEFORE the table-cell path below,
        # since such fields have table_index=-1 by convention (no
        # table cell mapping) but paragraph_index set instead.
        if f.paragraph_index >= 0:
            try:
                paragraph = document.paragraphs[f.paragraph_index]
                _write_into_paragraph(paragraph, value)
            except IndexError as exc:
                logger.warning(
                    "Could not write field '%s' for %s at paragraph_index=%d: %s",
                    f.name, form_code, f.paragraph_index, exc,
                )
            continue

        if f.table_index < 0 or f.col_index < 0:
            # Field with no direct table cell mapping (e.g. Form 4.3's
            # checkbox-style "resources_used", or fields whose real
            # template location doesn't match a simple single-cell
            # schema — see form_tool.py's Form 4.3 note) — intentionally
            # skipped rather than guessing a location. FIX: col_index<0
            # must ALSO skip, not just table_index<0 — Python silently
            # treats a negative col_index as "count from the end"
            # (row.cells[-1] = LAST cell), which previously caused
            # overall_experience_notes (col_index=-1) to overwrite the
            # rating-scale header cell "5" instead of being skipped.
            continue

        try:
            table = document.tables[f.table_index]
            row = table.rows[f.row_index]
            cell = row.cells[f.col_index]
            if f.name == "internship_details":
                # FIX: this cell has 4 DISTINCT sub-sections in the
                # real template (Project Description / Benefit /
                # Skills / Qualifications) — the generic
                # "first-empty-paragraph" write used for every other
                # field would dump the WHOLE combined answer into just
                # the first blank (under "Description of Proposed..."),
                # leaving the other 3 sub-sections empty even when the
                # student/JD clearly provided that info. Confirmed on
                # a real filled form. Distribute into the correct
                # sub-section instead — see
                # _distribute_internship_details.
                _distribute_internship_details(cell, value)
            elif f.name == "internship_time":
                # FIX: same class of issue — the cell already has a
                # "From ... to" template hint (not a blank), so the
                # old generic write appended the date range as a
                # stray line below it instead of filling the actual
                # blank between "From" and "to". Falls back to the
                # old append behavior if the value doesn't contain 2
                # parseable dates.
                if not _fill_date_range_placeholder(cell.paragraphs[0], value):
                    _write_into_cell(cell, value, field_name=f.name)
            elif f.name == "internship_hours":
                # FIX: same class of issue — "(hours per week/month)"
                # is a unit hint already occupying the cell, not a
                # blank; insert the number right before the hint
                # instead of appending a stray line below it.
                if not _fill_hours_placeholder(cell.paragraphs[0], value):
                    _write_into_cell(cell, value, field_name=f.name)
            elif f.name == "student_name_printed":
                # FIX: write into the LAST blank paragraph, not the
                # first — see _write_into_last_blank_paragraph's
                # docstring for why (visible "signature line" is a
                # separate empty table row's border right below this
                # cell; writing into the first blank left an
                # unwanted gap between the name and that line).
                _write_into_last_blank_paragraph(cell, value)
            else:
                _write_into_cell(cell, value, field_name=f.name)
        except (IndexError, AttributeError) as exc:
            logger.warning(
                "Could not write field '%s' for %s at (table=%d, row=%d, col=%d): %s",
                f.name, form_code, f.table_index, f.row_index, f.col_index, exc,
            )
            continue

    if form_code == "Form 4.3":
        _fill_form_4_3_evaluation_section(document, field_values)

    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def _tick_single_paragraph_checkbox(paragraph, option_keyword: str) -> bool:
    options = _find_checkbox_options_in_paragraph(paragraph)
    for opt in options:
        if option_keyword.lower() in opt["label_text"].lower():
            opt["checked_elem"].set(f"{_W14_NS}val", "1")
            opt["t_elem"].text = opt["checked_char"]
            return True
    return False


def _fill_form_4_3_evaluation_section(document, field_values: dict[str, str | None]) -> None:
    """Fill all evaluation checkboxes, Likert table, and feedback comments for Form 4.3."""
    paragraphs = document.paragraphs

    # 1. Resources Used (Paragraphs 92, 94, 96)
    res_text = (field_values.get("resources_used") or "").lower()
    ticked_any = False
    if len(paragraphs) > 96:
        if "career" in res_text:
            _tick_single_paragraph_checkbox(paragraphs[92], "Career Services")
            ticked_any = True
        if any(w in res_text for w in ["faculty", "giang vien", "thay", "co"]):
            _tick_single_paragraph_checkbox(paragraphs[92], "Faculty")
            ticked_any = True
        if any(w in res_text for w in ["family", "friend", "ban", "gia dinh"]):
            _tick_single_paragraph_checkbox(paragraphs[92], "Family")
            ticked_any = True
        if any(w in res_text for w in ["employer", "cu"]):
            _tick_single_paragraph_checkbox(paragraphs[94], "Previous")
            ticked_any = True
        internet_keywords = ["internet", "mang", "web", "online", "linkedin", "topcv", "itviec", "vietnamworks", "google", "facebook"]
        if any(w in res_text for w in internet_keywords):
            _tick_single_paragraph_checkbox(paragraphs[94], "Internet")
            ticked_any = True
            # Fill website name into underline if mentioned or default to LinkedIn / Job Portals
            site_name = "LinkedIn / Online Job Portals"
            for site in ["linkedin", "topcv", "itviec", "vietnamworks", "google", "facebook"]:
                if site in res_text:
                    site_name = site.capitalize() if site not in ("topcv", "itviec") else site.upper()
                    break
            p94 = paragraphs[94]
            for r in p94.runs:
                if "_" in r.text:
                    r.text = f": {site_name}"
                    break
        if any(w in res_text for w in ["other", "khac"]):
            _tick_single_paragraph_checkbox(paragraphs[96], "Other")
            ticked_any = True
        if not ticked_any:
            # Default realistic selection for university students
            _tick_single_paragraph_checkbox(paragraphs[92], "Career Services")
            _tick_single_paragraph_checkbox(paragraphs[94], "Internet")
            p94 = paragraphs[94]
            for r in p94.runs:
                if "___" in r.text:
                    r.text = ": LinkedIn / Online Job Portals"
                    break

    # 2. Likert Table 5 (17 evaluation statements)
    score_raw = str(field_values.get("likert_score") or field_values.get("overall_rating") or "")
    score = 5
    digit_match = _re.search(r"[1-5]", score_raw)
    if digit_match:
        score = int(digit_match.group(0))
    elif "good" in score_raw.lower() or "kha" in score_raw.lower():
        score = 4
    elif "average" in score_raw.lower() or "trung binh" in score_raw.lower():
        score = 3
    elif "below" in score_raw.lower() or "yeu" in score_raw.lower():
        score = 2
    elif "poor" in score_raw.lower() or "kem" in score_raw.lower():
        score = 1

    try:
        fill_likert_table(document, [score] * 11, [score] * 6)
    except Exception as exc:
        logger.warning("Could not fill Form 4.3 Likert table: %s", exc)

    # 3. Overall rating (Paragraphs 103-107)
    overall_val = (field_values.get("overall_rating") or "").lower()
    if len(paragraphs) > 107:
        if any(w in overall_val for w in ["poor", "kem", "1"]):
            _tick_single_paragraph_checkbox(paragraphs[107], "Poor")
        elif any(w in overall_val for w in ["below", "yeu", "2"]):
            _tick_single_paragraph_checkbox(paragraphs[106], "Below")
        elif any(w in overall_val for w in ["average", "trung binh", "3"]):
            _tick_single_paragraph_checkbox(paragraphs[105], "Average")
        elif any(w in overall_val for w in ["good", "kha", "4"]):
            _tick_single_paragraph_checkbox(paragraphs[104], "Good")
        else:
            _tick_single_paragraph_checkbox(paragraphs[103], "Excellent")

    # Overall comments — clean formatting replacing dotted lines
    overall_notes = field_values.get("overall_comments") or field_values.get("overall_experience_notes")
    if overall_notes and len(paragraphs) > 109:
        paragraphs[109].text = f"Additional Comments (if any): {overall_notes.strip()}"
        if len(paragraphs) > 111:
            paragraphs[111].text = ""

    # 4. Would recommend (Paragraphs 114-117)
    rec_val = (field_values.get("would_recommend") or "").lower()
    if len(paragraphs) > 117:
        if any(w in rec_val for w in ["not recommend", "khong gioi thieu", "khong nen"]):
            _tick_single_paragraph_checkbox(paragraphs[117], "Would not")
        elif any(w in rec_val for w in ["reservations", "can nhac"]):
            _tick_single_paragraph_checkbox(paragraphs[116], "reservations")
        elif any(w in rec_val for w in ["highly", "rat"]):
            _tick_single_paragraph_checkbox(paragraphs[114], "Highly")
        else:
            _tick_single_paragraph_checkbox(paragraphs[114], "Highly")

    # Recommend comments — clean formatting replacing dotted lines
    rec_notes = field_values.get("recommend_comments")
    if rec_notes and len(paragraphs) > 119:
        paragraphs[119].text = f"Additional Comments (if any): {rec_notes.strip()}"
        if len(paragraphs) > 121:
            paragraphs[121].text = ""

    # 5. Suggestions to improve (Paragraph 124)
    sug_notes = field_values.get("suggestions_to_improve")
    if sug_notes and len(paragraphs) > 124:
        paragraphs[124].text = sug_notes.strip()
        if len(paragraphs) > 125:
            paragraphs[125].text = ""


_LIKERT_GROUP1_ROWS = list(range(1, 12))   # 11 câu tổng quan
_LIKERT_GROUP2_ROWS = list(range(13, 19))  # 6 câu kỹ năng


def fill_likert_table(
    document, group1_ratings: list[int], group2_ratings: list[int],
) -> None:
    """Mark the Likert self-evaluation table (Form 4.3, table index 5)
    with "X" in the correct rating column (1-5) for each of the 17
    statements.

    FIX: confirmed by reading the real template's raw structure — this
    table has NO checkbox controls at all (0 <w:sdt> elements in any
    rating cell), just 5 genuinely blank columns per row (one per
    rating 1-5). Marking is simply: write "X" into
    row.cells[rating] for the matching statement row, leaving the
    other 4 rating columns for that row untouched/empty.

    group1_ratings must have exactly 11 values (rows 1-11 — the
    general experience statements); group2_ratings must have exactly
    6 values (rows 13-18 — the skills-developed statements, row 12 is
    a sub-header with no rating columns of its own). Each value must
    be an integer 1-5 — raises ValueError otherwise rather than
    silently marking the wrong column or doing nothing.
    """
    if len(group1_ratings) != len(_LIKERT_GROUP1_ROWS):
        raise ValueError(
            f"group1_ratings phải có đúng {len(_LIKERT_GROUP1_ROWS)} giá trị, "
            f"nhận được {len(group1_ratings)}"
        )
    if len(group2_ratings) != len(_LIKERT_GROUP2_ROWS):
        raise ValueError(
            f"group2_ratings phải có đúng {len(_LIKERT_GROUP2_ROWS)} giá trị, "
            f"nhận được {len(group2_ratings)}"
        )

    table5 = document.tables[5]

    for row_idx, rating in zip(_LIKERT_GROUP1_ROWS, group1_ratings):
        _mark_likert_cell(table5, row_idx, rating)

    for row_idx, rating in zip(_LIKERT_GROUP2_ROWS, group2_ratings):
        _mark_likert_cell(table5, row_idx, rating)


def _mark_likert_cell(table, row_idx: int, rating: int) -> None:
    if not isinstance(rating, int) or not (1 <= rating <= 5):
        raise ValueError(f"Rating phải là số nguyên 1-5, nhận được: {rating!r}")

    cell = table.rows[row_idx].cells[rating]
    paragraph = cell.paragraphs[0] if cell.paragraphs else cell.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.add_run("X")


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