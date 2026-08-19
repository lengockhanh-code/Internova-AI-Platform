# 🎓 Internova AI — System Architecture & Data Flow Document

Tài liệu này tổng hợp toàn bộ **Sơ đồ Kiến trúc Thành phần (Component Architecture)** và **Sơ đồ Luồng Dữ liệu (Data Flow Diagram)** của Hệ thống VinUniversity Internship RAG Chatbot.

> 👁️ **File sơ đồ giao diện trực quan (Visual Interactive Diagram):** Bạn có thể mở trực tiếp tệp [docs/architecture_diagram.html](architecture_diagram.html) bằng bất kỳ trình duyệt web nào (Chrome, Edge, Firefox) để xem sơ đồ đồ họa tương tác tuyệt đẹp.

---

## 1. Sơ đồ Kiến trúc Thành phần Tổng quan (Component Architecture Diagram)

Hệ thống được thiết kế theo mô hình 5 tầng phân tách rõ ràng (5-Tier Architecture):

```mermaid
graph TB
    subgraph UI_Layer ["1. Client & Presentation Layer (Giao diện)"]
        StreamlitUI["Streamlit Web UI<br/>(demo.py)"]
        FastAPI_Web["FastAPI Web Client<br/>(src/main.py / static)"]
        Viewer["PDF / DOCX Viewer Component"]
    end

    subgraph API_Layer ["2. API & Service Layer (Backend)"]
        FastAPI_App["FastAPI REST App<br/>(src/main.py)"]
        Chat_Router["Chat Router Endpoint<br/>(src/api/routes.py)"]
        Auth_Router["Auth Router Endpoint<br/>(src/api/auth_routes.py)"]
        Chat_Service["Chat Service Coordinator<br/>(src/services/chat_service.py)"]
        DB_Layer[("SQLAlchemy Database<br/>PostgreSQL / SQLite")]
    end

    subgraph RAG_Engine ["3. End-to-End Semantic RAG Engine (src/rag/)"]
        Pipeline["Query Pipeline Controller<br/>(query_pipeline.py)"]
        Guardrails["Guardrails & Input Checker<br/>(validation.py)"]
        Router["Semantic Intent Router<br/>(classify_intent)"]
        Planner["Semantic Query Planner<br/>(plan_semantic_retrieval_queries)"]
        
        subgraph Retrieval_Sub ["Multi-Query Hybrid Retrieval & Rerank"]
            Retriever["Hybrid Retriever<br/>(retriever.py)"]
            VectorStore["ChromaDB Vector Store<br/>(BGE-M3 Embeddings)"]
            BM25Store["BM25 Lexical Store<br/>(bm25_store.py)"]
            RRF["Reciprocal Rank Fusion (RRF)"]
            Reranker["Cross-Encoder LLM Reranker<br/>(reranker.py)"]
        end

        subgraph Validation_Sub ["Evidence Check & Answer Generation"]
            EvidencePlan["Semantic Evidence Planner<br/>(plan_semantic_evidence)"]
            EvidenceSel["Semantic Evidence Selector<br/>(select_semantic_evidence)"]
            Generator["Grounded Answer Generator<br/>(answer_generator.py)"]
            Groundedness["Groundedness & Confidence Gate<br/>(check_groundedness)"]
        end
    end

    subgraph Ingestion_Pipeline ["4. Data Ingestion & Indexing (Offline)"]
        DocLoader["Document Loader<br/>(PDF / DOCX)"]
        Cleaner["Text Cleaner & Metadata Enricher"]
        Chunker["Semantic Chunker & Section Detector"]
        Indexer["Indexer Orchestrator<br/>(build_rag_index)"]
    end

    subgraph Storage_Layer ["5. Persistent Data Layer (Data/)"]
        RawDocs[("Raw PDFs & DOCXs<br/>(Data/*.pdf, *.docx)")]
        ChunksJSONL[("Chunks File<br/>(Data/chunks.jsonl)")]
        ChromaData[("Chroma Vector DB<br/>(Data/chroma/)")]
        BM25Data[("BM25 Index File<br/>(Data/bm25.pkl)")]
    end

    %% Connections
    StreamlitUI -->|HTTP / Direct| Chat_Service
    FastAPI_Web -->|POST /api/v1/chat| Chat_Router
    Chat_Router --> Chat_Service
    Auth_Router --> DB_Layer
    Chat_Service --> DB_Layer
    Chat_Service --> Pipeline

    Pipeline --> Guardrails
    Guardrails --> Router
    Router -->|In-Scope Query| Planner
    Planner --> Retriever

    Retriever --> VectorStore
    Retriever --> BM25Store
    VectorStore --> RRF
    BM25Store --> RRF
    RRF --> Reranker

    Reranker --> EvidencePlan
    EvidencePlan --> EvidenceSel
    EvidenceSel -->|Sufficient| Generator
    Generator --> Groundedness

    RawDocs --> DocLoader
    DocLoader --> Cleaner
    Cleaner --> Chunker
    Chunker --> Indexer
    Indexer --> ChunksJSONL
    Indexer --> ChromaData
    Indexer --> BM25Data

    VectorStore -.-> ChromaData
    BM25Store -.-> BM25Data
    StreamlitUI -.-> Viewer
    Viewer -.-> RawDocs
```

