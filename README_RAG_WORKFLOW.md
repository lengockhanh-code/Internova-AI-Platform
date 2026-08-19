# RAG Workflow – Internship Support System

## 1. Mục tiêu

Tài liệu này mô tả quy trình xây dựng, kiểm thử và tích hợp hệ thống RAG cho hệ thống hỗ trợ thực tập.

Quy trình được chia thành 14 mốc độc lập. Mỗi mốc phải được hoàn thành, kiểm tra và báo cáo trước khi chuyển sang mốc tiếp theo.

Các nguyên tắc chung:

- Không build frontend trước khi backend vượt qua toàn bộ kiểm thử bắt buộc.
- Không sinh câu trả lời khi chưa có đủ bằng chứng trực tiếp.
- Không để một tài liệu lỗi làm dừng toàn bộ pipeline.
- Không sử dụng kiến thức ngoài tài liệu để suy ra quy định.
- Không lưu API key, `.env` hoặc thông tin nhạy cảm vào Git.
- Không sửa, xóa hoặc bỏ qua thư mục `.ai-log`.
- Sau mỗi mốc phải báo cáo đầy đủ file đã sửa, lệnh đã chạy, kết quả và lỗi còn tồn tại.

---

# Mốc 1: Document Extraction

## Mục tiêu

Đọc được đầy đủ 7 tài liệu trong thư mục `Data/`.

Ở mốc này:

- Chưa chunk dữ liệu.
- Chưa tạo embedding.
- Chưa build index.

## File dự kiến

```text
src/rag/__init__.py
src/rag/config.py
src/rag/document_loader.py
scripts/inspect_rag_documents.py
```

## Output

```text
data/rag/extraction_report.json
```

## Yêu cầu thực hiện

### PDF

- Đọc theo từng trang.
- Giữ nguyên thứ tự trang.
- Ghi nhận các trang rỗng.
- Nếu một trang không đọc được, ghi lỗi nhưng tiếp tục xử lý tài liệu.

### DOCX

Đọc các thành phần:

- Paragraph.
- Table.
- Heading.
- Các phần tử theo đúng thứ tự xuất hiện nếu có thể.

### Metadata bắt buộc

Mỗi phần tử được trích xuất cần có:

```text
document_name
document_type
page
element_type
```

Có thể bổ sung:

```text
element_index
heading_level
table_index
row_index
error
is_empty
```

## Xử lý lỗi

- Một file lỗi không được làm crash toàn bộ pipeline.
- Lỗi phải được ghi vào report.
- Report phải thể hiện rõ file nào thành công, file nào thất bại.
- Trang rỗng phải được ghi nhận.
- File không hỗ trợ phải được đánh dấu rõ.

## Kiểm tra thủ công bắt buộc

Phải kiểm tra sự xuất hiện của các cụm:

```text
240 hours
2.0 overall GPA
Statement of Internship Grievance
Withdrawal
Evaluation
```

## Điều kiện hoàn thành

- Đọc đủ 7 tài liệu.
- Có `extraction_report.json`.
- Report ghi rõ:
  - Số tài liệu thành công.
  - Số tài liệu lỗi.
  - Số trang hoặc phần tử rỗng.
  - Danh sách lỗi.
  - Cụm nào tìm thấy.
  - Cụm nào không tìm thấy.
- Chưa build chunk.
- Chưa build index.

---

# Mốc 2: Chunking

## Mục tiêu

Chia nội dung tài liệu thành các chunk ổn định, có metadata đầy đủ và có thể tái tạo.

## File dự kiến

```text
src/rag/schemas.py
src/rag/chunker.py
```

## Output

```text
data/rag/chunks.jsonl
```

## Chiến lược chunk

Thứ tự ưu tiên:

1. Heading.
2. Section.
3. Page.
4. Table hoặc nhóm paragraph liên quan.
5. Fallback theo kích thước ký tự hoặc token.

Không được chỉ cắt cứng theo số ký tự nếu có thể giữ nguyên cấu trúc tài liệu.

## Nguyên tắc

- Không tách rời các bằng chứng quan trọng.
- Không tạo chunk quá nhỏ.
- Không gộp nhiều chủ đề không liên quan vào cùng một chunk.
- Giữ nội dung gốc để phục vụ citation.
- Chunk phải có thứ tự ổn định.
- Cùng một input và cùng config phải sinh cùng `chunk_id`.

