# 🎓 Internova AI — VinUniversity Internship RAG Chatbot

![Python Version](https://img.shields.io/badge/python-3.10%20%7C%203.11%20%7C%203.12-blue)
![Framework](https://img.shields.io/badge/FastAPI-0.100%2B-green)
![UI Framework](https://img.shields.io/badge/Streamlit-1.30%2B-red)
![RAG Architecture](https://img.shields.io/badge/RAG-Hybrid%20Search%20%2B%20Rerank-purple)
![License](https://img.shields.io/badge/license-MIT-brightgreen)

**Internova AI** là hệ thống Chatbot RAG (Retrieval-Augmented Generation) song ngữ Việt - Anh thông minh, chuyên hỗ trợ sinh viên VinUniversity tra cứu nhanh chóng, chính xác các quy chế, quy định thực tập, biểu mẫu (Form 1–4), tín chỉ, dự án Capstone và cẩm nang nghề nghiệp (Talent/Career Handbook).

Hệ thống được thiết kế theo kiến trúc **End-to-End Semantic RAG** hiện đại, kết hợp giữa **Dense Vector Search (ChromaDB + OpenAI BGE Embeddings)**, **Sparse Search (BM25)**, **Reciprocal Rank Fusion (RRF)**, **LLM Cross-Encoder Reranking**, cùng tầng **Kiểm tra Bằng chứng Ngữ nghĩa (Semantic Evidence Checking)** và **Xác thực Căn cứ (Groundedness Validation)** giúp loại bỏ triệt để hiện tượng bịa đặt thông tin (hallucination).

---

## 📋 Mục lục

1. [Tính năng Nổi bật](#-tính-năng-nổi-bật)
2. [Yêu cầu Hệ thống & Thư viện](#-yêu-cầu-hệ-thống--thư-viện)
3. [Hướng dẫn Cài đặt & Setup Môi trường](#-hướng-dẫn-cài-đặt--setup-môi-trường)
4. [Hướng dẫn Nạp Dữ liệu & Xây dựng Index (Data Ingestion)](#-hướng-dẫn-nạp-dữ-liệu--xây-dựng-index-data-ingestion)
5. [Hướng dẫn Chạy Dự án](#-hướng-dẫn-chạy-dự-án)
   - [Chạy Giao diện Web (Streamlit Demo)](#1-chạy-giao-diện-web-streamlit-demo)
   - [Chạy Backend REST API (FastAPI)](#2-chạy-backend-rest-api-fastapi)
   - [Chạy qua Docker / Docker Compose](#3-chạy-qua-docker--docker-compose)
6. [Cấu trúc Thư mục Dự án](#-cấu-trúc-thư-mục-dự-án)
7. [Kiến trúc Hệ thống RAG (Architecture & Flow)](#-kiến-trúc-hệ-thống-rag-architecture--flow)
8. [Kiểm thử & Đánh giá (Testing & Eval)](#-kiểm-thử--đánh-giá-testing--eval)
9. [AI Usage Logging (Dành cho AI20K Build Phase)](#-ai-usage-logging-dành-cho-ai20k-build-phase)

---

## ✨ Tính năng Nổi bật

- 🌐 **Hỗ trợ Song ngữ (Bilingual VI / EN)**: Tự động nhận diện ngôn ngữ truy vấn và phản hồi linh hoạt bằng tiếng Việt hoặc tiếng Anh.
- 🎯 **Semantic Intent Routing**: Phân loại ý định thông minh (Hội thoại xã giao, Hỏi hỗ trợ chung, hoặc Tra cứu Quy chế/Thực tập/Capstone).
- 🔍 **Hybrid Multi-Query Retrieval**: Kết hợp Vector Search (ChromaDB) và Keyword Search (BM25) với thuật toán hợp nhất RRF.
- ⚖️ **Cross-Encoder Reranking**: Đánh giá và xếp hạng lại tài liệu bằng LLM nhằm tối ưu ngữ cảnh cho mô hình sinh câu trả lời.
- 🛡️ **Guardrails & Groundedness Gate**: Tự động phát hiện prompt injection, kiểm tra tính đầy đủ của bằng chứng trước khi trả lời và chặn câu trả lời bịa đặt.
- 📑 **Trích dẫn Nguồn Chính xác (Source Citations)**: Trích dẫn rõ ràng tên văn bản gốc, số trang và mục (section), đồng thời cho phép xem file PDF/DOCX gốc trực tiếp trên giao diện.

---

## 🛠 Yêu cầu Hệ thống & Thư viện

### 1. Yêu cầu Phần mềm
- **Python**: `3.10`, `3.11` hoặc `3.12`
- **Git**: Đã cài đặt trên máy
- **OpenAI API Key**: Yêu cầu key OpenAI hợp lệ để chạy Embedding và Chat Model.

### 2. Các Thư viện Chính (Dependencies)

Các thư viện được quản lý trong file `requirements.txt`:

| Nhóm chức năng | Thư viện chính | Công dụng |
| :--- | :--- | :--- |
| **Framework Web & API** | `fastapi`, `uvicorn`, `streamlit` | Xây dựng REST API backend và Giao diện Web tương tác |
| **LLM & RAG Framework** | `langchain`, `langchain-core`, `langchain-openai` | Tích hợp và điều phối các mô hình ngôn ngữ lớn |
| **Vector & Lexical Search**| `chromadb`, `rank-bm25` | Lưu trữ chỉ mục Vector và Tìm kiếm từ khóa lexical BM25 |
| **Xử lý Tài liệu** | `pypdf`, `pymupdf` (PyMuPDF), `python-docx` | Đọc và trích xuất dữ liệu từ các file PDF, DOCX |
| **Cơ sở dữ liệu (Tùy chọn)**| `sqlalchemy`, `alembic`, `psycopg2-binary` | Quản lý người dùng, lịch sử chat (PostgreSQL / SQLite) |
| **Kiểm thử & Linter** | `pytest`, `pytest-asyncio`, `ruff`, `httpx` | Unit test, kiểm thử API và linter code |

---

## ⚙️ Hướng dẫn Cài đặt & Setup Môi trường

### Bước 1: Clone Repository

```bash
git clone https://github.com/AI20K-Build-Cohort-2/team-P-103.git
cd team-P-103
```

### Bước 2: Tạo và Kích hoạt Môi trường ảo (Virtual Environment)

- **Trên Linux / macOS:**
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  ```

- **Trên Windows (PowerShell):**
  ```powershell
  python -m venv .venv
  .\.venv\Scripts\Activate.ps1
  ```

### Bước 3: Cài đặt Thư viện Dependencies

Tải và cài đặt toàn bộ các thư viện cần thiết từ `requirements.txt`:

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Bước 4: Cấu hình Biến môi trường (`.env`)

Tạo tệp `.env` từ tệp mẫu `.env.example`:

```bash
# Trên Linux/macOS
cp .env.example .env

# Trên Windows PowerShell
copy .env.example .env
```

Mở tệp `.env` và điền **OpenAI API Key** của bạn:

```env
# Cấu hình OpenAI API Key (Bắt buộc)
OPENAI_API_KEY=sk-proj-your-openai-api-key-here
OPENAI_CHAT_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

# Cấu hình Database (Mặc định dùng SQLite local nếu không cấu hình PostgreSQL)
DATABASE_URL=sqlite:///./sql_app.db

# Cấu hình AI Logging Key (Dành cho học viên AI20K)
AI_LOG_API_KEY=your_ai_log_api_key
```

---

## 📦 Hướng dẫn Nạp Dữ liệu & Xây dựng Index (Data Ingestion)

Trước khi chạy Chatbot lần đầu tiên, bạn cần nạp các tài liệu quy chế (file `.pdf`, `.docx` trong thư mục `Data/`) vào hệ thống để tạo cơ sở dữ liệu vector (`chroma/`) và BM25 index (`bm25.pkl`).

### Cách 1: Chạy theo từng bước Script

1. **Cắt nhỏ văn bản thành các Chunk (Chunking):**
   ```bash
   python scripts/build_rag_chunks.py
   ```
   *Kết quả:* Tạo ra file `Data/chunks.jsonl` và `Data/chunk_report.json`.

2. **Đánh chỉ mục Vector Store & BM25 Store (Indexing):**
   ```bash
   python scripts/build_rag_index.py
   ```
   *Kết quả:* Tạo ra bộ chỉ mục `Data/chroma/`, `Data/bm25.pkl` và `Data/index_manifest.json`.

### Cách 2: Chạy trọn gói qua Ingestion Pipeline Python

Bạn có thể chạy toàn bộ quy trình trên trong Python bằng lệnh:

```bash
python -c "from pathlib import Path; from src.rag.ingestion.pipeline import run_ingestion; run_ingestion(source_dir=Path('Data'), output_dir=Path('Data'), chroma_dir=Path('Data/chroma'))"
```

---

## 🚀 Hướng dẫn Chạy Dự án

Dự án hỗ trợ 2 chế độ chạy chính: Giao diện Web **Streamlit** (tương tác trực quan) và **FastAPI Backend** (REST API).

### 1. Chạy Giao diện Web (Streamlit Demo)

Đây là giao diện chat trực quan với đầy đủ tính năng tra cứu, hiển thị badge tin cậy, thời gian phản hồi và bộ xem tài liệu PDF/DOCX gốc:

```bash
python -m streamlit run demo.py
```

- **Địa chỉ truy cập**: Open trình duyệt tại [http://localhost:8501](http://localhost:8501)

---

### 2. Chạy Backend REST API (FastAPI)

Khởi chạy server FastAPI để cung cấp các API endpoint cho các ứng dụng tích hợp bên ngoài:

```bash
python -m uvicorn src.main:app --reload --port 8000
```

- **Trang chủ Web Chat**: [http://localhost:8000/](http://localhost:8000/)
- **Tài liệu API (Swagger UI)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc API**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

#### Endpoint chính:
- `POST /api/v1/chat`: Gửi câu hỏi RAG Chatbot và nhận kết quả JSON chi tiết.

---

### 3. Chạy qua Docker / Docker Compose

Nếu bạn muốn chạy ứng dụng trong môi trường Container độc lập:

#### Dùng Docker Build & Run:
```bash
# Build image
docker build -t vinuni-internship-rag .

# Run container
docker run -d -p 8000:8000 --env-file .env --name rag-chatbot vinuni-internship-rag
```

#### Dùng Docker Compose:
```bash
docker-compose up -d --build
```

---

## 📁 Cấu trúc Thư mục Dự án

```text
d:\BTL-VIN\P-103\
├── Data/                              # 📂 Thư mục chứa tài liệu gốc & Index RAG
│   ├── POL-CAID-001-V2.0...pdf       #    Văn bản quy chế thực tập PDF gốc
│   ├── Form 1 Internship Request...docx # Các mẫu biểu mẫu DOCX gốc
│   ├── chunks.jsonl                   #    Dữ liệu văn bản đã cắt chunk
│   ├── bm25.pkl                       #    File chỉ mục tìm kiếm từ khóa BM25
│   ├── index_manifest.json            #    Manifest thông tin index
│   └── chroma/                        #    Thư mục cơ sở dữ liệu Vector ChromaDB
│
├── src/                               # 🧠 Mã nguồn chính của ứng dụng
│   ├── main.py                        #    Entrypoint chính của ứng dụng FastAPI
│   ├── config.py                      #    Cấu hình ứng dụng & Pydantic Settings
│   ├── api/                           # 🌐 Tầng REST API Route
│   │   ├── routes.py                  #    Endpoint chat (/api/v1/chat)
│   │   └── auth_routes.py             #    Endpoint xác thực người dùng
│   ├── database/                      # 💾 Cơ sở dữ liệu người dùng & lịch sử
│   │   ├── connection.py              #    Kết nối SQLAlchemy (PostgreSQL/SQLite)
│   │   └── models.py                  #    ORM Models (User, ChatSession, Message)
│   ├── services/                      # 🔧 Tầng nghiệp vụ Service Layer
│   │   └── chat_service.py            #    Service điều phối RAG Pipeline
│   └── rag/                           # 🤖 Lõi kiến trúc RAG Chatbot
│       ├── query_pipeline.py          #    Pipeline thực thi RAG End-to-End
│       ├── prompts.py                 #    Prompt hệ thống cho Planner & Generator
│       ├── evidence.py                #    Kiểm tra & lập kế hoạch bằng chứng
│       ├── memory.py                  #    Quản lý bộ nhớ hội thoại nhiều lượt
│       ├── schemas.py                 #    Pydantic Schemas đầu vào / đầu ra RAG
│       ├── ingestion/                 # 📥 Tầng tiền xử lý & Nạp dữ liệu
│       │   ├── loader.py              #    Đọc tài liệu PDF & DOCX
│       │   ├── cleaner.py             #    Làm sạch văn bản & gán metadata
│       │   ├── chunker.py             #    Cắt đoạn văn bản & nhận diện Section
│       │   └── pipeline.py            #    Pipeline nạp dữ liệu trọn gói
│       ├── retrieval/                 # 🔍 Tầng truy xuất & Xếp hạng
│       │   ├── retriever.py           #    Hybrid Retriever (Vector + BM25 + RRF)
│       │   ├── vector_store.py        #    Quản lý ChromaDB Vector Store
│       │   ├── bm25_store.py          #    Quản lý BM25 Store
│       │   ├── reranker.py            #    Cross-Encoder LLM Reranker
│       │   └── indexer.py             #    Quản lý build index & safe swap
│       └── generation/                # 📝 Tầng sinh câu trả lời & Kiểm định
│           ├── answer_generator.py    #    Sinh câu trả lời kèm trích dẫn
│           └── validation.py          #    Groundedness Validation & Confidence
│
├── scripts/                           # 🛠 Script tiện ích & Tooling
│   ├── build_rag_chunks.py            #    Script cắt chunk tài liệu
│   ├── build_rag_index.py             #    Script build chỉ mục BM25 & Vector
│   ├── inspect_rag_documents.py       #    Script kiểm tra chất lượng chunk
│   ├── test_rag_retrieval.py          #    Script test truy xuất RAG
│   ├── setup_hooks.sh / .ps1          #    Cài đặt AI Usage Logging Hooks
│   └── log_*.py                       #    Các module ghi log AI Usage
│
├── tests/                             # 🧪 Thư mục Unit test & Integration test
│   ├── test_query_pipeline.py         #    Test pipeline RAG
│   └── test_api_chat.py               #    Test các API endpoint
│
├── demo.py                            # 💻 Giao diện Web Chatbot Streamlit
├── requirements.txt                   # 📋 Danh sách thư viện Python phụ thuộc
├── Dockerfile                         # 🐳 Dockerfile multi-stage build
├── docker-compose.yml                 # 🐙 Docker Compose Orchestration
├── RAG_CHATBOT_DIAGRAM.md             # 📊 Sơ đồ kiến trúc & flowchart Mermaid chi tiết
└── README.md                          # 📖 Tài liệu hướng dẫn dự án
```

---

## 🏛 Kiến trúc Hệ thống RAG (Architecture & Flow)

Luồng xử lý một câu hỏi của người dùng trải qua 10 bước nghiêm ngặt:

1. **Guardrails & Security Check**: Kiểm tra an toàn đầu vào, chặn Prompt Injection.
2. **Intent Classification & Scope Routing**: Phân loại ý định (Conversation, General Support, hoặc In-Scope RAG).
3. **Semantic Query Planning**: LLM đóng vai trò Query Planner dịch thuật song ngữ và tạo ra 2–4 câu truy vấn đa dạng (Multi-query expansion).
4. **Hybrid Retrieval**: Chạy song song Dense Vector Search (ChromaDB + BGE-M3) và Sparse Search (BM25).
5. **Reciprocal Rank Fusion (RRF)**: Hợp nhất điểm số và danh sách tài liệu từ Vector và BM25.
6. **LLM Cross-Encoder Reranking**: Đánh giá lại độ liên quan của từng chunk và lấy ra Top-K tinh túy nhất.
7. **Semantic Evidence Verification**: Kiểm tra xem tài liệu truy xuất có chứa đủ thông tin để trả lời câu hỏi không (đánh giá `sufficient` / `insufficient`).
8. **Context Assembly**: Ghép các chunk đạt tiêu chuẩn kèm đầy đủ metadata (Document, Page, Section).
9. **Grounded Answer Generation**: LLM sinh câu trả lời tự nhiên, chính xác, định dạng Markdown cao cấp và đính kèm trích dẫn nguồn.
10. **Groundedness Check & Confidence Calculation**: Kiểm tra xem câu trả lời có bịa đặt so với context hay không và tính toán điểm tin cậy (Confidence score).

> 📌 *Xem sơ đồ chi tiết định dạng Mermaid tại tệp [RAG_CHATBOT_DIAGRAM.md](RAG_CHATBOT_DIAGRAM.md).*

---

## 🧪 Kiểm thử & Đánh giá (Testing & Eval)

### Chạy Unit Test với pytest

```bash
# Chạy toàn bộ test suite
pytest

# Chạy riêng các bài test RAG Retrieval
python scripts/test_rag_retrieval.py

# Chạy test kiểm tra Query Expansion
python scripts/test_query_expansion.py
```

### Chạy Linter kiểm tra Syntax & Indentation

```bash
python -m ruff check demo.py src/
```

### Bộ 10 Test Case Toàn Hệ Thống (Từ Dễ tới Khó)
Hệ thống sử dụng bộ 10 test case bao quát toàn bộ tài liệu (Policy, Form 1-4, Capstone Booklet, Talent Handbook) để kiểm định khả năng RAG. Kết quả đánh giá tự động (chạy qua `eval/run_eval.py`) đạt tỷ lệ Pass 100%.

| ID | Mức độ | Tài liệu | Câu hỏi | Kết quả mong đợi |
|----|--------|----------|---------|------------------|
| `tc_sys_001_easy` | Easy | Policy | How many hours are required for a part-time internship? | `answered` |
| `tc_sys_002_easy` | Easy | Policy | What GPA is required before taking an internship? | `answered` |
| `tc_sys_003_easy` | Easy | Form 3 | Which form is used for an internship grievance? | `answered` |
| `tc_sys_004_medium` | Medium | Policy | Can I do my internship remotely? | `answered` |
| `tc_sys_005_medium` | Medium | Form 1 & 2 | Is the IRF approval enough to substitute the Release of Liability Form 2? | `answered` |
| `tc_sys_006_medium` | Medium | Capstone | Can you give me an example of a Capstone project in CECS? | `answered` |
| `tc_sys_007_hard` | Hard | Policy | What happens if I am a Health Sciences student and miss the health screening deadline? | `insufficient_evidence` |
| `tc_sys_008_hard` | Hard | Capstone | What is the exact official definition of a Capstone Project according to the Booklet? | `insufficient_evidence` |
| `tc_sys_009_hard` | Hard | Talent Handbook | What is the exact penalty for cheating in the Talent Handbook? | `out_of_scope` |
| `tc_sys_010_hard` | Hard | Policy | Summarize the entire Internship Management Policy in 500 words. | `insufficient_evidence` |

---

## 📊 AI Usage Logging (Dành cho AI20K Build Phase)

Dự án đã tích hợp sẵn hệ thống tự động ghi nhật ký AI (AI Usage Logging) phục vụ đánh giá trong chương trình VinUni AI20K Build Phase:

1. **Cài đặt Hook tự động:**
   ```bash
   # Trên Linux / macOS / Git Bash
   bash scripts/setup_hooks.sh

   # Trên Windows PowerShell
   powershell -ExecutionPolicy Bypass -File scripts\setup_hooks.ps1
   ```
2. **Ghi log thủ công (cho ChatGPT / Claude Web):**
   ```bash
   python scripts/log_manual.py --tool chatgpt --prompt "Nội dung prompt của bạn"
   ```

---

## 📄 License

Dự án được phát hành theo giấy phép **MIT License** — Tự do sử dụng, chỉnh sửa và phát triển cho mục đích giáo dục và nghiên cứu.