---

## 2. Sơ đồ Luồng Dữ liệu Xử lý Truy vấn (Query Execution Data Flow Sequence)

Sơ đồ trình tự chi tiết tương tác dữ liệu qua 10 bước trong `src/rag/query_pipeline.py`:

```mermaid
sequenceDiagram
    autonumber
    actor User as Người dùng (Client)
    participant UI as Streamlit / FastAPI UI
    participant Pipe as QueryPipeline
    participant Guard as Input Guardrails
    participant Router as Intent Router
    participant Planner as Semantic Query Planner
    participant Search as Hybrid Retriever (Vector + BM25)
    participant Rerank as Cross-Encoder Reranker
    participant Evidence as Semantic Evidence Checker
    participant LLM as Answer Generator (LLM)
    participant Gate as Groundedness & Confidence Gate

    User->>UI: Nhập câu hỏi (Query + Conversation Context)
    UI->>Pipe: run(query, memory, options)
    
    Pipe->>Guard: check_input(query)
    alt Phát hiện Prompt Injection / Malicious Input
        Guard-->>Pipe: Guardrail Violation
        Pipe-->>UI: Fallback Result (Lỗi an toàn)
    else Đầu vào Hợp lệ
        Guard-->>Pipe: OK
        
        Pipe->>Router: classify_intent(query)
        Router-->>Pipe: RouteDecision (intent, scope, language)
        
        alt Route = Out of Scope / Unsupported Language
            Pipe-->>UI: Fallback Result (Từ chối / Ngoài phạm vi)
        else Route = Conversation / General Support
            Pipe->>LLM: generate_conversation_answer / general_support
            LLM-->>Pipe: Conversational Response
            Pipe-->>UI: Trả lời trực tiếp (Skip RAG)
        else Route = In-Scope RAG (Internship / Career / Capstone)
            Pipe->>Planner: plan_semantic_retrieval_queries(query, context)
            Planner-->>Pipe: QueryExpansionResult (query_en + complementary search_queries)
            
            Pipe->>Search: retrieve(search_queries, top_k_vector, top_k_bm25)
            par Dense Vector Search
                Search->>Search: ChromaDB Vector Query (BGE-M3 Embeddings)
            and Sparse Keyword Search
                Search->>Search: BM25 Lexical Search
            end
            Search->>Search: Reciprocal Rank Fusion (RRF Score Aggregation)
            Search-->>Pipe: Fused Hits List
            
            Pipe->>Rerank: rerank_hits(query_en, fused_hits, top_k_rerank)
            Rerank->>Rerank: Score Chunks 0-10 & Fuse Retrieval + LLM Ranks
            Rerank-->>Pipe: Final Top-K Reranked Hits
            
            Pipe->>Evidence: check_evidence(query, final_hits, route)
            Evidence->>Evidence: plan_semantic_evidence() & select_semantic_evidence()
            Evidence-->>Pipe: EvidenceCheckResult (status: sufficient / insufficient)
            
            alt Evidence Status = Insufficient
                Pipe-->>UI: Fallback Result (Không tìm thấy đủ bằng chứng trong quy chế)
            else Evidence Status = Sufficient
                Pipe->>LLM: generate_answer_from_evidence(query, evidence_hits, context)
                LLM-->>Pipe: Generated Answer + Source Citations (Document, Page, Section)
                
                Pipe->>Gate: check_groundedness(answer, final_hits)
                Gate->>Gate: Fact-Token Support Verification & Calculate RAG Confidence Score
                Gate-->>Pipe: Groundedness Result & Confidence Score (0.0 - 1.0)
                
                Pipe-->>UI: QueryResult (Answer, Sources, Confidence, Latency_ms)
                UI-->>User: Hiển thị Phản hồi Markdown + Trích dẫn Nguồn + Bộ xem File Gốc
            end
        end
    end
```

---

## 3. Sơ đồ Luồng Nạp và Đánh chỉ mục Dữ liệu Offline (Data Ingestion Data Flow)