## Metadata bắt buộc

```text
chunk_id
document_name
document_type
source_priority
content_original
page
section
topic
effective_date
policy_version
```

Có thể bổ sung:

```text
chunk_index
start_element
end_element
heading
content_normalized
token_count
character_count
```

## Gợi ý tạo chunk_id

Có thể tạo hash từ:

```text
document_name
document_type
page
section
content_original
chunk_index
```

Ví dụ:

```text
sha256(canonical_payload)[:16]
```

Không dùng timestamp hoặc UUID ngẫu nhiên cho `chunk_id`.

## Điều kiện hoàn thành

- Sinh được `chunks.jsonl`.
- Các cụm gold nằm trong chunk hợp lý.
- Chunk không quá vụn.
- Metadata đầy đủ.
- `chunk_id` ổn định.
- Chưa tạo embedding.

---

# Mốc 3: Query Language và Translation

## Mục tiêu

Hỗ trợ câu hỏi tiếng Việt và tiếng Anh trước khi kiểm thử retrieval hoàn chỉnh.

## File dự kiến

```text
src/rag/query_expander.py
src/rag/prompts.py
```

## Yêu cầu

- Phát hiện ngôn ngữ câu hỏi.
- Nếu câu hỏi là tiếng Việt, tạo thêm `query_en`.
- Nếu câu hỏi là tiếng Anh, giữ nguyên query gốc.
- Search queries phải có thể chứa cả tiếng Việt và tiếng Anh.
- Query expansion phải ngắn gọn.
- Không được tự thêm đáp án vào query expansion.
- Không được tự chèn các dữ kiện như:
  - `240 hours`
  - `Form 3`
  - `2.0 overall GPA`

  nếu người dùng chưa đề cập hoặc ngữ nghĩa câu hỏi không yêu cầu.

## Output gợi ý

```json
{
  "original_query": "Sinh viên cần thực tập bao nhiêu giờ?",
  "detected_language": "vi",
  "query_vi": "Sinh viên cần thực tập bao nhiêu giờ?",
  "query_en": "How many internship hours are required?",
  "search_queries": [
    "Sinh viên cần thực tập bao nhiêu giờ?",
    "How many internship hours are required?"
  ]
}
```

## Điều kiện hoàn thành

- Input tiếng Việt sinh query tiếng Anh ngắn gọn.
- Input tiếng Anh giữ được query gốc.
- Không sinh answer.
- Không tự chèn facts chưa có trong câu hỏi.

---

# Mốc 4: Indexing

## Mục tiêu

Build Chroma và BM25 an toàn, có thể rebuild mà không làm mất index cũ khi lỗi.

## File dự kiến

```text
src/rag/indexer.py
src/rag/vector_store.py
src/rag/bm25_store.py
scripts/build_rag_index.py
```

## Output

```text
data/rag/bm25.pkl
data/rag/index_manifest.json
data/chroma/
```

## Yêu cầu rebuild an toàn

Quy trình đề xuất:

1. Đọc `chunks.jsonl`.
2. Build Chroma vào thư mục tạm.
3. Build BM25 vào file tạm.
4. Kiểm tra số lượng document và chunk.
5. Kiểm tra index có thể load.
6. Chỉ khi tất cả thành công mới thay index hiện tại.
7. Nếu build lỗi, giữ nguyên index cũ.
8. Dọn thư mục tạm nếu cần.

Ví dụ thư mục tạm:

```text
data/.tmp/chroma_build/
data/.tmp/bm25_build.pkl
```

## Manifest

`index_manifest.json` nên có:

```json
{
  "build_status": "success",
  "document_count": 7,
  "chunk_count": 0,
  "embedding_model": "",
  "embedding_dimension": 0,
  "bm25_enabled": true,
  "vector_store": "chroma",
  "created_at": "",
  "chunk_file": "data/rag/chunks.jsonl"
}
```

## Quy tắc bảo mật

Không ghi vào manifest:

- API key.
- Authorization header.
- Nội dung `.env`.
- Token bí mật.
- Đường dẫn chứa thông tin nhạy cảm.

## Điều kiện hoàn thành

