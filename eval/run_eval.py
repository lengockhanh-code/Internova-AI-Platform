"""
eval/run_eval.py
================
Runner chạy 15 testcase từ rag_tests.json qua chat_service thật.

Cách chạy:
    python eval/run_eval.py

Kết quả ghi ra:
    eval/results/evaluation_report.json
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# Đảm bảo import được src/ từ gốc project
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.services.chat_service import chat_service  # noqa: E402

TESTS_PATH   = ROOT / "eval" / "rag_tests.json"
RESULTS_DIR  = ROOT / "eval" / "results"
REPORT_PATH  = RESULTS_DIR / "evaluation_report.json"

RESULTS_DIR.mkdir(parents=True, exist_ok=True)


# ─────────────────────────────────────────────────
# Đánh giá 1 testcase
# ─────────────────────────────────────────────────
def evaluate_case(case: dict, result) -> dict:
    """So sánh kết quả RAG với expected trong testcase."""

    answer        = getattr(result, "answer", "") or ""
    answer_status = getattr(result, "answer_status", "") or ""
    sources       = getattr(result, "sources", []) or []

    source_names = [
        getattr(s, "document_name", "") or (s.get("document_name", "") if isinstance(s, dict) else "")
        for s in sources
    ]

    failures: list[str] = []

    # 1. Kiểm tra expected_status
    if answer_status != case["expected_status"]:
        failures.append(
            f"expected_status={case['expected_status']!r}, "
            f"actual={answer_status!r}"
        )

    # 2. required_facts phải có trong câu trả lời
    for fact in case.get("required_facts", []):
        if fact.lower() not in answer.lower():
            failures.append(f"missing required_fact: {fact!r}")

    # 3. forbidden_facts không được xuất hiện
    for fact in case.get("forbidden_facts", []):
        if fact.lower() in answer.lower():
            failures.append(f"contains forbidden_fact: {fact!r}")

    # 4. required_source_patterns phải có trong sources
    for pattern in case.get("required_source_patterns", []):
        if not any(pattern in name for name in source_names):
            failures.append(f"missing required_source_pattern: {pattern!r}")

    # 5. forbidden_source_patterns không được có trong sources
    for pattern in case.get("forbidden_source_patterns", []):
        if any(pattern in name for name in source_names):
            failures.append(f"contains forbidden_source_pattern: {pattern!r}")

    # 6. not_found không được có sources
    if case["expected_status"] == "not_found" and sources:
        failures.append("not_found case returned sources (hallucination risk)")

    return {
        "id":              case["id"],
        "category":        case.get("category", ""),
        "query":           case["query"],
        "expected_status": case["expected_status"],
        "actual_status":   answer_status,
        "passed":          len(failures) == 0,
        "failures":        failures,
        "answer":          answer[:400] + "..." if len(answer) > 400 else answer,
        "source_count":    len(sources),
        "source_names":    source_names,
    }


# ─────────────────────────────────────────────────
# Tổng hợp kết quả
# ─────────────────────────────────────────────────
def summarize(cases: list[dict]) -> dict:
    total         = len(cases)
    passed        = sum(1 for c in cases if c["passed"])
    not_found     = [c for c in cases if c["expected_status"] == "not_found"]
    hallucinated  = [c for c in not_found if not c["passed"]]

    by_category: dict[str, dict] = {}
    for c in cases:
        cat = c.get("category", "unknown")
        by_category.setdefault(cat, {"total": 0, "passed": 0})
        by_category[cat]["total"] += 1
        if c["passed"]:
            by_category[cat]["passed"] += 1

    return {
        "total":                    total,
        "passed":                   passed,
        "failed":                   total - passed,
        "pass_rate":                round(passed / total, 3) if total else 0.0,
        "hallucination_rate":       round(len(hallucinated) / len(not_found), 3) if not_found else 0.0,
        "by_category":              by_category,
    }


# ─────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────
def main() -> None:
    tests = json.loads(TESTS_PATH.read_text(encoding="utf-8"))
    total = len(tests)

    print(f"\n{'='*55}")
    print(f"  Internova RAG Eval — {total} testcase(s)")
    print(f"{'='*55}\n")

    report_cases: list[dict] = []

    for idx, case in enumerate(tests, 1):
        tc_id    = case["id"]
        category = case.get("category", "")
        query    = case["query"]

        print(f"[{idx:02d}/{total}] {tc_id} ({category})")
        print(f"       Q: {query[:90]}{'...' if len(query) > 90 else ''}")

        try:
            result       = chat_service.ask(query)
            case_report  = evaluate_case(case, result)
            status_icon  = "[PASS]" if case_report["passed"] else "[FAIL]"
            print(f"       {status_icon} | status={case_report['actual_status']} | sources={case_report['source_count']}")

            if not case_report["passed"]:
                for failure in case_report["failures"]:
                    print(f"         -> {failure}")

        except Exception as exc:
            case_report = {
                "id":              tc_id,
                "category":        category,
                "query":           query,
                "expected_status": case.get("expected_status", ""),
                "actual_status":   "error",
                "passed":          False,
                "failures":        [f"exception: {exc}"],
                "answer":          "",
                "source_count":    0,
                "source_names":    [],
            }
            print(f"       [ERROR]: {exc}")

        report_cases.append(case_report)
        print()

    summary = summarize(report_cases)

    report = {
        "run_at":   datetime.now(timezone.utc).isoformat(),
        "summary":  summary,
        "cases":    report_cases,
    }

    REPORT_PATH.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"{'='*55}")
    print(f"  SUMMARY")
    print(f"  Total   : {summary['total']}")
    print(f"  Passed  : {summary['passed']}")
    print(f"  Failed  : {summary['failed']}")
    print(f"  Pass %  : {summary['pass_rate']*100:.1f}%")
    print(f"  Halluc. : {summary['hallucination_rate']*100:.1f}%")
    print(f"{'='*55}")
    print(f"\n  Report  -> {REPORT_PATH}\n")


if __name__ == "__main__":
    main()
