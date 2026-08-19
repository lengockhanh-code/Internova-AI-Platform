from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.rag.query_expander import build_bilingual_queries


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


SAMPLE_QUERIES = [
    "Thực tập bán thời gian cần tối thiểu bao nhiêu giờ mỗi học kỳ?",
    "Sinh viên cần GPA tối thiểu bao nhiêu để đăng ký thực tập có tín chỉ?",
    "Sinh viên sử dụng biểu mẫu nào để báo cáo một sự cố tại nơi thực tập?",
    "What form should I use to report an internship incident?",
]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--use-openai", action="store_true")
    parser.add_argument("queries", nargs="*")
    args = parser.parse_args()

    queries = args.queries or SAMPLE_QUERIES
    for query in queries:
        result = build_bilingual_queries(query, use_openai=args.use_openai)
        print(json.dumps(result.model_dump(), ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
