# Workflow Sửa Lỗi Sau Demo

Tài liệu này mô tả workflow cải thiện chất lượng sản phẩm cho Internship RAG Chatbot sau khi đã hoàn thành workflow ban đầu 14 mốc.

14 mốc ban đầu được xem là đã hoàn thành. Giai đoạn này chỉ tập trung sửa các vấn đề phát hiện sau demo, không làm lại RAG core nếu không thật sự cần thiết.

## Nguyên Tắc Bắt Buộc

- Không build lại hoặc viết lại RAG core nếu không có regression chứng minh là cần.
- Không làm yếu retrieval, Evidence Gate, Groundedness Checker hoặc citation validation.
- Không cho model tự tạo `quote_original`.
- Không phá contract response của `/api/v1/chat`.
- Không expose đường dẫn file nội bộ ra frontend.
- Không sửa cơ chế `.ai-log`.
- Sau mỗi mốc sửa lỗi, toàn bộ test hiện có vẫn phải pass.

Lệnh test baseline:

```powershell
python -m pytest tests eval\test_rag_router.py eval\test_rag_evidence.py eval\test_rag_answer_generator.py eval\test_rag_groundedness.py eval\test_rag_graph_workflow.py eval\test_rag_agent.py -p no:cacheprovider
```

Kết quả baseline hiện tại mong đợi:

```text
54 passed
```

## F0: Lưu Baseline Trước Khi Sửa

### Mục đích

Trước khi thay đổi behavior, cần lưu trạng thái evaluation hiện tại. Việc này giúp so sánh trước/sau và tránh trường hợp sửa UX nhưng vô tình làm giảm chất lượng RAG.

### Việc cần làm

1. Chạy gold evaluation hiện tại:

   ```powershell
   python -m pytest eval\test_rag_agent.py -p no:cacheprovider
   ```

2. Copy file report được sinh ra:

   ```text
   eval/evaluation_report.json
   ```

   thành:

   ```text
   eval/evaluation_report_before_fix.json
   ```

3. Ghi lại các metric baseline:

   ```text
   answer_accuracy
   not_found_precision
   hallucination_rate_not_found
   citation_validity
   source_scope_validity
   ```

### File có thể thay đổi

```text
eval/evaluation_report_before_fix.json
eval/evaluation_comparison.md
```

### Điều kiện hoàn thành

- Có file `evaluation_report_before_fix.json`.
- Các metric baseline được ghi lại rõ ràng.
- F0 không sửa production code.

## F1: Cải Thiện Hiểu Ý Định Hội Thoại

### Vấn đề

Small talk và các câu hỏi về chính chatbot hiện đang bị xử lý như câu hỏi RAG, sau đó trả `not_found`.

Ví dụ small talk:

```text
hello
hi
xin chào
chào bạn
cảm ơn
thanks
bạn là ai
bạn có thể giúp gì
chatbot này làm gì
```

Ví dụ out-of-scope:

```text
thời tiết
bóng đá
nấu ăn
chính trị
```

### Flow mong muốn

Dùng 2 lớp phân loại:

```text
User
-> normalize
-> quick intent rule
   -> small_talk -> friendly_response
   -> known out_of_scope -> standard_refusal
   -> else -> LLM intent classifier fallback
            -> small_talk / out_of_scope / RAG intent
```

### Ghi chú thiết kế

- Layer 1 là rule-based, rẻ và nhanh.
- Layer 2 là LLM classifier fallback, chỉ dùng cho query mơ hồ.
- LLM classifier chỉ được trả intent có cấu trúc, không được trả answer.
- Nếu LLM classifier lỗi hoặc timeout:
  - query có dấu hiệu internship -> đi tiếp RAG pipeline hiện tại
  - query không liên quan -> `out_of_scope`

### Kế hoạch thực hiện

1. Mở rộng intent schema với:

   ```text
   small_talk
   ```

2. Thêm quick-rule classifier cho:

   ```text
   hello, hi, hey, xin chào, chào bạn, cảm ơn, thanks,
   bạn là ai, bạn có thể giúp gì, chatbot này làm gì
   ```

3. Thêm quick-rule out-of-scope cho:

   ```text
   thời tiết, bóng đá, nấu ăn, chính trị
   ```

