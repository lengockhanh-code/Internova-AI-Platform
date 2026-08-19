from __future__ import annotations

from io import BytesIO

from docx import Document
from langchain_openai import ChatOpenAI
from pypdf import PdfReader

from src.config import get_settings
from src.models.student_reports import (
    AiReportReviewResponse,
)


settings = get_settings()


# ============================================================
# SYSTEM PROMPT
# ============================================================

SYSTEM_PROMPT = """
Bạn là Internova AI, một trợ lý hỗ trợ sinh viên tự kiểm tra
báo cáo thực tập trước khi gửi cho Faculty Mentor.

VAI TRÒ

Bạn chỉ đóng vai trò hỗ trợ.
Bạn KHÔNG phải Faculty Mentor.
Bạn KHÔNG đưa ra điểm học tập chính thức.

MỤC TIÊU

Giúp sinh viên phát hiện:

- Nội dung đã làm tốt.
- Nội dung còn thiếu.
- Nội dung quá chung chung.
- Phần cần giải thích rõ hơn.
- Những thay đổi sinh viên có thể tự thực hiện để cải thiện báo cáo.

NGUYÊN TẮC BẮT BUỘC

1. Không bịa thông tin.

2. Không suy đoán sinh viên đã thực hiện công việc mà báo cáo
   không đề cập.

3. Không tạo thành tích, số liệu, công nghệ, kết quả hoặc
   kinh nghiệm không tồn tại trong nội dung.

4. Không tự viết lại toàn bộ báo cáo thay sinh viên.

5. Chỉ đánh giá dựa trên nội dung sinh viên cung cấp.

6. completeness_score chỉ là MỨC ĐỘ HOÀN THIỆN của báo cáo
   để hỗ trợ sinh viên.

7. completeness_score KHÔNG phải:
   - lecturer_score
   - course grade
   - internship grade
   - kết quả chính thức.

8. Faculty Mentor vẫn là người đánh giá chính thức.

CÁC TIÊU CHÍ REVIEW CHUNG

- Mục tiêu hoặc bối cảnh công việc.
- Công việc/nhiệm vụ đã thực hiện.
- Kết quả đạt được.
- Kiến thức hoặc kỹ năng học được.
- Khó khăn/vấn đề gặp phải.
- Cách sinh viên xử lý vấn đề.
- Mức độ cụ thể của nội dung.
- Logic trình bày.
- Tính chuyên nghiệp.
- Khả năng tự phản ánh.

ĐỐI VỚI WEEKLY

Tập trung vào:

- Công việc trong tuần.
- Kết quả.
- Khó khăn.
- Điều học được.
- Kế hoạch tiếp theo.

Không tuyên bố Weekly Report là yêu cầu bắt buộc của
VinUniversity policy.

ĐỐI VỚI MIDTERM

Tập trung vào:

- Tiến độ internship.
- Công việc đã hoàn thành.
- Kết quả hiện tại.
- Khó khăn.
- Kỹ năng đã phát triển.
- Kế hoạch cho giai đoạn tiếp theo.

ĐỐI VỚI FINAL

Tập trung vào:

- Tổng kết internship.
- Mục tiêu.
- Công việc đã thực hiện.
- Kết quả.
- Kỹ năng/kiến thức.
- Khó khăn.
- Bài học.
- Giá trị của trải nghiệm internship.

ĐỐI VỚI REFLECTION

Tập trung vào:

- Learning outcomes.
- Điều sinh viên học được.
- Sự thay đổi về kỹ năng.
- Sự phát triển nghề nghiệp.
- Sự phát triển cá nhân.
- Những điều sinh viên sẽ làm khác trong tương lai.

OUTPUT

Trả về đúng cấu trúc:

- completeness_score
- summary
- strengths
- issues
- suggestions

strengths phải cụ thể.
issues phải dựa vào nội dung thật.
suggestions phải là hành động sinh viên có thể tự thực hiện.
""".strip()


# ============================================================
# EXTRACT PDF / DOCX
# ============================================================

def extract_report_text(
    file_data: bytes,
    mime_type: str,
) -> str:

    # --------------------------------------------------------
    # PDF
    # --------------------------------------------------------

    if mime_type == "application/pdf":

        reader = PdfReader(
            BytesIO(file_data)
        )

        pages: list[str] = []

        for page in reader.pages:

            page_text = (
                page.extract_text()
                or ""
            ).strip()

            if page_text:
                pages.append(
                    page_text
                )

        return "\n\n".join(
            pages
        )


    # --------------------------------------------------------
    # DOCX
    # --------------------------------------------------------

    docx_mime = (
        "application/"
        "vnd.openxmlformats-officedocument."
        "wordprocessingml.document"
    )


    if mime_type == docx_mime:

        document = Document(
            BytesIO(file_data)
        )

        paragraphs = [
            paragraph.text.strip()

            for paragraph
            in document.paragraphs

            if paragraph.text.strip()
        ]

        return "\n".join(
            paragraphs
        )


    raise ValueError(
        "AI Review hiện chỉ hỗ trợ PDF và DOCX."
    )


# ============================================================
# AI REVIEW
# ============================================================

def review_report_with_ai(
    report_type: str,
    content: str,
) -> AiReportReviewResponse:

    cleaned_content = (
        content.strip()
    )


    if (
        len(cleaned_content)
        < 50
    ):
        raise ValueError(
            "Nội dung báo cáo quá ngắn để AI Review."
        )


    llm = ChatOpenAI(
        api_key=
            settings.openai_api_key,

        model=
            settings.openai_chat_model,

        temperature=0,
    )


    structured_llm = (
        llm.with_structured_output(
            AiReportReviewResponse
        )
    )


    result = structured_llm.invoke(
        [
            (
                "system",
                SYSTEM_PROMPT,
            ),

            (
                "human",
                (
                    "LOẠI BÁO CÁO:\n"
                    f"{report_type}\n\n"

                    "NỘI DUNG SINH VIÊN:\n"
                    "====================\n"
                    f"{cleaned_content}"
                ),
            ),
        ]
    )


    return result