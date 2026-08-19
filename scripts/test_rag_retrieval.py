from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from src.rag.config import get_rag_paths
from src.rag.retriever import HybridRetriever, RetrievalHit


DEFAULT_TESTS_PATH = ROOT / "eval/retrieval_tests.json"
DEFAULT_OUTPUT_PATH = ROOT / "data/rag/retrieval_report.json"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--use-openai-translation", action="store_true")
    parser.add_argument("--tests", default=str(DEFAULT_TESTS_PATH))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT_PATH))
    args = parser.parse_args()

    report = run_retrieval_evaluation(
        tests_path=Path(args.tests),
        output_path=Path(args.output),
        use_openai_translation=args.use_openai_translation,
    )

    print(json.dumps(report["summary"], ensure_ascii=False, indent=2))
    fail_cases = [case for case in report["cases"] if not case["passed"]]
    if fail_cases:
        print("[rag] failing cases:")
        for case in fail_cases:
            print(
                f"[rag]   {case['id']}: gold_rank={case['gold_rank']} "
                f"category={case['category']}"
            )
    print(f"[rag] wrote {Path(args.output).relative_to(ROOT)}")
    return 0 if report["summary"]["passed"] else 1


def run_retrieval_evaluation(
    tests_path: Path,
    output_path: Path,
    use_openai_translation: bool,
) -> dict[str, Any]:
    test_cases = json.loads(tests_path.read_text(encoding="utf-8"))
    paths = get_rag_paths()
    retriever = HybridRetriever(
        chroma_dir=ROOT / paths.chroma_dir,
        bm25_path=ROOT / paths.output_dir / "bm25.pkl",
    )

    case_reports = []
    for test_case in test_cases:
        result = retriever.retrieve(
            test_case["question"],
            top_k_vector=20,
            top_k_bm25=20,
            top_k_fused=test_case.get("expected_top_k", 5),
            use_openai_translation=use_openai_translation,
            allowed_document_types=test_case.get("allowed_document_types"),
        )
        case_reports.append(evaluate_case(test_case, result))

    summary = summarize(case_reports)
    report = {"summary": summary, "cases": case_reports}
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return report


def evaluate_case(test_case: dict[str, Any], result) -> dict[str, Any]:
    vector_ranks = {hit.chunk_id: hit.rank for hit in result.vector_hits}
    bm25_ranks = {hit.chunk_id: hit.rank for hit in result.bm25_hits}
    top_hits = [
        hit_to_report(hit, vector_ranks, bm25_ranks)
        for hit in result.fused_hits
    ]
    expected_behavior = test_case["expected_behavior"]
    gold_rank = find_gold_rank(test_case.get("gold_text_contains", []), result.fused_hits)
    gold_found = gold_rank is not None
    wrong_source_hits = find_wrong_source_hits(
        top_hits,
        test_case.get("allowed_document_types", []),
    )
    duplicate_rate = duplicate_chunk_rate(top_hits)
    negative_false_positive = has_negative_direct_evidence_false_positive(
        test_case,
        result.fused_hits,
    )
    context_precision = context_precision_at_k(test_case, result.fused_hits)

    if expected_behavior == "has_evidence":
        passed = gold_found and gold_rank <= test_case.get("expected_top_k", 5) and not wrong_source_hits
    else:
        passed = not negative_false_positive and not wrong_source_hits

    return {
        "id": test_case["id"],
        "category": test_case["category"],
        "question": test_case["question"],
        "expected_behavior": expected_behavior,
        "query_vi": result.expanded_query.query_vi,
        "query_en": result.expanded_query.query_en,
        "search_queries": result.expanded_query.search_queries,
        "used_openai_translation": result.expanded_query.used_openai,
        "gold_documents": test_case.get("gold_documents", []),
        "gold_text_contains": test_case.get("gold_text_contains", []),
        "gold_found": gold_found,
        "gold_rank": gold_rank,
        "context_precision_at_5": context_precision,
        "wrong_source_hits": wrong_source_hits,
        "duplicate_chunk_rate": duplicate_rate,
        "negative_direct_evidence_false_positive": negative_false_positive,
        "passed": passed,
        "top_5": top_hits,
    }


def hit_to_report(
    hit: RetrievalHit,
    vector_ranks: dict[str, int],
    bm25_ranks: dict[str, int],
) -> dict[str, Any]:
    return {
        "rank": hit.rank,
        "chunk_id": hit.chunk_id,
        "document": hit.chunk.document_name,
        "document_type": hit.chunk.document_type,
        "page": hit.chunk.page,
        "section": hit.chunk.section,
        "topic": hit.chunk.topic,
        "vector_rank": vector_ranks.get(hit.chunk_id),
        "bm25_rank": bm25_ranks.get(hit.chunk_id),
        "rrf_score": round(hit.score, 8),
        "content_preview": hit.chunk.content_original[:500],
    }


