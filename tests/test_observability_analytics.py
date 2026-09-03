from datetime import UTC, datetime, timedelta

from src.api import admin_observability_routes
from src.observability import analytics
from src.observability.langfuse_api import LangfuseAPIError


def _observation(name: str, start_ms: int, duration_ms: int, **extra):
    row = {
        'name': name,
        'startTime': f'2026-01-01T00:00:00.{start_ms:03d}Z',
        'endTime': f'2026-01-01T00:00:00.{start_ms + duration_ms:03d}Z',
    }
    row.update(extra)
    return row


def test_overview_returns_percentiles_and_real_evaluator_scores(monkeypatch):
    rows = [
        _observation('internova.chat', 0, duration)
        for duration in (100, 200, 300, 400)
    ]
    scores = [
        {'name': 'Faithfulness', 'value': 0.8},
        {'details': {'name': 'Answer Relevancy', 'numericValue': 0.6}},
    ]

    class FakeLangfuseAPI:
        def observations(self, **_kwargs):
            return rows, False

        def scores(self, **kwargs):
            assert 'names' not in kwargs
            return scores, False

    monkeypatch.setattr(analytics, 'LangfuseAPI', FakeLangfuseAPI)

    result = analytics.build_overview('24h')

    assert result['latency'] == {
        'p50_ms': 250.0,
        'p95_ms': 385.0,
        'p99_ms': 397.0,
        'avg_ms': 250.0,
    }
    assert result['quality']['faithfulness']['avg'] == 0.8
    assert result['quality']['answer_relevance']['avg'] == 0.6


def test_rag_analytics_exposes_reranker_fallback_reasons(monkeypatch):
    rows = [
        _observation(
            'internova.chat',
            0,
            100,
            metadata={'route_scope': 'rag', 'request_status': 'answered'},
        ),
        _observation(
            'rag.rerank',
            0,
            20,
            output={'hits': 3, 'used_llm': False, 'fallback_reason': 'no_cohere_api_key'},
        ),
        _observation(
            'rag.rerank',
            0,
            25,
            output={'hits': 3, 'used_llm': True, 'fallback_reason': None},
        ),
    ]

    class FakeLangfuseAPI:
        def observations(self, **_kwargs):
            return rows, False

        def scores(self, **_kwargs):
            return [], False

    monkeypatch.setattr(analytics, 'LangfuseAPI', FakeLangfuseAPI)

    result = analytics.build_rag_analytics('24h')

    assert result['rerank']['used_reranker_calls'] == 1
    assert result['rerank']['fallback_calls'] == 1
    assert result['rerank']['fallback_reasons'] == [
        {'reason': 'no_cohere_api_key', 'count': 1},
    ]


def test_observability_route_cache_reuses_fresh_payload():
    admin_observability_routes._CACHE.clear()
    calls = 0

    def loader():
        nonlocal calls
        calls += 1
        return {'requests': {'total': 7}}

    first = admin_observability_routes._handle('overview:24h', loader)
    second = admin_observability_routes._handle('overview:24h', loader)

    assert first == second == {'requests': {'total': 7}}
    assert calls == 1


def test_observability_route_cache_survives_temporary_langfuse_failure():
    admin_observability_routes._CACHE.clear()
    cached_at = datetime.now(UTC) - timedelta(minutes=5)
    admin_observability_routes._CACHE['overview:24h'] = {
        'payload': {'requests': {'total': 11}},
        'cached_at': cached_at.isoformat(),
    }

    def unavailable():
        raise LangfuseAPIError('temporary outage')

    result = admin_observability_routes._handle('overview:24h', unavailable)

    assert result['requests']['total'] == 11
    assert result['_meta']['stale'] is True
    assert result['_meta']['rate_limited'] is False
    assert result['_meta']['stale_reason'] == 'langfuse_unavailable'
