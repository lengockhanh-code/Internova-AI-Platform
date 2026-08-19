# RAG Chatbot — Code Structure Overview

Tài liệu này tổng hợp phân tích kiến trúc code thực tế của hệ thống **RAG Chatbot** thuộc dự án **Internova AI**. Tất cả thông tin dưới đây được trích xuất hoàn toàn từ việc rà soát code Python/TypeScript, không dựa trên tài liệu Markdown có sẵn.

---

## 1. Tổng quan

Hệ thống RAG Chatbot của dự án được thiết kế theo mô hình **Hybrid Retrieval (ChromaDB Vector + RankBM25)** kết hợp với **Evidence Validation, Guardrails và Response Generation**. 

Hệ thống bao gồm 2 luồng xử lý chính:
1. **Luồng Ingestion & Indexing (Offline):** Đọc các tài liệu quy định (PDF, DOCX) → Làm sạch text → Cắt chunk (Chunking) & Gắn metadata → Tạo Vector Embeddings (OpenAI) lưu vào ChromaDB + Xây dựng index BM25 lưu file pickle.
2. **Luồng Query Execution & Answer Generation (Online):** Tiếp nhận câu hỏi sinh viên → Kiểm tra Input Guardrails → Phân loại Intent & Scope → Dịch/Mở rộng query → Truye xuất Hybrid (ChromaDB + BM25) & Fusion RRF → Reranking bằng LLM → Kiểm chứng bằng chứng (Evidence Check) → Sinh câu trả lời (Answer Generator) kèm Trích dẫn (Citations) → Kiểm tra Fact Groundedness → Trả về kết quả qua API FastAPI tới Frontend React.

Ngoài ra, hệ thống còn chứa 1 luồng thử nghiệm thứ 2 dựa trên **LangGraph StateGraph** (`src/agents/graph.py`).

---

## 2. Danh sách file liên quan

Dưới đây là danh sách đầy đủ tất cả **36 file code** tham gia trực tiếp hoặc gián tiếp vào hệ thống RAG Chatbot.