- Build thành công.
- Có Chroma index.
- Có BM25 index.
- Manifest có số document, số chunk và model.
- Có thể chạy rebuild nhiều lần.
- Build fail không làm mất index cũ.

---

# Mốc 5: Retrieval Test Độc Lập

## Mục tiêu

Kiểm thử retriever trước khi xây dựng answer generator.

## File dự kiến

```text
src/rag/retriever.py
scripts/test_rag_retrieval.py
```

Hoặc đặt test trong:

```text
eval/
```

## Yêu cầu retrieval

- Vector search.
- BM25 search.
- RRF merge.
- Filter source theo intent nếu có.
- Trả về top 5 chunk.

## Reciprocal Rank Fusion

Có thể dùng công thức:

```text
RRF_score(d) = Σ 1 / (k + rank_i(d))
```

Trong đó:

- `rank_i(d)` là thứ hạng của document trong từng retriever.
- `k` thường dùng giá trị ổn định như `60`.

## Test bắt buộc

Retrieval test phải bao gồm:

- Query tiếng Việt.
- Query tiếng Anh.
- Query expansion song ngữ.

## Gold retrieval

Các chunk sau phải xuất hiện trong top 5:

```text
240 hours
2.0 overall GPA
Statement of Internship Grievance
```

## Lưu ý

Test này chỉ kiểm tra:

- Chunk nào được retrieve.
- Thứ hạng chunk.
- Metadata của chunk.
- Gold chunk có nằm top 5 hay không.

Test này không kiểm tra answer.

## Điều kiện hoàn thành

- Hybrid retrieval hoạt động.
- Top 5 được trả về ổn định.
- Các gold chunk bắt buộc nằm trong top 5.
- Có báo cáo test độc lập với answer generation.

---

# Mốc 6: Intent và Source Routing

## Mục tiêu

Bảo đảm câu hỏi chỉ sử dụng đúng nhóm tài liệu được phép.

## File dự kiến

```text
src/rag/router.py
src/rag/prompts.py
```

## Danh sách intent

```text
internship_eligibility
internship_registration
internship_duration
internship_credit
internship_withdrawal
internship_dismissal
internship_grievance
internship_evaluation
student_responsibility
health_requirement
form_guidance
career_opportunity
capstone
out_of_scope
```

## Source routing rule

### Internship

Sử dụng:

- Internship policy.
- Internship guideline.
- Internship form.
- Các tài liệu trực tiếp quy định về internship.

### Career hoặc Opportunity

Chỉ sử dụng:

- Talent Handbook.

### Capstone

Chỉ sử dụng:

- Capstone Booklet.

## Quy tắc cấm

- Không dùng Talent Handbook để suy ra quy định internship.
- Không dùng Capstone Booklet để suy ra quy định internship.
- Không dùng tài liệu career để trả lời quy định học vụ.
- Không dùng tài liệu không thuộc allowed sources dù có từ khóa giống nhau.

## Output gợi ý

```json
{
  "intent": "internship_duration",
  "scope": "internship",
  "allowed_sources": ["internship_policy", "internship_guideline"],
  "blocked_sources": ["talent_handbook", "capstone_booklet"]
}
```

---

# Mốc 7: Evidence Gate

## Mục tiêu

Quyết định retrieved context có đủ bằng chứng trực tiếp để trả lời hay không.

## File dự kiến

```text
src/rag/evidence.py
```

## Quy tắc bắt buộc

### Số liệu

Số liệu phải xuất hiện trực tiếp trong chunk.

Ví dụ:

- Số giờ.
- GPA.
- Số tín chỉ.
- Số ngày.
- Số lần.

### Ngày tháng năm

Ngày, tháng hoặc năm phải xuất hiện trực tiếp trong chunk.

Không được suy diễn deadline từ:

- Năm học.
- Học kỳ.
- Tháng hiện tại.
- Ngày upload file.
- Metadata không phải nội dung quy định.

### Email

Email phải xuất hiện trực tiếp trong chunk.

Không được:

- Tự tạo email theo tên.
- Đoán domain.
- Dùng email chung thay cho email cá nhân nếu người dùng hỏi email cá nhân.

### Tên form

Tên form phải xuất hiện trực tiếp trong chunk.

Không tự suy ra tên form từ nghiệp vụ.