4. Thêm LLM intent-classifier fallback.

   Input:

   ```text
   normalized_query
   candidate intents
   brief definitions
   ```

   Output:

   ```json
   {
     "intent": "small_talk | out_of_scope | internship_duration | ...",
     "confidence": "high | medium | low"
   }
   ```

   Lưu ý: không dùng confidence này làm confidence của answer cuối.

5. Thêm node `friendly_response` trước retrieval.
6. Đảm bảo `small_talk` bỏ qua:

   ```text
   retrieval
   evidence_gate
   answer_generator
   groundedness_checker
   ```

### File cần sửa

```text
src/rag/router.py
src/rag/prompts.py
src/agents/nodes/rag_nodes.py
src/agents/graph.py
src/agents/state.py
src/rag/schemas.py
eval/test_rag_router.py
eval/test_rag_graph_workflow.py
```

### Test cần thêm

```text
eval/test_post_demo_small_talk.py
```

Các case bắt buộc:

- `hello` -> `small_talk`, trả lời thân thiện, `sources=[]`
- `xin chào` -> `small_talk`, trả lời thân thiện, `sources=[]`
- `cảm ơn` -> `small_talk`, trả lời thân thiện, `sources=[]`
- `bạn là ai` -> `small_talk`, giải thích vai trò chatbot, `sources=[]`
- `chatbot này làm gì` -> `small_talk`, giải thích khả năng, `sources=[]`
- thời tiết / bóng đá / nấu ăn / chính trị -> `out_of_scope`, từ chối gọn, `sources=[]`
- câu hỏi internship -> giữ behavior RAG hiện tại

### Điều kiện hoàn thành

- Small talk không còn trả `not_found`.
- Small talk không gọi retrieval.
- Out-of-scope vẫn gọn và không có source.
- Các intent RAG hiện có không bị đổi behavior.

## F2: Sinh Câu Trả Lời Tiếng Việt Có Grounding

### Vấn đề

Chất lượng câu trả lời tiếng Việt hiện chưa tốt:

- thiếu dấu tiếng Việt
- raw English evidence bị đưa thẳng ra answer chính
- answer giống dump quote hơn là giải thích tự nhiên

### Điều chỉnh quan trọng

Không dùng template hard-code kiểu:

```text
240 hours -> fixed answer
2.0 GPA -> fixed answer
```

Cách đó sẽ biến hệ thống thành rule-based chatbot và không scale khi tài liệu mở rộng.

### Kiến trúc mong muốn

Dùng grounded Vietnamese answer synthesis:

```text
Retrieved evidence
-> Evidence Gate pass
-> LLM Vietnamese synthesis
-> Groundedness Checker
-> final answer
```

LLM chỉ nhận verified evidence và phải trả lời bằng tiếng Việt.

### Yêu cầu prompt

System prompt:

```text
Bạn là trợ lý tiếng Việt.
Chỉ giải thích dựa trên evidence được cung cấp.
Không thêm thông tin ngoài evidence.
Không tự tạo ngày, email, số liệu, tên form.
Không tạo quote_original.
Trả lời tự nhiên, ngắn gọn, có dấu tiếng Việt.
```

Input:

```text
User query
Verified evidence quote_original
Allowed source scope
Required facts from Evidence Gate
```

Output:

```json
{
  "answer": "Sinh viên cần hoàn thành tối thiểu 240 giờ thực tập.",
  "used_chunk_ids": ["..."]
}
```

Backend vẫn tự build citation từ chunk. Model không bao giờ được tạo `quote_original`.

### Fallback khi lỗi

Nếu LLM synthesis lỗi hoặc timeout:

- không trả draft answer chưa kiểm tra
- trả `insufficient_evidence`
- `confidence = 0.0`
- `sources = []`

### Kiểm tra độ dễ đọc tiếng Việt

Test không chỉ kiểm tra fact, mà phải phát hiện câu tiếng Việt không dấu.

Các chuỗi xấu không được xuất hiện:

```text
sinh vien
thuc tap
can hoan thanh
khong tim thay
```

Các chuỗi tốt cần xuất hiện khi phù hợp:

```text
sinh viên
thực tập
cần hoàn thành
không tìm thấy
```

### File cần sửa

```text
src/rag/answer_generator.py
src/rag/prompts.py
src/rag/groundedness.py
eval/test_rag_answer_generator.py
eval/test_rag_groundedness.py
eval/test_rag_agent.py
eval/rag_tests.json
```

