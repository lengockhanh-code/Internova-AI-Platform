from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.rag.config import get_rag_paths
from src.rag.document_loader import load_document


MANUAL_CHECKS = [
    "240 hours",
    "2.0 overall GPA",
    "Statement of Internship Grievance",
    "Withdrawal",
    "Evaluation",
]

CRITICAL_DOCUMENT_PATTERNS = [
    "POL-CAID-001-V2.0_Internship-Management-Policy",
    "Form-1-Internship-Request-Form-IRF",
    "Form-2-Release-of-Liability-Hold-Harmless-Agreement",
    "Form-3-Statement-of-Internship-Grievance",
    "Form-4-Sample-Evaluations",
]


def find_documents(source_dir: Path) -> list[Path]:
    return sorted(
        [
            path
            for path in source_dir.iterdir()
            if path.is_file() and path.suffix.lower() in {".pdf", ".docx"}
        ],
        key=lambda path: path.name.lower(),
    )


def check_terms(results) -> dict[str, list[dict]]:
    checks: dict[str, list[dict]] = {}
    for term in MANUAL_CHECKS:
        matches = []
        needle = term.lower()
        for result in results:
            for element in result.elements:
                haystack = element.text.lower()
                if needle in haystack:
                    matches.append(
                        {
                            "document_name": result.document_name,
                            "page": element.page,
                            "element_type": element.element_type,
                            "element_index": element.element_index,
                            "snippet": make_snippet(element.text, term),
                        }
                    )
                    break
        checks[term] = matches
    return checks


def make_snippet(text: str, term: str, window: int = 120) -> str:
    lower_text = text.lower()
    index = lower_text.find(term.lower())
    if index < 0:
        return text[: window * 2]
    start = max(0, index - window)
    end = min(len(text), index + len(term) + window)
    return text[start:end].strip()


def main() -> int:
    paths = get_rag_paths()
    source_dir = ROOT / paths.source_dir
    output_dir = ROOT / paths.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    documents = find_documents(source_dir)
    results = [load_document(path) for path in documents]

    report = {
        "source_dir": str(paths.source_dir),
        "documents_expected": 7,
        "documents_found": len(documents),
        "documents": [result.report() for result in results],
        "skipped_documents": [
            {
                "document_name": result.document_name,
                "reason": "requires_ocr",
            }
            for result in results
            if result.status == "requires_ocr"
        ],
        "manual_checks": check_terms(results),
    }

    report_path = output_dir / "extraction_report.json"
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"[rag] inspected {len(documents)} documents")
    for item in report["documents"]:
        print(
            "[rag] {document_name}: status={status}, pages={pages}, "
            "paragraphs={paragraphs}, tables={tables}, chars={characters_extracted}, "
            "errors={errors_count}".format(
                **item,
                errors_count=len(item["errors"]),
            )
        )
    print("[rag] manual checks:")
    for term, matches in report["manual_checks"].items():
        print(f"[rag]   {term}: {len(matches)} match(es)")
    print(f"[rag] wrote {report_path.relative_to(ROOT)}")

    failed = [result.document_name for result in results if result.status == "failed"]
    critical_missing = find_missing_critical_documents(results)
    missing_checks = [
        term for term, matches in report["manual_checks"].items() if not matches
    ]
    if len(documents) != 7 or failed or critical_missing or missing_checks:
        print(
            "[rag] extraction incomplete. "
            f"failed={failed}, critical_missing={critical_missing}, "
            f"missing_checks={missing_checks}",
            file=sys.stderr,
        )
        return 1
    return 0


def find_missing_critical_documents(results) -> list[str]:
    missing = []
    for pattern in CRITICAL_DOCUMENT_PATTERNS:
        matched = [
            result
            for result in results
            if pattern.lower() in result.document_name.lower()
        ]
        if not matched or matched[0].status not in {"success", "partial"}:
            missing.append(pattern)
    return missing


if __name__ == "__main__":
    raise SystemExit(main())