## Trường hợp bắt buộc trả `not_found`

- Người dùng hỏi deadline cụ thể nhưng tài liệu không có ngày cụ thể.
- Người dùng hỏi deadline tháng 8/2026 nhưng chunk không có thông tin này.
- Người dùng hỏi email cá nhân giảng viên nhưng tài liệu không có email cá nhân.
- Không có bằng chứng trực tiếp cho dữ kiện trọng tâm.

## Output gợi ý

```json
{
  "evidence_status": "sufficient",
  "reason": "Required number appears directly in retrieved chunk.",
  "used_chunk_ids": ["chunk_abc123"],
  "missing_evidence": []
}
```

Hoặc:

```json
{
  "evidence_status": "insufficient",
  "reason": "The requested deadline is not present in the allowed sources.",
  "used_chunk_ids": [],
  "missing_evidence": ["specific deadline"]
}
```

## Điều kiện hoàn thành

- Câu có evidence trực tiếp trả `sufficient`.
- Deadline tháng 8/2026 trả `not_found` hoặc `insufficient`.
- Email cá nhân giảng viên trả `not_found` hoặc `insufficient`.

---

# Mốc 8: Answer Generator và Citation

## Mục tiêu

Sinh câu trả lời tiếng Việt, đồng thời bảo đảm quote được lấy trực tiếp từ backend.

## File dự kiến

```text
src/rag/answer_generator.py
src/rag/citations.py
```

## Quy tắc answer generator

Model chỉ được sinh:

- Nội dung trả lời.
- Danh sách `used_chunk_ids` nếu thiết kế yêu cầu.
- Không được sinh quote gốc.
- Không được tự tạo citation.
- Không được tự tạo source.
- Không được dùng kiến thức ngoài context.

## Citation backend

Backend phải:

1. Nhận `used_chunk_ids`.
2. Lấy đúng chunk từ chunk store.
3. Trích `quote_original` trực tiếp từ `content_original`.
4. Kiểm tra quote thật sự tồn tại trong chunk.
5. Trả metadata nguồn.

## Source output gợi ý

```json
{
  "document_name": "Internship Policy",
  "document_type": "pdf",
  "page": 4,
  "section": "Internship Duration",
  "chunk_id": "chunk_abc123",
  "quote_original": "Students must complete 240 hours..."
}
```

## Confidence

Không dùng confidence do LLM tự sinh.

Phiên bản đầu:

```text
confidence = 1.0
```

Khi:

- `answer_status = answered`
- Evidence gate pass.
- Groundedness checker pass.

```text
confidence = 0.0
```

Khi:

- `not_found`
- `insufficient`
- `insufficient_evidence`
- `out_of_scope`

---

# Mốc 9: Groundedness Checker

## Mục tiêu

Kiểm tra câu trả lời sau khi sinh để ngăn unsupported claims.

## File dự kiến

```text
src/rag/groundedness.py
```

## Input

- User query.
- Generated answer.
- Used chunks.
- Allowed source scope.
- Required facts.
- Citation data.

## Quy tắc

### PASS

Chỉ PASS khi:

- Tất cả claim chính có bằng chứng.
- Số liệu khớp chunk.
- Ngày tháng khớp chunk.
- Tên form khớp chunk.
- Không có source ngoài scope.
- Không có dữ kiện do model tự thêm.

### FAIL

Nếu FAIL:

```text
answer_status = insufficient_evidence
```

Không được trả draft answer ban đầu.

### Timeout hoặc lỗi OpenAI

Nếu checker timeout hoặc lỗi:

- Không trả draft answer.
- Không bỏ qua bước kiểm tra.
- Trả trạng thái an toàn như `insufficient_evidence`.
- Ghi lỗi nội bộ nhưng không trả stack trace.

## Bảo mật

- Không lộ chain-of-thought.
- Không yêu cầu model xuất reasoning nội bộ.
- Chỉ cần verdict ngắn gọn và danh sách lỗi có cấu trúc.

## Output gợi ý

```json
{
  "status": "pass",
  "unsupported_claims": [],
  "missing_citations": [],
  "reason": "All factual claims are supported by the supplied chunks."
}
```

---

# Mốc 10: LangGraph Workflow

## Mục tiêu

Nối toàn bộ pipeline thành workflow của agent.

