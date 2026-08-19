from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.rag.chunker import build_chunks, write_chunks_jsonl
from src.rag.config import get_rag_paths
from src.rag.document_loader import load_document


def find_documents(source_dir: Path) -> list[Path]:
    return sorted(
        [
            path
            for path in source_dir.iterdir()
            if path.is_file() and path.suffix.lower() in {".pdf", ".docx"}
        ],
        key=lambda path: path.name.lower(),
    )


def main() -> int:
    paths = get_rag_paths()
    source_dir = ROOT / paths.source_dir
    output_dir = ROOT / paths.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    results = [load_document(path) for path in find_documents(source_dir)]
    chunks, report = build_chunks(results)

    chunks_path = output_dir / "chunks.jsonl"
    report_path = output_dir / "chunk_report.json"
    write_chunks_jsonl(chunks, chunks_path)
    report_path.write_text(
        json.dumps(report.model_dump(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(
        f"[rag] chunked {report.documents_chunked}/{report.documents_seen} documents "
        f"into {report.chunks_created} chunks"
    )
    for skipped in report.skipped_documents:
        print(f"[rag] skipped {skipped['document_name']}: {skipped['reason']}")
    print("[rag] manual chunk checks:")
    for term, matches in report.manual_checks.items():
        print(f"[rag]   {term}: {len(matches)} chunk match(es)")
    print(f"[rag] wrote {chunks_path.relative_to(ROOT)}")
    print(f"[rag] wrote {report_path.relative_to(ROOT)}")

    missing_checks = [
        term for term, matches in report.manual_checks.items() if not matches
    ]
    if missing_checks:
        print(f"[rag] missing required chunk checks: {missing_checks}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
