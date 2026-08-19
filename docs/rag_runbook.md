# Internship RAG Runbook

This runbook explains how to run, test, and inspect the internship QA chatbot.

## 1. Prepare Environment

Run from the repository root:

```powershell
cd D:\BTL-VIN\P-103
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `.env` from `.env.example`, then fill in:

```text
OPENAI_API_KEY=...
AI_LOG_API_KEY=...
```

Do not commit `.env`.

## 2. Build RAG Artifacts

Extraction:

```powershell
python scripts\inspect_rag_documents.py
```

Chunking:

```powershell
python scripts\build_rag_chunks.py
```

Indexing:

```powershell
python scripts\build_rag_index.py
```

Expected local outputs:

```text
Data/rag/extraction_report.json
Data/rag/chunk_report.json
Data/rag/chunks.jsonl
Data/rag/bm25.pkl
Data/rag/index_manifest.json
Data/chroma/
```

`VinUni-Talent-Handbook-FINAL.pdf` is currently marked `requires_ocr`, so it is not included in the early RAG index.

## 3. Run Tests

Fast local test suite:

```powershell
python -m pytest tests eval\test_rag_router.py eval\test_rag_evidence.py eval\test_rag_answer_generator.py eval\test_rag_groundedness.py eval\test_rag_graph_workflow.py eval\test_rag_agent.py -p no:cacheprovider
```

Expected result:

```text
54 passed
```

Retrieval evaluation:

```powershell
python scripts\test_rag_retrieval.py --use-openai-translation
```

Gold answer evaluation:

```powershell
python -m pytest eval\test_rag_agent.py -p no:cacheprovider
```

Then inspect:

```text
eval/evaluation_report.json
```

Expected summary:

```json
{
  "total": 5,
  "passed": 5,
  "failed": 0,
  "answered_passed": 3,
  "not_found_passed": 2,
  "hallucination_rate_not_found": 0.0
}
```

## 4. Run the App

Start FastAPI:

```powershell
python -m uvicorn src.main:app --reload --port 8000
```

Open:

```text
http://127.0.0.1:8000/
```

If port 8000 is busy:

```powershell
python -m uvicorn src.main:app --port 8001
```

Open:

```text
http://127.0.0.1:8001/
```

## 5. Manual Smoke Questions

Questions that should return grounded answers with sources:

```text
How many hours are required for a part-time internship?
What GPA is required before taking an internship?
Which form is used for an internship grievance?
```

Questions that should refuse with no sources:

```text
What is the internship submission deadline in August 2026?
What is the personal email of the faculty mentor?
What is the weather today?
```

Good signs:

- `answered` responses have at least one source.
- `not_found`, `insufficient_evidence`, and `out_of_scope` responses have `sources = []`.
- Quotes shown in sources are direct text from the retrieved chunk.
- No answer invents deadlines, emails, or form names.

## 6. Submit AI Logs

Manual log for a prompt:

```powershell
python scripts\log_manual.py --tool codex --model gpt-5 --prompt "your prompt here"
```

Submit pending logs:

```powershell
python scripts\submit_log.py
```

Expected success:

```text
[ai-log] Submitted N entries -> 202
```

If submit fails, logs are kept locally in `.ai-log/session.jsonl` or a pending file. Do not delete `.ai-log`.

## 7. Cleanup Checklist Before Commit

Check status:

```powershell
git status --porcelain=v1 --untracked-files=all
```

Do not commit:

```text
.env
.ai-log/*.jsonl
.ai-log/archive/
Data/chroma/ if the team decides index artifacts are too large
```

Make sure no secret is staged:

```powershell
rg -n "sk-|OPENAI_API_KEY=sk|AI_LOG_API_KEY=[A-Za-z0-9_-]{20,}" . -g "!.env" -g "!.ai-log/**"
```