### Test cần thêm

```text
eval/test_post_demo_vietnamese_answer.py
```

Các case bắt buộc:

- Answer tiếng Việt có dấu.
- Answer không expose raw English chunk làm câu trả lời chính.
- Các chuỗi không dấu xấu bị reject.
- `quote_original` không bị thay đổi.
- Required facts vẫn xuất hiện trong answer.
- Số/ngày/email/tên form không được support vẫn bị Groundedness Checker bắt lỗi.

### Điều kiện hoàn thành

- Answer tiếng Việt tự nhiên và dễ đọc.
- `quote_original` vẫn giữ nguyên.
- Không tăng hallucination.
- Gold evaluation vẫn pass.

## F3: Thiết Kế Lại Citation Backend Và Document Service

### Vấn đề

Source response hiện còn raw metadata và chưa có link tài liệu an toàn.

Không được expose trực tiếp path như:

```text
/Data/...
```

### Thiết kế backend mong muốn

Thêm Document Service:

```text
chunk.metadata.document_id
-> document_registry.json
-> safe document URL
```

Ví dụ registry:

```json
{
  "internship_policy_2025": {
    "title": "Internship Policy",
    "path": "Data/POL-CAID-001-V2.0_Internship-Management-Policy_15.10.2025.pdf"
  },
  "form_3_grievance": {
    "title": "Statement of Internship Grievance",
    "path": "Data/Form-3-Statement-of-Internship-Grievance.docx"
  }
}
```

Public API URL:

```text
/api/v1/documents/{document_id}
```

Source response:

```json
{
  "title": "Internship Policy",
  "url": "/api/v1/documents/internship_policy_2025",
  "page": 3,
  "quote_original": "Students must complete 240 hours."
}
```

### Yêu cầu bảo mật

- Chỉ serve document ID có trong registry.
- Không nhận arbitrary file path từ user.
- Unknown document ID trả 404.
- Chặn path traversal.
- Giữ nguyên validation của `quote_original`.

### Kế hoạch thực hiện

1. Thêm document registry:

   ```text
   src/rag/document_registry.json
   ```

2. Thêm document service:

   ```text
   src/rag/document_service.py
   ```

3. Map `document_name` từ chunk sang `document_id`.
4. Mở rộng `SourceCitation` với:

   ```text
   title
   url
   page
   quote_original
   chunk_id
   document_name
   document_type
   section
   ```

5. Thêm API route:

   ```text
   GET /api/v1/documents/{document_id}
   ```

6. Giữ backward-compatible fields nếu API/test hiện tại cần.

### File cần sửa

```text
src/rag/citations.py
src/rag/document_service.py
src/rag/document_registry.json
src/models/schemas.py
src/api/routes.py
tests/test_api/test_routes.py
eval/test_rag_answer_generator.py
eval/test_rag_agent.py
```

### Test cần thêm

```text
eval/test_post_demo_citations.py
```

Các case bắt buộc:

- Source có `title`.
- Source có `url` an toàn.
- URL bắt đầu bằng `/api/v1/documents/`.
- Document ID hợp lệ trả file response.
- Document ID không tồn tại trả 404.
- Path traversal trả 404 hoặc 422.
- Quote vẫn là substring trực tiếp của retrieved chunk.

### Điều kiện hoàn thành

- Citation thân thiện với người dùng.
- Link tài liệu hoạt động an toàn.
- Không expose raw filesystem path.

## F4: Cải Thiện Frontend Citation Và Trạng Thái Runtime

### Vấn đề

Frontend hiện chủ yếu tập trung hiển thị source. Khi demo thật, cần trạng thái loading/error rõ hơn.

### UX mong muốn

```text
User gửi message
-> loading indicator
-> answer
-> source cards dưới answer nếu answered
```

### Yêu cầu

1. Giữ layout giống ChatGPT.
2. Đưa source card xuống dưới assistant answer.
3. Hiển thị:

   ```text
   Nguồn tham khảo
   Internship Policy
   Xem tài liệu
   ```

4. Dùng `source.url` cho link clickable.
5. Ẩn raw document metadata mặc định.
6. Không hiển thị source card cho:

   ```text
   not_found
   insufficient_evidence
   out_of_scope
   small_talk
   ```

