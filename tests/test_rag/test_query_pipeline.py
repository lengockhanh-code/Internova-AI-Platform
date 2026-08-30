from datetime import datetime

from src.rag import query_pipeline


def test_semantic_router_clock_context_falls_back_without_timezone_data(
    monkeypatch,
):
    def missing_timezone(_name: str):
        raise RuntimeError("timezone database missing")

    monkeypatch.setattr(query_pipeline, "ZoneInfo", missing_timezone)

    current_datetime, timezone_name = (
        query_pipeline._semantic_router_clock_context()
    )
    parsed_datetime = datetime.fromisoformat(current_datetime)

    assert timezone_name == "Asia/Ho_Chi_Minh"
    assert parsed_datetime.utcoffset().total_seconds() == 7 * 60 * 60
