from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from src.rag.config import get_rag_paths
from src.rag.indexer import build_rag_index


def main() -> int:
    paths = get_rag_paths()
    output_dir = ROOT / paths.output_dir
    chunks_path = output_dir / "chunks.jsonl"
    chroma_dir = ROOT / paths.chroma_dir

    manifest = build_rag_index(
        chunks_path=chunks_path,
        output_dir=output_dir,
        chroma_dir=chroma_dir,
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(f"[rag] wrote {paths.output_dir / 'bm25.pkl'}")
    print(f"[rag] wrote {paths.output_dir / 'index_manifest.json'}")
    print(f"[rag] wrote {paths.chroma_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