7. Thêm loading state:

   ```text
   Đang suy nghĩ...
   ```

8. Thêm network/API timeout error:

   ```text
   Không thể kết nối tới máy chủ. Vui lòng thử lại.
   ```

9. Không bao giờ hiển thị:

   ```text
   500 Internal Server Error
   stack trace
   raw exception text
   ```

### File cần sửa

```text
frontend/index.html
tests/test_frontend/test_static_frontend.py
tests/test_frontend/test_citation_experience.py
```

### Test cần thêm

```text
tests/test_frontend/test_citation_experience.py
```

Các case bắt buộc:

- Frontend vẫn gọi `/api/v1/chat`.
- Frontend đọc `result.sources`.
- Source card có `Nguồn tham khảo`.
- Source card có `Xem tài liệu`.
- Source card dùng `source.url`.
- Frontend có network error message.
- Frontend có loading indicator.
- Đường `not_found` không render source card.

### Điều kiện hoàn thành

- UI dễ demo hơn.
- Source dễ đọc và click được.
- Error state sạch, không lộ lỗi kỹ thuật.

## F5: Full Regression Và Evaluation Sau Khi Sửa

### Mục đích

Chứng minh các cải thiện UX không làm giảm chất lượng RAG.

### Việc cần làm

1. Chạy toàn bộ test cũ:

   ```powershell
   python -m pytest tests eval\test_rag_router.py eval\test_rag_evidence.py eval\test_rag_answer_generator.py eval\test_rag_groundedness.py eval\test_rag_graph_workflow.py eval\test_rag_agent.py -p no:cacheprovider
   ```

2. Chạy toàn bộ test post-demo mới:

   ```powershell
   python -m pytest eval\test_post_demo_small_talk.py eval\test_post_demo_vietnamese_answer.py eval\test_post_demo_citations.py tests\test_frontend\test_citation_experience.py -p no:cacheprovider
   ```

3. Chạy gold answer evaluation:

   ```powershell
   python -m pytest eval\test_rag_agent.py -p no:cacheprovider
   ```

4. Lưu report sau sửa:

   ```text
   eval/evaluation_report_after_fix.json
   ```

5. Tạo comparison report:

   ```text
   eval/evaluation_comparison.md
   ```

### Bảng so sánh

```text
Metric                      Before     After
Answer accuracy
Not found precision
Hallucination rate
Citation validity
Source scope validity
Small talk success
Vietnamese readability
Document link validity
```

### Điều kiện hoàn thành

- RAG accuracy hiện có không giảm.
- Hallucination không tăng.
- `not_found` vẫn có `sources=[]`.
- Small talk không còn trả `not_found`.
- Answer tiếng Việt dễ đọc.
- Source click được.
- Toàn bộ test pass.

## F6: Checklist Demo Thủ Công

### Chạy app

```powershell
python -m uvicorn src.main:app --reload --port 8000
```

Mở:

```text
http://127.0.0.1:8000/
```

### Câu hỏi manual

Small talk:

```text
hello
xin chào
cảm ơn
bạn là ai
chatbot này làm gì
```

Mong đợi:

- trả lời thân thiện
- không có source
- không trả kiểu refusal của retrieval

Grounded RAG:

```text
Sinh viên cần thực tập bao nhiêu giờ?
Điều kiện GPA để thực tập là gì?
Khiếu nại thực tập dùng form nào?
```

Mong đợi:

- answer tiếng Việt có dấu
- source card nằm dưới answer
- link tài liệu click được
- quote vẫn verify được nội bộ

Not found:

```text
Deadline nộp hồ sơ thực tập tháng 8/2026 là ngày nào?
Email cá nhân của faculty mentor là gì?
```

Mong đợi:

- từ chối gọn
- không bịa ngày/email
- không có source

Out of scope:

```text
Thời tiết hôm nay thế nào?
Bóng đá tối nay có trận gì?
```

Mong đợi:

- trả lời out-of-scope gọn
- không có source
- không hiện evidence retrieval

## Điểm Dừng

Sau khi workflow này được chấp nhận, bắt đầu triển khai bằng:

```text
bắt đầu F0
```

Sau đó tiếp tục từng mốc:

```text
bắt đầu F1
bắt đầu F2
...
```

Không triển khai tất cả các fix trong một lần trừ khi được yêu cầu rõ ràng.