def find_gold_rank(gold_terms: list[str], hits: list[RetrievalHit]) -> int | None:
    if not gold_terms:
        return None
    combined = ""
    for hit in hits:
        combined += "\n" + hit.chunk.content_original
        lower_combined = combined.lower()
        if all(term.lower() in lower_combined for term in gold_terms):
            return hit.rank
    return None


def find_wrong_source_hits(
    top_hits: list[dict[str, Any]],
    allowed_document_types: list[str],
) -> list[dict[str, Any]]:
    if not allowed_document_types:
        return []
    allowed = set(allowed_document_types)
    return [
        {
            "rank": hit["rank"],
            "chunk_id": hit["chunk_id"],
            "document_type": hit["document_type"],
            "document": hit["document"],
        }
        for hit in top_hits
        if hit["document_type"] not in allowed
    ]


def duplicate_chunk_rate(top_hits: list[dict[str, Any]]) -> float:
    if not top_hits:
        return 0.0
    counts = Counter(hit["chunk_id"] for hit in top_hits)
    duplicate_count = sum(count - 1 for count in counts.values() if count > 1)
    return duplicate_count / len(top_hits)


def has_negative_direct_evidence_false_positive(
    test_case: dict[str, Any],
    hits: list[RetrievalHit],
) -> bool:
    if test_case["expected_behavior"] != "no_direct_evidence":
        return False
    terms = test_case.get("direct_evidence_false_positive_terms", [])
    if not terms:
        return False
    combined = "\n".join(hit.chunk.content_original for hit in hits).lower()
    return any(term.lower() in combined for term in terms)


def context_precision_at_k(test_case: dict[str, Any], hits: list[RetrievalHit]) -> float:
    if not hits:
        return 0.0
    if test_case["expected_behavior"] == "no_direct_evidence":
        return 0.0
    relevant_terms = [
        *test_case.get("gold_text_contains", []),
        *test_case.get("relevant_text_contains", []),
    ]
    if not relevant_terms:
        return 0.0
    relevant = 0
    for hit in hits:
        text = hit.chunk.content_original.lower()
        if any(term.lower() in text for term in relevant_terms):
            relevant += 1
    return relevant / len(hits)


def summarize(case_reports: list[dict[str, Any]]) -> dict[str, Any]:
    positive_cases = [
        case for case in case_reports if case["expected_behavior"] == "has_evidence"
    ]
    negative_cases = [
        case for case in case_reports if case["expected_behavior"] == "no_direct_evidence"
    ]
    hit_at_1 = hit_at_k(positive_cases, 1)
    hit_at_3 = hit_at_k(positive_cases, 3)
    hit_at_5 = hit_at_k(positive_cases, 5)
    mrr = mean_reciprocal_rank(positive_cases)
    all_top_hits = sum((case["top_5"] for case in case_reports), [])
    wrong_source_total = sum(len(case["wrong_source_hits"]) for case in case_reports)
    negative_false_positives = sum(
        1 for case in negative_cases if case["negative_direct_evidence_false_positive"]
    )
    duplicate_rates = [case["duplicate_chunk_rate"] for case in case_reports]
    precision_values = [
        case["context_precision_at_5"]
        for case in positive_cases
    ]
    category_counts = Counter(case["category"] for case in case_reports)
    fail_cases = [case["id"] for case in case_reports if not case["passed"]]

    metrics = {
        "total_cases": len(case_reports),
        "positive_cases": len(positive_cases),
        "negative_cases": len(negative_cases),
        "category_counts": dict(sorted(category_counts.items())),
        "hit_at_1": round(hit_at_1, 4),
        "hit_at_3": round(hit_at_3, 4),
        "hit_at_5": round(hit_at_5, 4),
        "mrr": round(mrr, 4),
        "context_precision_at_5": round(average(precision_values), 4),
        "wrong_source_rate": round(wrong_source_total / max(1, len(all_top_hits)), 4),
        "duplicate_chunk_rate": round(average(duplicate_rates), 4),
        "negative_false_positive_rate": round(
            negative_false_positives / max(1, len(negative_cases)),
            4,
        ),
        "failed_cases": fail_cases,
    }
    metrics["passed"] = (
        metrics["hit_at_5"] == 1.0
        and metrics["hit_at_3"] >= 0.9
        and metrics["hit_at_1"] >= 0.75
        and metrics["mrr"] >= 0.85
        and metrics["wrong_source_rate"] == 0.0
        and metrics["negative_false_positive_rate"] == 0.0
        and not fail_cases
    )
    return metrics


def hit_at_k(cases: list[dict[str, Any]], k: int) -> float:
    if not cases:
        return 0.0
    hits = sum(1 for case in cases if case["gold_rank"] is not None and case["gold_rank"] <= k)
    return hits / len(cases)


def mean_reciprocal_rank(cases: list[dict[str, Any]]) -> float:
    if not cases:
        return 0.0
    return sum(1 / case["gold_rank"] if case["gold_rank"] else 0.0 for case in cases) / len(cases)


def average(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


if __name__ == "__main__":
    raise SystemExit(main())