### 2.1 Cấu hình & Schemas (`src/config.py`, `src/rag/`)
* [src/config.py](file:///d:/BTL-VIN/P-103/src/config.py)
* [src/rag/config.py](file:///d:/BTL-VIN/P-103/src/rag/config.py)
* [src/rag/schemas.py](file:///d:/BTL-VIN/P-103/src/rag/schemas.py)
* [src/rag/prompts.py](file:///d:/BTL-VIN/P-103/src/rag/prompts.py)
* [src/rag/memory.py](file:///d:/BTL-VIN/P-103/src/rag/memory.py)

### 2.2 Luồng Ingestion (`src/rag/ingestion/`)
* [src/rag/ingestion/loader.py](file:///d:/BTL-VIN/P-103/src/rag/ingestion/loader.py)
* [src/rag/ingestion/cleaner.py](file:///d:/BTL-VIN/P-103/src/rag/ingestion/cleaner.py)
* [src/rag/ingestion/chunker.py](file:///d:/BTL-VIN/P-103/src/rag/ingestion/chunker.py)
* [src/rag/ingestion/pipeline.py](file:///d:/BTL-VIN/P-103/src/rag/ingestion/pipeline.py)

### 2.3 Luồng Retrieval & Indexing (`src/rag/retrieval/`)
* [src/rag/retrieval/vector_store.py](file:///d:/BTL-VIN/P-103/src/rag/retrieval/vector_store.py)
* [src/rag/retrieval/bm25_store.py](file:///d:/BTL-VIN/P-103/src/rag/retrieval/bm25_store.py)
* [src/rag/retrieval/indexer.py](file:///d:/BTL-VIN/P-103/src/rag/retrieval/indexer.py)
* [src/rag/retrieval/retriever.py](file:///d:/BTL-VIN/P-103/src/rag/retrieval/retriever.py)
* [src/rag/retrieval/reranker.py](file:///d:/BTL-VIN/P-103/src/rag/retrieval/reranker.py)

### 2.4 Luồng Evidence & Generation & Validation (`src/rag/`, `src/rag/generation/`)
* [src/rag/evidence.py](file:///d:/BTL-VIN/P-103/src/rag/evidence.py)
* [src/rag/generation/answer_generator.py](file:///d:/BTL-VIN/P-103/src/rag/generation/answer_generator.py)
* [src/rag/generation/validation.py](file:///d:/BTL-VIN/P-103/src/rag/generation/validation.py)
* [src/rag/query_pipeline.py](file:///d:/BTL-VIN/P-103/src/rag/query_pipeline.py)

### 2.5 API Layer & Services (`src/api/`, `src/services/`, `src/models/`)
* [src/main.py](file:///d:/BTL-VIN/P-103/src/main.py)
* [src/api/routes.py](file:///d:/BTL-VIN/P-103/src/api/routes.py)
* [src/services/chat_service.py](file:///d:/BTL-VIN/P-103/src/services/chat_service.py)
* [src/models/chat.py](file:///d:/BTL-VIN/P-103/src/models/chat.py)

### 2.6 Agentic Workflow LangGraph (`src/agents/`)
* [src/agents/state.py](file:///d:/BTL-VIN/P-103/src/agents/state.py)
* [src/agents/graph.py](file:///d:/BTL-VIN/P-103/src/agents/graph.py)
* [src/agents/nodes/rag_nodes.py](file:///d:/BTL-VIN/P-103/src/agents/nodes/rag_nodes.py)

### 2.7 Frontend UI (`frontend/`)
* [frontend/app/student/chatbot/page.tsx](file:///d:/BTL-VIN/P-103/frontend/app/student/chatbot/page.tsx)

### 2.8 Scripts (`scripts/`, `demo.py`)
* [scripts/build_rag_chunks.py](file:///d:/BTL-VIN/P-103/scripts/build_rag_chunks.py)
* [scripts/build_rag_index.py](file:///d:/BTL-VIN/P-103/scripts/build_rag_index.py)
* [scripts/inspect_rag_documents.py](file:///d:/BTL-VIN/P-103/scripts/inspect_rag_documents.py)
* [scripts/migrate_bm25_pickle.py](file:///d:/BTL-VIN/P-103/scripts/migrate_bm25_pickle.py)
* [scripts/test_query_expansion.py](file:///d:/BTL-VIN/P-103/scripts/test_query_expansion.py)
* [scripts/test_rag_retrieval.py](file:///d:/BTL-VIN/P-103/scripts/test_rag_retrieval.py)
* [demo.py](file:///d:/BTL-VIN/P-103/demo.py)

### 2.9 Evaluation & Tests (`eval/`, `tests/`)
* [eval/test_rag_agent.py](file:///d:/BTL-VIN/P-103/eval/test_rag_agent.py)
* [eval/test_rag_answer_generator.py](file:///d:/BTL-VIN/P-103/eval/test_rag_answer_generator.py)
* [eval/test_rag_evidence.py](file:///d:/BTL-VIN/P-103/eval/test_rag_evidence.py)
* [eval/test_rag_graph_workflow.py](file:///d:/BTL-VIN/P-103/eval/test_rag_graph_workflow.py)
* [eval/test_rag_groundedness.py](file:///d:/BTL-VIN/P-103/eval/test_rag_groundedness.py)
* [eval/test_rag_retriever.py](file:///d:/BTL-VIN/P-103/eval/test_rag_retriever.py)
* [eval/test_rag_router.py](file:///d:/BTL-VIN/P-103/eval/test_rag_router.py)
* [tests/test_agents/test_graph.py](file:///d:/BTL-VIN/P-103/tests/test_agents/test_graph.py)
* [tests/test_api/test_routes.py](file:///d:/BTL-VIN/P-103/tests/test_api/test_routes.py)

---

## 3. Configuration

### [src/config.py](file:///d:/BTL-VIN/P-103/src/config.py)
* **Vai trò:** Quản lý toàn bộ cấu hình ứng dụng backend từ biến môi trường (`.env`).
* **Thuộc giai đoạn:** Configuration
* **Các class/hàm chính:** `Settings` (Pydantic BaseSettings), `get_settings()` (hàm singleton cache `@lru_cache`).
* **Input:** Biến môi trường `.env` (`OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL`, `CHROMA_PERSIST_DIR`, `MODEL_NAME`, v.v.).
* **Output:** Đối tượng `Settings` chứa cấu hình toàn hệ thống.
* **Liên kết với:** Được gọi bởi hầu hết các module RAG như `vector_store.py`, `indexer.py`, `retriever.py`, `reranker.py`, `query_pipeline.py`.

### [src/rag/config.py](file:///d:/BTL-VIN/P-103/src/rag/config.py)
* **Vai trò:** Khai báo cấu hình đường dẫn thư mục chuyên biệt cho phần RAG (`source_dir`, `output_dir`, `chroma_dir`).
* **Thuộc giai đoạn:** Configuration
* **Các class/hàm chính:** `RAGPaths` (dataclass), `get_rag_paths()`.
* **Input:** Không có (mặc định trỏ về `Data/`, `data/rag`, `data/chroma`).
* **Output:** Đối tượng `RAGPaths`.
* **Liên kết với:** Được gọi bởi `scripts/build_rag_chunks.py`, `scripts/build_rag_index.py`, `scripts/inspect_rag_documents.py`, `rag_nodes.py`.

---

## 4. Document Loading / Extraction

### [src/rag/ingestion/loader.py](file:///d:/BTL-VIN/P-103/src/rag/ingestion/loader.py)
* **Vai trò:** Đọc và bóc tách dữ liệu thô (text, bảng biểu, trang) từ các file PDF và DOCX trong thư mục tài liệu.
* **Thuộc giai đoạn:** Extraction
* **Các class/hàm chính:** `load_document()`, `load_pdf()`, `load_docx()`, `ExtractedElement`, `ExtractionResult`.
* **Input:** Đường dẫn file tài liệu (`Path` đến file `.pdf` hoặc `.docx`).
* **Output:** Đối tượng `ExtractionResult` chứa danh sách các `ExtractedElement` (văn bản từng phần kèm thông tin trang, loại phần).
* **Liên kết với:** Được gọi bởi `src/rag/ingestion/pipeline.py` và các script rà soát dữ liệu.

---

## 5. Cleaning / Preprocessing

### [src/rag/ingestion/cleaner.py](file:///d:/BTL-VIN/P-103/src/rag/ingestion/cleaner.py)
* **Vai trò:** Làm sạch văn bản thô sau extraction (xóa header/footer lặp lại, chuẩn hóa Unicode NFC, loại bỏ kí tự điều khiển, sửa lỗi ngắt dòng hyphenation) và làm giàu metadata cho chunk.
* **Thuộc giai đoạn:** Cleaning / Preprocessing
* **Các class/hàm chính:** `clean_text()`, `clean_extraction_result()`, `enrich_chunks()`, `_fix_encoding()`, `_remove_boilerplate_lines()`.
* **Input:** Chuỗi văn bản thô hoặc đối tượng `ExtractionResult` / danh sách `DocumentChunk`.
* **Output:** Chuỗi văn bản đã được làm sạch hoặc danh sách `DocumentChunk` đã gắn đủ hash, thời gian ingested.
* **Liên kết với:** Được gọi bởi `src/rag/ingestion/pipeline.py`.

---

## 6. Chunking

### [src/rag/ingestion/chunker.py](file:///d:/BTL-VIN/P-103/src/rag/ingestion/chunker.py)
* **Vai trò:** Chia nhỏ văn bản từ `ExtractionResult` thành các đoạn chunk hợp lý (tối đa 4500 ký tự, overlap 500 ký tự), xác định cấu trúc section/topic, gắn priority và tạo báo cáo chunking.
* **Thuộc giai đoạn:** Chunking
* **Các class/hàm chính:** `build_chunks()`, `chunk_document()`, `detect_topic()`, `extract_section()`, `write_chunks_jsonl()`.
* **Input:** Iterable các `ExtractionResult`.
* **Output:** Tuple `(list[DocumentChunk], ChunkBuildReport)` và file `chunks.jsonl`.
* **Liên kết với:** Được gọi bởi `src/rag/ingestion/pipeline.py` và `scripts/build_rag_chunks.py`.

---

## 7. Embedding & Indexing

### [src/rag/retrieval/indexer.py](file:///d:/BTL-VIN/P-103/src/rag/retrieval/indexer.py)
* **Vai trò:** Điều phối việc xây dựng toàn bộ cơ sở dữ liệu tìm kiếm (Vector Store + BM25 Store + Index Manifest) một cách an toàn (atomic build với thư mục tạm).
* **Thuộc giai đoạn:** Embedding & Indexing
* **Các class/hàm chính:** `build_rag_index()`, `load_chunks()`, `build_manifest()`, `safe_build_dirs()`.
* **Input:** File `data/rag/chunks.jsonl`.
* **Output:** Cơ sở dữ liệu ChromaDB tại `data/chroma`, index `data/rag/bm25.pkl` và file `data/rag/index_manifest.json`.
* **Liên kết với:** Được gọi bởi `src/rag/ingestion/pipeline.py` và `scripts/build_rag_index.py`. Gọi đến `build_chroma_store` và `build_bm25_store`.

---

## 8. Vector Store / ChromaDB

### [src/rag/retrieval/vector_store.py](file:///d:/BTL-VIN/P-103/src/rag/retrieval/vector_store.py)
* **Vai trò:** Quản lý việc tạo vector embedding thông qua OpenAIEmbeddings (`text-embedding-3-small`) và lưu trữ/truy vấn collection `internship_documents` trong ChromaDB.
* **Thuộc giai đoạn:** Vector Store
* **Các class/hàm chính:** `build_chroma_store()`, `build_embedding_text()`, `chroma_metadata()`.
* **Input:** Danh sách các `DocumentChunk`.
* **Output:** Collection trong ChromaDB tại thư mục `data/chroma`.
* **Liên kết với:** Được gọi bởi `indexer.py` (khi build index) và `retriever.py` (khi query).

---

## 9. BM25 Store

### [src/rag/retrieval/bm25_store.py](file:///d:/BTL-VIN/P-103/src/rag/retrieval/bm25_store.py)
* **Vai trò:** Tạo chỉ mục tìm kiếm từ khóa BM25 (`BM25Okapi`), thực hiện tokenization tiếng Anh/Việt và serialize lưu xuống file pickle.
* **Thuộc giai đoạn:** BM25 Store
* **Các class/hàm chính:** `build_bm25_store()`, `tokenize_for_bm25()`, `chunk_search_text()`, `BM25StorePayload`.
* **Input:** Danh sách các `DocumentChunk`.
* **Output:** File chỉ mục `data/rag/bm25.pkl`.
* **Liên kết với:** Được gọi bởi `indexer.py` khi build index và đọc lại bởi `retriever.py` khi tìm kiếm.

---

## 10. Retrieval

### [src/rag/retrieval/retriever.py](file:///d:/BTL-VIN/P-103/src/rag/retrieval/retriever.py)
* **Vai trò:** Thực hiện tìm kiếm kết hợp (Hybrid Retrieval) giữa ChromaDB Vector Search và BM25 Keyword Search, áp dụng thuật toán Reciprocal Rank Fusion (RRF) hoặc weighted score để trộn kết quả.
* **Thuộc giai đoạn:** Retrieval
* **Các class/hàm chính:** `HybridRetriever`, `HybridRetriever.retrieve()`, `_search_vector()`, `_search_bm25()`, `_reciprocal_rank_fusion()`, `RetrievalHit`, `RetrievalResult`.
* **Input:** Câu truy vấn `query` (chuỗi), các cấu hình `top_k_vector`, `top_k_bm25`, `allowed_document_types`.
* **Output:** Đối tượng `RetrievalResult` chứa danh sách các `RetrievalHit` đã qua trộn hạng RRF.
* **Liên kết với:** Đọc dữ liệu từ `data/chroma` và `data/rag/bm25.pkl`. Được gọi bởi `src/rag/query_pipeline.py`.

---

## 11. Query Processing / Routing

### [src/rag/query_pipeline.py](file:///d:/BTL-VIN/P-103/src/rag/query_pipeline.py)
* **Vai trò:** File điều phối chính cho toàn bộ luồng xử lý câu hỏi phía Online (Pipeline Coordinator). Đảm nhận việc chuẩn hóa query, nhận diện ngôn ngữ, phân loại Intent/Scope (`route_query()`), dịch/mở rộng query (`build_bilingual_queries()`), và kết nối retrieval -> rerank -> evidence -> generator -> validation.
* **Thuộc giai đoạn:** Query Processing / Routing & Pipeline Coordinator
* **Các class/hàm chính:** `QueryPipeline`, `QueryPipeline.run()`, `route_query()`, `build_bilingual_queries()`, `detect_query_language()`, `normalize_query()`, `RouteDecision`.
* **Input:** Câu hỏi của người dùng (`query: str`).
* **Output:** Đối tượng `QueryResult` hoàn chỉnh.
* **Liên kết với:** Gọi `retriever.py`, `reranker.py`, `evidence.py`, `answer_generator.py`, `validation.py`, `memory.py`. Được gọi trực tiếp bởi `ChatService`.

---

## 12. Reranking

### [src/rag/retrieval/reranker.py](file:///d:/BTL-VIN/P-103/src/rag/retrieval/reranker.py)
* **Vai trò:** Đánh giá lại thứ tự liên quan của các chunk tìm được bằng cách gửi danh sách candidate tới LLM để chấm điểm từ 0-10, sắp xếp lại kết quả chính xác hơn RRF đơn thuần.
* **Thuộc giai đoạn:** Rerank
* **Các class/hàm chính:** `rerank_hits()`, `_llm_rerank()`, `RerankResult`.
* **Input:** Query và danh sách `RetrievalHit` thu được từ hybrid search.
* **Output:** `RerankResult` chứa danh sách `RetrievalHit` đã re-sort theo điểm LLM.
* **Liên kết với:** Được gọi bởi `query_pipeline.py` (sau bước retrieval).

---

## 13. Evidence & Context

### [src/rag/evidence.py](file:///d:/BTL-VIN/P-103/src/rag/evidence.py)
* **Vai trò:** Kiểm tra tính đầy đủ của bằng chứng (Evidence Check Gate). Sử dụng các bộ quy tắc quy chuẩn và regex (con số, ngày tháng, form, email) để đảm bảo chunk retrieved thực sự chứa đủ bằng chứng trước khi cho phép sinh câu trả lời.
* **Thuộc giai đoạn:** Evidence & Context
* **Các class/hàm chính:** `check_evidence()`, `EvidenceCheckResult`, các regex pattern (`NUMBER_RE`, `FORM_RE`, `MONTH_YEAR_RE`, v.v.).
* **Input:** Query, danh sách `RetrievalHit`, và quyết định phân loại `RouteDecision`.
* **Output:** `EvidenceCheckResult` (trạng thái `"sufficient"` hoặc `"insufficient"`, lý do, danh sách `used_chunk_ids`).
* **Liên kết với:** Được gọi bởi `query_pipeline.py` trước khi sinh phản hồi.

---

## 14. Generation

### [src/rag/generation/answer_generator.py](file:///d:/BTL-VIN/P-103/src/rag/generation/answer_generator.py)
* **Vai trò:** Xây dựng context từ các chunk hợp lệ, sinh câu trả lời bằng LLM (OpenAI) kèm câu chào xã giao (nếu là conversational intent), tạo danh sách trích dẫn nguồn (`SourceCitation`), và cung cấp các câu trả lời fallback chuẩn khi thiếu thông tin.
* **Thuộc giai đoạn:** Generation
* **Các class/hàm chính:** `generate_answer_from_evidence()`, `build_context()`, `build_citations()`, `GeneratedAnswer`, `SourceCitation`.
* **Input:** Query, `EvidenceCheckResult`, danh sách `RetrievalHit`, lịch sử hội thoại.
* **Output:** Đối tượng `GeneratedAnswer` (chứa câu trả lời `answer`, `sources`, `confidence`, `answer_status`).
* **Liên kết với:** Được gọi bởi `query_pipeline.py`.

---

## 15. Validation / Groundedness / Guardrails

### [src/rag/generation/validation.py](file:///d:/BTL-VIN/P-103/src/rag/generation/validation.py)
* **Vai trò:** Chống Prompt Injection cho câu hỏi đầu vào (`check_input()`) và kiểm tra độ trung thực factual groundedness của câu trả lời do LLM sinh ra so với context thô (`check_groundedness()`, `apply_groundedness_gate()`).
* **Thuộc giai đoạn:** Validation / Groundedness / Guardrails
* **Các class/hàm chính:** `check_input()`, `check_groundedness()`, `apply_groundedness_gate()`, `GroundednessCheckResult`.
* **Input:** Câu hỏi đầu vào hoặc đối tượng `GeneratedAnswer` kèm context chunks.
* **Output:** Trạng thái pass/fail, danh sách claim không được hỗ trợ (`unsupported_claims`), hoặc `QueryResult` đã áp dụng fallback gate.
* **Liên kết với:** Được gọi bởi `query_pipeline.py` ở bước đầu vào và bước cuối cùng.

---

## 16. Memory

### [src/rag/memory.py](file:///d:/BTL-VIN/P-103/src/rag/memory.py)
* **Vai trò:** Lưu trữ lịch sử hội thoại nhiều lượt (Multi-turn Chat Memory) trong từng session và định dạng cửa sổ ngữ cảnh (context window) để bơm vào prompt cho câu hỏi nối tiếp.
* **Thuộc giai đoạn:** Memory
* **Các class/hàm chính:** `ConversationMemory`, `add_turn()`, `get_context_window()`, `get_recent_queries()`.
* **Input:** Các lượt Q&A (`query`, `answer`, `answer_status`).
* **Output:** Chuỗi format lịch sử chat `[Conversation History] User: ... Assistant: ...`.
* **Liên kết với:** Được gọi trong `query_pipeline.py`.

---

## 17. API / Entry Point & Web App

### [src/models/chat.py](file:///d:/BTL-VIN/P-103/src/models/chat.py)
* **Vai trò:** Định nghĩa các Pydantic schema cho dữ liệu API request/response của Chatbot RAG.
* **Thuộc giai đoạn:** Utility / Schemas
* **Các class/hàm chính:** `ChatRequest`, `ChatResponse`, `ChatResultResponse`, `ChatSource`.
* **Input:** Payload JSON gửi từ Frontend.
* **Output:** Đối tượng Python Pydantic.
* **Liên kết với:** Được sử dụng bởi `src/api/routes.py`.

### [src/services/chat_service.py](file:///d:/BTL-VIN/P-103/src/services/chat_service.py)
* **Vai trò:** Service quản lý singleton instance của `QueryPipeline` (load lazy khi có request đầu tiên), cung cấp phương thức `ask()`, `classify_query()` và `reload_pipeline()`.
* **Thuộc giai đoạn:** API / Service Layer
* **Các class/hàm chính:** `ChatService`, `chat_service.ask()`, `chat_service.classify_query()`, `chat_service.reload_pipeline()`.
* **Input:** Chuỗi message câu hỏi.
* **Output:** Đối tượng `QueryResult` từ pipeline.
* **Liên kết với:** Được gọi bởi `src/api/routes.py`. Khởi tạo `QueryPipeline`.

### [src/api/routes.py](file:///d:/BTL-VIN/P-103/src/api/routes.py)
* **Vai trò:** Định nghĩa các HTTP API Endpoints cho RAG Chatbot bằng FastAPI.
* **Thuộc giai đoạn:** API / Entry Point
* **Các class/hàm chính:** 
  * `POST /api/v1/chat/route` (`classify_chat_route`): Kiểm tra nhanh xem câu hỏi có cần RAG hay không.
  * `POST /api/v1/chat` (`chat`): Chạy luồng RAG bằng threadpool.
  * `POST /api/v1/chat/reload` (`reload_chat_pipeline`): Reset cache pipeline.
* **Input:** `ChatRequest` (JSON `{"message": "..."}`).
* **Output:** `ChatResponse` (JSON chứa `response` và `result` kèm `sources`).
* **Liên kết với:** Gọi `chat_service`. Được mount vào `main.py`.

### [src/main.py](file:///d:/BTL-VIN/P-103/src/main.py)
* **Vai trò:** Khởi chạy server FastAPI chính, cấu hình CORS middleware và mount router `/api/v1` chứa chatbot endpoints.
* **Thuộc giai đoạn:** API / Entry Point
* **Các class/hàm chính:** `app = FastAPI()`, lifespan handler.
* **Input:** HTTP Requests từ cổng 8000.
* **Output:** HTTP Responses.
* **Liên kết với:** Mount `chat_router` từ `src/api/routes.py`.

### [frontend/app/student/chatbot/page.tsx](file:///d:/BTL-VIN/P-103/frontend/app/student/chatbot/page.tsx)
* **Vai trò:** Giao diện người dùng (UI) Next.js/React cho sinh viên trò chuyện với Internova AI Chatbot.
* **Thuộc giai đoạn:** Frontend UI
* **Các class/hàm chính:** React Component `RagChatPage()`, hàm `sendMessage()`.
* **Input:** Người dùng nhập câu hỏi vào ô chat.
* **Output:** Hiển thị tin nhắn trả lời, icon trạng thái đang tìm tài liệu, danh sách nguồn trích dẫn.
* **Liên kết với:** Trực tiếp gửi fetch request tới `http://localhost:8000/api/v1/chat/route` và `http://localhost:8000/api/v1/chat`.

---

## 18. Agentic Workflow (LangGraph)

### [src/agents/state.py](file:///d:/BTL-VIN/P-103/src/agents/state.py)
* **Vai trò:** Định nghĩa cấu trúc trạng thái chung `AgentState` (TypedDict) cho luồng LangGraph.
* **Thuộc giai đoạn:** Schema / Agent State

### [src/agents/graph.py](file:///d:/BTL-VIN/P-103/src/agents/graph.py)
* **Vai trò:** Xây dựng đồ thị StateGraph gồm 12 node để chạy luồng RAG theo kiến trúc Agentic Workflow.
* **Thuộc giai đoạn:** RAG Pipeline / Agent Graph Coordinator
* **Các class/hàm chính:** `build_graph()`, `agent`, các hàm điều kiện `after_classify_intent()`, `after_hybrid_retrieve()`, `after_evidence_gate()`.
* **Input:** `AgentState` chứa `{"query": "..."}`.
* **Output:** `AgentState` chứa câu trả lời và thông tin truy xuất.

### [src/agents/nodes/rag_nodes.py](file:///d:/BTL-VIN/P-103/src/agents/nodes/rag_nodes.py)
* **Vai trò:** Chứa mã nguồn thực thi cho 12 node trong đồ thị LangGraph (`normalize_query_node`, `classify_intent_node`, `hybrid_retrieve_node`, `rerank_node`, `generate_answer_node`, v.v.).
* **Thuộc giai đoạn:** RAG Pipeline / Agent Graph Nodes

---

## 19. Scripts & Utilities

### [scripts/build_rag_chunks.py](file:///d:/BTL-VIN/P-103/scripts/build_rag_chunks.py)
* **Vai trò:** Script dòng lệnh offline đọc tài liệu trong `Data/`, cắt chunk và xuất file `data/rag/chunks.jsonl` cùng `chunk_report.json`.
* **Thuộc giai đoạn:** Script / Offline Ingestion

### [scripts/build_rag_index.py](file:///d:/BTL-VIN/P-103/scripts/build_rag_index.py)
* **Vai trò:** Script dòng lệnh offline đọc `data/rag/chunks.jsonl` và xây dựng cơ sở dữ liệu vector ChromaDB + chỉ mục BM25.
* **Thuộc giai đoạn:** Script / Offline Indexing

### [scripts/inspect_rag_documents.py](file:///d:/BTL-VIN/P-103/scripts/inspect_rag_documents.py)
* **Vai trò:** Script kiểm tra nhanh tính toàn vẹn của các file PDF/DOCX trong thư mục nguồn và soát từ khóa quan trọng.
* **Thuộc giai đoạn:** Script / Data Inspection

### [scripts/migrate_bm25_pickle.py](file:///d:/BTL-VIN/P-103/scripts/migrate_bm25_pickle.py)
* **Vai trò:** Script vá lỗi chuyển đổi đường dẫn module cũ sang mới cho file `data/rag/bm25.pkl`.
* **Thuộc giai đoạn:** Script / Migration Utility

### [scripts/test_query_expansion.py](file:///d:/BTL-VIN/P-103/scripts/test_query_expansion.py)
* **Vai trò:** Script thử nghiệm độc lập cho tính năng dịch và mở rộng câu hỏi đa ngôn ngữ.
* **Thuộc giai đoạn:** Script / Utility

### [scripts/test_rag_retrieval.py](file:///d:/BTL-VIN/P-103/scripts/test_rag_retrieval.py)
* **Vai trò:** Script chạy thử nghiệm tìm kiếm Hybrid Retrieval trực tiếp từ terminal.
* **Thuộc giai đoạn:** Script / Utility

### [demo.py](file:///d:/BTL-VIN/P-103/demo.py)
* **Vai trò:** Ứng dụng demo Streamlit tương tác giúp thử nghiệm và minh họa toàn bộ pipeline RAG Chatbot trên giao diện web độc lập.
* **Thuộc giai đoạn:** Script / Demo App

---

## 20. Evaluation & Tests

* [eval/test_rag_agent.py](file:///d:/BTL-VIN/P-103/eval/test_rag_agent.py): Đánh giá Benchmark RAG agent với bộ câu hỏi test mẫu `eval/rag_tests.json`.
* [eval/test_rag_answer_generator.py](file:///d:/BTL-VIN/P-103/eval/test_rag_answer_generator.py): Unit test cho module sinh câu trả lời và trích dẫn.
* [eval/test_rag_evidence.py](file:///d:/BTL-VIN/P-103/eval/test_rag_evidence.py): Unit test cho bộ quy tắc kiểm chứng bằng chứng.
* [eval/test_rag_graph_workflow.py](file:///d:/BTL-VIN/P-103/eval/test_rag_graph_workflow.py): Test độ chính xác của các node và luồng rẽ nhánh trong LangGraph.
* [eval/test_rag_groundedness.py](file:///d:/BTL-VIN/P-103/eval/test_rag_groundedness.py): Test kiểm định tính trung thực factual groundedness.
* [eval/test_rag_retriever.py](file:///d:/BTL-VIN/P-103/eval/test_rag_retriever.py): Unit test khởi tạo và truy vấn cho HybridRetriever.
* [eval/test_rag_router.py](file:///d:/BTL-VIN/P-103/eval/test_rag_router.py): Test kiểm định việc phân loại đúng Intent & Scope.
* [tests/test_agents/test_graph.py](file:///d:/BTL-VIN/P-103/tests/test_agents/test_graph.py): Pytest kiểm tra khởi tạo LangGraph.
* [tests/test_api/test_routes.py](file:///d:/BTL-VIN/P-103/tests/test_api/test_routes.py): Integration test cho FastAPI endpoints `/api/v1/chat`.

---

## 21. Phân loại theo 18 nhóm chức năng

| STT | Nhóm chức năng | Các file đại diện |
|---|---|---|
| 1 | **Configuration** | `src/config.py`, `src/rag/config.py` |
| 2 | **Document Loading / Extraction** | `src/rag/ingestion/loader.py` |
| 3 | **Cleaning / Preprocessing** | `src/rag/ingestion/cleaner.py` |
| 4 | **Chunking** | `src/rag/ingestion/chunker.py` |
| 5 | **Embedding & Indexing** | `src/rag/retrieval/indexer.py`, `src/rag/ingestion/pipeline.py` |
| 6 | **Vector Store** | `src/rag/retrieval/vector_store.py` |
| 7 | **BM25 Store** | `src/rag/retrieval/bm25_store.py` |
| 8 | **Retrieval** | `src/rag/retrieval/retriever.py` |
| 9 | **Reranking** | `src/rag/retrieval/reranker.py` |
| 10 | **Query Processing / Routing** | `src/rag/query_pipeline.py`, `src/rag/prompts.py` |
| 11 | **Evidence & Context** | `src/rag/evidence.py` |
| 12 | **Generation** | `src/rag/generation/answer_generator.py` |
| 13 | **Validation / Groundedness / Guardrails** | `src/rag/generation/validation.py` |
| 14 | **Memory** | `src/rag/memory.py` |
| 15 | **API / Entry Point** | `src/main.py`, `src/api/routes.py`, `src/services/chat_service.py`, `frontend/app/student/chatbot/page.tsx` |
| 16 | **Scripts** | `scripts/build_rag_chunks.py`, `scripts/build_rag_index.py`, `scripts/inspect_rag_documents.py`, `scripts/migrate_bm25_pickle.py`, `scripts/test_query_expansion.py`, `scripts/test_rag_retrieval.py`, `demo.py` |
| 17 | **Evaluation / Tests** | `eval/test_rag_agent.py`, `eval/test_rag_answer_generator.py`, `eval/test_rag_evidence.py`, `eval/test_rag_graph_workflow.py`, `eval/test_rag_groundedness.py`, `eval/test_rag_retriever.py`, `eval/test_rag_router.py`, `tests/test_agents/test_graph.py`, `tests/test_api/test_routes.py` |
| 18 | **Utilities / Schemas** | `src/rag/schemas.py`, `src/models/chat.py` |

---

## 22. Dữ liệu và Index được lưu ở đâu

Dựa trên mã nguồn thực tế trong `src/rag/config.py`, `src/config.py` và `src/services/chat_service.py`:

1. **`Data/` (Thư mục tài liệu đầu vào):**
   * Chứa các file tài liệu gốc: `POL-CAID-001-V2.0_Internship-Management-Policy_15.10.2025.pdf`, `Form-1-Internship-Request-Form-IRF.docx`, `Form-2-Release-of-Liability-Hold-Harmless-Agreement.docx`, `Form-3-Statement-of-Internship-Grievance.docx`, `Form-4-Sample-Evaluations.docx`, `VinUni-Talent-Handbook-FINAL.pdf`, `CAID-VinUni-Capstone-Booklet.pdf`.
   * Được đọc bởi: `loader.py`.
2. **`data/rag/chunks.jsonl`:**
   * Chứa toàn bộ danh sách các `DocumentChunk` đã được trích xuất, làm sạch, chia nhỏ và bổ sung metadata dưới dạng JSON Lines.
   * Tạo bởi: `chunker.py` / `pipeline.py` / `scripts/build_rag_chunks.py`.
   * Đọc lại bởi: `indexer.py` / `scripts/build_rag_index.py`.
3. **`data/rag/bm25.pkl`:**
   * Chứa đối tượng `BM25StorePayload` bao gồm corpus đã tokenize và đối tượng `BM25Okapi` serialized bằng `pickle`.
   * Tạo bởi: `bm25_store.py` / `indexer.py`.
   * Đọc lại bởi: `retriever.py` khi thực hiện tìm kiếm từ khóa.
4. **`data/rag/index_manifest.json`:**
   * Chứa metadata của lần build index (số lượng document, số lượng chunk, thời gian build, model embedding được dùng).
   * Tạo bởi: `indexer.py`.
5. **`data/chroma/` (Cơ sở dữ liệu Vector ChromaDB):**
   * Chứa collection `internship_documents` bao gồm vectors embedding (`text-embedding-3-small`), chunk text và metadata tương ứng.
   * Tạo bởi: `vector_store.py` / `indexer.py`.
   * Đọc lại bởi: `retriever.py` thông qua `chromadb.PersistentClient`.

---

## 23. Luồng hoạt động hoàn chỉnh của RAG Chatbot

### 23.1 Luồng Offline Indexing (Tạo dữ liệu tìm kiếm)
```text
Tài liệu gốc (PDF / DOCX trong Data/)
   ↓ (loader.load_document)
ExtractionResult (Extracted Elements)
   ↓ (cleaner.clean_extraction_result)
Text sạch & chuẩn hóa Unicode
   ↓ (chunker.build_chunks)
DocumentChunks + Metadata
   ↓ (cleaner.enrich_chunks & chunker.write_chunks_jsonl)
data/rag/chunks.jsonl
   ↓ (indexer.build_rag_index)
   ├── ChromaDB Embeddings (OpenAI) ──→ data/chroma/
   └── BM25 Keyword Store ────────────→ data/rag/bm25.pkl
```

### 23.2 Luồng Online Query & Response Generation (Người dùng đặt câu hỏi)
```text
Sinh viên gửi câu hỏi từ Frontend UI (page.tsx)
   ↓ (HTTP POST http://localhost:8000/api/v1/chat)
FastAPI Endpoint (src/api/routes.py - chat)
   ↓ (Threadpool Execution)
ChatService (src/services/chat_service.py)
   ↓ (Singleton QueryPipeline.run)
QueryPipeline (src/rag/query_pipeline.py)
   │
   ├── 1. Input Guardrail (validation.check_input) ──→ Phát hiện Prompt Injection? (Chặn ngay nếu vi phạm)
   ├── 2. Language Detection & Normalization
   ├── 3. Intent Routing (prompts.INTENT_ROUTING_RULES) ──→ Scope out_of_scope hoặc conversational?
   │                                                          └─→ Trả lời trực tiếp không cần RAG
   ├── 4. Query Translation / Expansion (Tiếng Việt → Tiếng Anh Search Query)
   ├── 5. Hybrid Retrieval (retriever.HybridRetriever)
   │      ├── Vector Search (ChromaDB)
   │      └── Keyword Search (BM25)
   │      └── Reciprocal Rank Fusion (RRF) Trộn kết quả
   ├── 6. LLM Reranking (reranker.rerank_hits) ──→ Đánh giá điểm 0-10 từng chunk
   ├── 7. Evidence Check (evidence.check_evidence) ──→ Đủ bằng chứng trực tiếp?
   │                                                      └─→ Không đủ: Trả về Fallback Response chuẩn
   ├── 8. Answer Generation (answer_generator.generate_answer_from_evidence)
   │      ├── Bơm Context & History
   │      ├── Gọi OpenAI LLM sinh văn bản
   │      └── Xây dựng Trích dẫn Nguồn (Citations)
   └── 9. Fact Groundedness Check (validation.check_groundedness)
          └─→ Nếu sinh thông tin sai lệch ──→ Trả về Fallback Response an toàn
   ↓
QueryResult (Trả về qua API Response)
   ↓
Hiển thị câu trả lời & Nguồn trích dẫn trên Frontend React UI
```

---

## 24. Dependency giữa các file (Call Graph)

```text
frontend/app/student/chatbot/page.tsx
  └── gọi HTTP POST ──> src/api/routes.py
                         └── gọi ──> src/services/chat_service.py
                                       └── gọi ──> src/rag/query_pipeline.py
                                                     ├── import ──> src/config.py
                                                     ├── import ──> src/rag/schemas.py
                                                     ├── import ──> src/rag/prompts.py
                                                     ├── import ──> src/rag/memory.py
                                                     ├── import ──> src/rag/retrieval/retriever.py
                                                     │               ├── import ──> src/rag/retrieval/vector_store.py (ChromaDB)
                                                     │               └── import ──> src/rag/retrieval/bm25_store.py (BM25)
                                                     ├── import ──> src/rag/retrieval/reranker.py
                                                     ├── import ──> src/rag/evidence.py
                                                     ├── import ──> src/rag/generation/answer_generator.py
                                                     └── import ──> src/rag/generation/validation.py
```

---

## 25. Các file quan trọng nhất

* **File Entry Point của API RAG:** [src/api/routes.py](file:///d:/BTL-VIN/P-103/src/api/routes.py)
* **File điều phối Pipeline chính (Live):** [src/rag/query_pipeline.py](file:///d:/BTL-VIN/P-103/src/rag/query_pipeline.py)
* **File Service quản lý Pipeline:** [src/services/chat_service.py](file:///d:/BTL-VIN/P-103/src/services/chat_service.py)
* **File điều phối Ingestion:** [src/rag/ingestion/pipeline.py](file:///d:/BTL-VIN/P-103/src/rag/ingestion/pipeline.py)
* **File Build Index:** [src/rag/retrieval/indexer.py](file:///d:/BTL-VIN/P-103/src/rag/retrieval/indexer.py)
* **File quản lý Vector Store (ChromaDB):** [src/rag/retrieval/vector_store.py](file:///d:/BTL-VIN/P-103/src/rag/retrieval/vector_store.py)
* **File quản lý BM25 Store:** [src/rag/retrieval/bm25_store.py](file:///d:/BTL-VIN/P-103/src/rag/retrieval/bm25_store.py)
* **File Hybrid Retrieval:** [src/rag/retrieval/retriever.py](file:///d:/BTL-VIN/P-103/src/rag/retrieval/retriever.py)
* **File Reranking:** [src/rag/retrieval/reranker.py](file:///d:/BTL-VIN/P-103/src/rag/retrieval/reranker.py)
* **File Evidence Gate:** [src/rag/evidence.py](file:///d:/BTL-VIN/P-103/src/rag/evidence.py)
* **File Answer Generation:** [src/rag/generation/answer_generator.py](file:///d:/BTL-VIN/P-103/src/rag/generation/answer_generator.py)
* **File Validation / Groundedness:** [src/rag/generation/validation.py](file:///d:/BTL-VIN/P-103/src/rag/generation/validation.py)
* **File Multi-turn Memory:** [src/rag/memory.py](file:///d:/BTL-VIN/P-103/src/rag/memory.py)

---

## 26. Ghi chú quan trọng: Các phần chưa tìm thấy hoặc chưa kết nối đồng bộ

Qua việc rà soát từng câu lệnh `import` và luồng chạy thực tế, có một số điểm cần lưu ý kiến trúc:

1. **Sự tách biệt giữa `QueryPipeline` và `LangGraph Agent`:**
   * Hệ thống đang sử dụng **`QueryPipeline`** (`src/rag/query_pipeline.py`) làm luồng chính phục vụ ứng dụng web (API FastAPI `/api/v1/chat` và Streamlit `demo.py` đều gọi qua `QueryPipeline`).
   * Luồng LangGraph Agent (`src/agents/graph.py`) tồn tại như một hướng tiếp cận thử nghiệm. 
2. **Import cũ trong `src/agents/nodes/rag_nodes.py`:**
   * Trong file `src/agents/nodes/rag_nodes.py`, các lệnh import đang trỏ đến các module dạng phẳng (ví dụ: `from src.rag.retriever import ...`, `from src.rag.router import ...`) thay vì cấu trúc subpackage mới (`src.rag.retrieval.retriever`, `src.rag.query_pipeline`). Điều này cho thấy thư mục `src/rag/` đã trải qua refactoring cấu trúc lại thư mục, và luồng `QueryPipeline` đã được nâng cấp đầy đủ, trong khi `rag_nodes.py` chưa được cập nhật tương ứng.
3. **Không có chỉnh sửa nào được thực hiện:** Đúng theo yêu cầu kiểm tra, toàn bộ cấu trúc mã nguồn dự án được giữ nguyên 100%, không bị sửa đổi hay di chuyển bất kỳ file nào.