```mermaid
flowchart LR
    subgraph DocsInput ["1. Document Sources (Data/)"]
        PDF["POL-CAID-001...pdf<br/>(Quy chế thực tập)"]
        DOCX["Form 1 - 4...docx<br/>(Biểu mẫu thực tập)"]
    end

    subgraph LoaderCleaner ["2. Load & Clean (src/rag/ingestion/)"]
        Loader["loader.py<br/>(PyMuPDF / docx)"]
        Cleaner["cleaner.py<br/>(Text Normalization)"]
    end

    subgraph ChunkingEngine ["3. Chunk & Enrich"]
        Chunker["chunker.py<br/>(Semantic Chunker)"]
        SectionDetector["Section Detector<br/>(detect_section)"]
        Enricher["Metadata Enricher<br/>(enrich_chunks)"]
    end

    subgraph IndexingEngine ["4. Indexing Engine (src/rag/retrieval/)"]
        Indexer["indexer.py<br/>(build_rag_index)"]
        Embedder["OpenAI Embeddings<br/>(text-embedding-3-small)"]
        BM25Builder["BM25 Builder<br/>(bm25_store.py)"]
    end

    subgraph Outputs ["5. Generated RAG Artifacts (Data/)"]
        ChunksFile[("chunks.jsonl")]
        ChromaStore[("chroma/ Vector Store")]
        BM25File[("bm25.pkl Store")]
        Manifest[("index_manifest.json")]
    end

    PDF & DOCX --> Loader
    Loader --> Cleaner
    Cleaner --> Chunker
    Chunker --> SectionDetector
    SectionDetector --> Enricher
    Enricher --> ChunksFile

    ChunksFile --> Indexer
    Indexer --> Embedder
    Embedder --> ChromaStore

    Indexer --> BM25Builder
    BM25Builder --> BM25File

    Indexer --> Manifest
```

---

## 4. Mô tả chi tiết các thành phần chính trong hệ thống

| Component | Vị trí File Code | Công nghệ sử dụng | Nhiệm vụ chính |
| :--- | :--- | :--- | :--- |
| **Streamlit UI** | [demo.py](file:///d:/BTL-VIN/P-103/demo.py) | Streamlit | Giao diện Chatbot tương tác trực quan, hỗ trợ stream câu trả lời, xem file PDF/DOCX trực tiếp. |
| **FastAPI Backend** | [src/main.py](file:///d:/BTL-VIN/P-103/src/main.py), [src/api/routes.py](file:///d:/BTL-VIN/P-103/src/api/routes.py) | FastAPI, Pydantic | REST API Server xử lý yêu cầu chat, quản lý phiên đăng nhập và tài liệu OpenAPI / Swagger. |
| **Query Pipeline** | [src/rag/query_pipeline.py](file:///d:/BTL-VIN/P-103/src/rag/query_pipeline.py) | Python, LangChain | Controller chính thực thi toàn bộ luồng RAG 10 bước từ nhận query đến kiểm định đầu ra. |
| **Semantic Query Planner** | [src/rag/prompts.py](file:///d:/BTL-VIN/P-103/src/rag/prompts.py) | OpenAI LLM | Lập kế hoạch truy vấn đa chiều (Multi-query expansion) và dịch thuật ngữ nghĩa VI-EN. |
| **Hybrid Retriever** | [src/rag/retrieval/retriever.py](file:///d:/BTL-VIN/P-103/src/rag/retrieval/retriever.py) | ChromaDB, BM25, RRF | Tìm kiếm kết hợp giữa Dense Vector Search (BGE-M3) và Sparse Search (BM25) với thuật toán RRF. |
| **Cross-Encoder Reranker** | [src/rag/retrieval/reranker.py](file:///d:/BTL-VIN/P-103/src/rag/retrieval/reranker.py) | LLM Reranker | Đánh giá điểm độ liên quan 0-10 và xếp hạng lại Top-K chunk phù hợp nhất cho ngữ cảnh. |
| **Evidence Checker** | [src/rag/evidence.py](file:///d:/BTL-VIN/P-103/src/rag/evidence.py) | Structured LLM | Lập kế hoạch bằng chứng và xác thực tính đầy đủ (`sufficient`/`insufficient`) trước khi trả lời. |
| **Groundedness Gate** | [src/rag/generation/validation.py](file:///d:/BTL-VIN/P-103/src/rag/generation/validation.py) | Fact-Token Checker | Kiểm định xem câu trả lời có căn cứ trong tài liệu hay không và tính toán điểm tin cậy `Confidence %`. |