## File dự kiến

```text
src/agents/state.py
src/agents/graph.py
src/agents/nodes/rag_nodes.py
```

## Flow bắt buộc

```text
normalize_query
→ detect_language
→ classify_intent
→ route_scope
→ build_bilingual_queries
→ hybrid_retrieve
→ filter_by_allowed_sources
→ rerank
→ evidence_gate
→ generate_answer
→ groundedness_check
→ format_response
```

## Nhánh dừng sớm

### Out of scope

```text
classify_intent
→ out_of_scope
→ format_response
```

### Không tìm thấy bằng chứng

```text
evidence_gate
→ not_found
→ format_response
```

### Groundedness fail

```text
groundedness_check
→ insufficient_evidence
→ format_response
```

## Quy tắc response

Nếu:

- `out_of_scope`
- `not_found`
- `insufficient`
- `insufficient_evidence`

thì:

- Chỉ dùng câu từ chối chuẩn.
- Không trả lời vòng vo.
- Không đưa ra lời giải đoán.
- `sources = []`.
- `confidence = 0.0`.

---

# Mốc 11: API `/api/v1/chat`

## Mục tiêu

Tích hợp RAG workflow với endpoint hiện tại mà không phá backward compatibility.

## File dự kiến

```text
src/api/routes.py
src/models/schemas.py
```

## Response schema

```json
{
  "response": "...",
  "analysis": "",
  "result": {
    "answer_status": "answered",
    "answer": "...",
    "answer_language": "vi",
    "confidence": 1.0,
    "sources": []
  }
}
```

## Quy tắc request

- `message` không được rỗng.
- Giới hạn độ dài message.
- Trim khoảng trắng.
- Không nhận đường dẫn file từ request.
- Không nhận API key từ request.
- Không cho request chỉ định index path.
- Không cho request override system prompt.
- Không trả stack trace.

## Gợi ý validation

```text
min_length: 1
max_length: cấu hình phù hợp
```

## Backward compatibility

- Giữ trường `response`.
- Giữ trường `analysis`, mặc định là chuỗi rỗng.
- Thêm dữ liệu có cấu trúc trong `result`.
- Client cũ vẫn có thể đọc `response`.

---

# Mốc 12: Evaluation 5 Câu Gold

## Mục tiêu

Nghiệm thu khả năng trả lời đúng và chống hallucination.

## File dự kiến

```text
eval/rag_tests.json
eval/test_rag_agent.py
eval/evaluation_report.json
```

## Cấu trúc test

Mỗi test có thể chứa:

```json
{
  "id": "rag_gold_01",
  "query": "",
  "expected_status": "answered",
  "required_facts": [],
  "forbidden_facts": [],
  "required_source_patterns": [],
  "forbidden_source_patterns": []
}
```

## Kiểm tra bắt buộc

- `answer_status`.
- `required_facts`.
- `forbidden_facts`.
- Câu `answered` phải có source.
- Câu `not_found` phải có `sources = []`.
- `quote_original` phải tồn tại trong chunk.
- Không có unsupported claims.
- Không có source giả.
- Không dùng source ngoài allowed scope.

## Bộ 5 câu gold

- 3 câu có dữ liệu và phải trả lời đúng.
- 2 câu không có dữ liệu và phải trả `not_found`.

## Điều kiện pass

- 3 câu có dữ liệu trả đúng.
- 2 câu không có dữ liệu trả `not_found`.
- Hallucination rate của nhóm `not_found` bằng `0%`.
- Không có quote giả.
- Không có citation giả.

## Tách biệt hai loại test

### Retrieval test

Kiểm tra chunk có được lấy về hay không.

### Agent evaluation

Kiểm tra answer cuối, evidence, citation và hallucination.

Không gộp hai loại test thành một.

---

# Mốc 13: Frontend

## Điều kiện bắt đầu

Chỉ làm frontend sau khi backend vượt qua:

- Extraction test.
- Chunking test.
- Retrieval test.
- Evidence gate test.
- Groundedness test.
- Gold evaluation.

## Yêu cầu

- Gửi `message` tới `/api/v1/chat`.
- Hiển thị answer.
- Hiển thị source.
- Hiển thị `not_found` theo đúng thông báo chuẩn.
- Không hiển thị source rỗng.
- Không hiển thị confidence giả.
- Không hiển thị stack trace.
- Không phụ thuộc vào trường `analysis`.

## Trạng thái giao diện cần có

```text
idle
loading
answered
not_found
insufficient_evidence
out_of_scope
error
```

---

# Mốc 14: Cleanup, Docs và Logging

## Mục tiêu

Đóng gói project sạch, có tài liệu và không làm hỏng hệ thống log.

## Việc cần làm

- Cập nhật README ngắn cho project.
- Ghi hướng dẫn build index.
- Ghi hướng dẫn chạy retrieval test.
- Ghi hướng dẫn chạy evaluation.
- Ghi rõ thư mục dữ liệu.
- Kiểm tra `.env`.
- Kiểm tra file index lớn.
- Kiểm tra file tạm.
- Kiểm tra log.
- Kiểm tra API schema.

## Quy tắc bắt buộc

- Không sửa `.ai-log`.
- Không xóa `.ai-log`.
- Không tự ý thêm `.ai-log` vào `.gitignore`.
- Không commit `.env`.
- Không commit API key.
- Không commit vector index lớn nếu không được yêu cầu.
- Không commit file tạm.
- Không ghi secret vào report hoặc manifest.

## Gửi log sau mốc quan trọng

Có thể chạy:

```powershell
python scripts\submit_log.py
```

Chạy từ thư mục gốc của repository.

---

# Quy tắc dừng sau mỗi mốc

Sau khi hoàn thành một mốc, phải dừng lại và báo cáo trước khi tiếp tục.

## Mẫu báo cáo

````markdown
## Báo cáo Mốc X

### 1. File đã tạo

- `path/to/file.py`

### 2. File đã sửa

- `path/to/existing_file.py`

### 3. Lệnh đã chạy

```powershell
python ...
pytest ...
```
````

### 4. Kết quả kiểm tra

- Số test pass:
- Số test fail:
- Output đã tạo:
- Gold phrase đã tìm thấy:
- Gold phrase chưa tìm thấy:

### 5. Lỗi còn tồn tại

- Không có.

Hoặc:

- Mô tả lỗi.
- Nguyên nhân dự kiến.
- Phạm vi ảnh hưởng.

### 6. Có thay đổi `requirements.txt` không?

- Có / Không.

Nếu có, ghi rõ package và lý do.

### 7. Có thay đổi API schema không?

- Có / Không.

Nếu có, ghi rõ trường thêm, xóa hoặc thay đổi.

### 8. Mốc tiếp theo đề xuất

- Mốc X+1: Tên mốc.
- Lý do có thể tiếp tục.

````

---

# Checklist tổng thể

## Extraction

- [ ] Đọc đủ 7 tài liệu.
- [ ] PDF đọc theo trang.
- [ ] DOCX đọc paragraph, table và heading.
- [ ] Lưu metadata.
- [ ] Không crash khi một file lỗi.
- [ ] Ghi empty pages.
- [ ] Ghi errors.
- [ ] Kiểm tra đủ 5 cụm bắt buộc.
- [ ] Chưa chunk.
- [ ] Chưa embedding.

## Chunking

- [ ] Chunk theo cấu trúc trước.
- [ ] Có fallback theo size.
- [ ] Không tách evidence quan trọng.
- [ ] `chunk_id` ổn định.
- [ ] Metadata đầy đủ.
- [ ] Chưa embedding.

## Query Processing

- [ ] Detect language.
- [ ] Query tiếng Việt có bản tiếng Anh.
- [ ] Query tiếng Anh giữ nguyên.
- [ ] Search song ngữ.
- [ ] Không thêm đáp án vào expansion.

## Indexing

- [ ] Build Chroma.
- [ ] Build BM25.
- [ ] Build qua thư mục tạm.
- [ ] Build fail không mất index cũ.
- [ ] Manifest đầy đủ.
- [ ] Không có API key trong manifest.

## Retrieval

- [ ] Vector search.
- [ ] BM25 search.
- [ ] RRF.
- [ ] Filter source.
- [ ] Top 5.
- [ ] Gold `240 hours` trong top 5.
- [ ] Gold `2.0 overall GPA` trong top 5.
- [ ] Gold `Statement of Internship Grievance` trong top 5.

## Routing

- [ ] Có đủ intent.
- [ ] Internship dùng đúng policy/form.
- [ ] Talent chỉ dùng cho career/opportunity.
- [ ] Capstone chỉ dùng cho capstone.
- [ ] Không suy diễn chéo nguồn.

## Evidence

- [ ] Số liệu có trực tiếp trong chunk.
- [ ] Ngày có trực tiếp trong chunk.
- [ ] Email có trực tiếp trong chunk.
- [ ] Tên form có trực tiếp trong chunk.
- [ ] Deadline không có dữ liệu trả `not_found`.
- [ ] Email cá nhân không có dữ liệu trả `not_found`.

## Answer và Citation

- [ ] Model không sinh quote.
- [ ] Backend lấy quote từ chunk.
- [ ] Quote tồn tại thật trong chunk.
- [ ] Không dùng confidence từ LLM.
- [ ] Pass trả `1.0`.
- [ ] Fail trả `0.0`.

## Groundedness

- [ ] PASS mới trả answer.
- [ ] FAIL trả `insufficient_evidence`.
- [ ] Timeout không trả draft.
- [ ] Không lộ chain-of-thought.
- [ ] Không dùng kiến thức ngoài context.

## LangGraph

- [ ] Đủ node.
- [ ] Đúng thứ tự.
- [ ] Có nhánh dừng sớm.
- [ ] `not_found` có `sources = []`.
- [ ] `out_of_scope` có `sources = []`.

## API

- [ ] Giữ backward compatibility.
- [ ] Validate message.
- [ ] Có giới hạn độ dài.
- [ ] Không nhận API key/path từ request.
- [ ] Không trả stack trace.

## Evaluation

- [ ] Có 5 câu gold.
- [ ] 3 câu answered đúng.
- [ ] 2 câu not_found.
- [ ] Answered có source.
- [ ] Not found không có source.
- [ ] Quote có thật.
- [ ] Không unsupported claims.
- [ ] Hallucination rate nhóm not found bằng 0%.

## Frontend

- [ ] Chỉ làm sau khi backend pass.
- [ ] Gửi đúng endpoint.
- [ ] Hiển thị answer.
- [ ] Hiển thị source.
- [ ] Hiển thị not found chuẩn.

## Cleanup

- [ ] README đã cập nhật.
- [ ] Không commit `.env`.
- [ ] Không commit API key.
- [ ] Không sửa `.ai-log`.
- [ ] Không thêm `.ai-log` vào `.gitignore`.
- [ ] Không commit index lớn nếu chưa được yêu cầu.
- [ ] Có thể chạy `python scripts\submit_log.py`.

---

# Thứ tự triển khai đề xuất

```text
Mốc 1  → Extraction
Mốc 2  → Chunking
Mốc 3  → Query Language và Translation
Mốc 4  → Indexing
Mốc 5  → Retrieval Test
Mốc 6  → Intent và Source Routing
Mốc 7  → Evidence Gate
Mốc 8  → Answer Generator và Citation
Mốc 9  → Groundedness Checker
Mốc 10 → LangGraph Workflow
Mốc 11 → API Integration
Mốc 12 → Gold Evaluation
Mốc 13 → Frontend
Mốc 14 → Cleanup, Docs và Logging
````

Không được bỏ qua retrieval test để chuyển thẳng sang answer generation.

Không được bỏ qua evidence gate hoặc groundedness checker để trả lời nhanh hơn.

---

# Definition of Done

Hệ thống được xem là hoàn thành khi:

1. Đọc đủ 7 tài liệu.
2. Chunk ổn định và có metadata.
3. Build Chroma và BM25 an toàn.
4. Hybrid retrieval tìm đúng gold chunks.
5. Intent routing chọn đúng nguồn.
6. Evidence gate chặn câu không có dữ liệu.
7. Quote lấy trực tiếp từ chunk.
8. Groundedness checker chặn unsupported claims.
9. LangGraph nối đúng flow.
10. API giữ backward compatibility.
11. 5 câu gold đạt yêu cầu.
12. Hallucination rate của nhóm `not_found` bằng `0%`.
13. Frontend chỉ hiển thị kết quả backend đã kiểm chứng.
14. Repository sạch, không chứa secret và không làm hỏng `.ai-log`.
