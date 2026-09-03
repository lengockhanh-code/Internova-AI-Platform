from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import pytest
from fastapi import HTTPException

from src.api.admin_knowledge_base_routes import require_admin
from src.services import admin_knowledge_base_service as service
from src.services import rag_index_service


class FakeResult:
    def __init__(self, first: Any = None) -> None:
        self._first = first

    def mappings(self) -> FakeResult:
        return self

    def first(self) -> Any:
        return self._first


class RecordingSession:
    def __init__(self, result: FakeResult) -> None:
        self.result = result
        self.parameters: dict[str, Any] = {}

    def execute(self, statement: Any, parameters: dict[str, Any] | None = None) -> FakeResult:
        self.parameters = parameters or {}
        return self.result


class RowsResult:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows

    def mappings(self) -> RowsResult:
        return self

    def all(self) -> list[dict[str, Any]]:
        return self.rows


class RepairSession:
    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows
        self.insert_parameters: list[dict[str, Any]] = []
        self.commits = 0

    def execute(self, statement: Any, parameters: dict[str, Any] | None = None):
        if parameters is None:
            return RowsResult(self.rows)
        self.insert_parameters.append(parameters)
        return FakeResult()

    def commit(self) -> None:
        self.commits += 1


def test_admin_guard_rejects_non_admin_role() -> None:
    with pytest.raises(HTTPException) as exc_info:
        require_admin({"id": 9, "role": "STUDENT"})

    assert exc_info.value.status_code == 403


def test_document_version_file_must_be_inside_upload_root(
    monkeypatch,
    tmp_path: Path,
) -> None:
    upload_root = tmp_path / "documents"
    upload_root.mkdir()
    outside_file = tmp_path / "private.pdf"
    outside_file.write_bytes(b"private")
    monkeypatch.setattr(service, "UPLOAD_ROOT", upload_root)
    db = RecordingSession(FakeResult({"file_url": str(outside_file)}))

    with pytest.raises(ValueError, match="outside the upload directory"):
        service.get_admin_knowledge_document_version_file(
            db,  # type: ignore[arg-type]
            document_id=3,
            version_id=7,
        )


def test_document_version_file_returns_safe_file_metadata(
    monkeypatch,
    tmp_path: Path,
) -> None:
    upload_root = tmp_path / "documents"
    version_dir = upload_root / "3" / "1.0"
    version_dir.mkdir(parents=True)
    document_file = version_dir / "internship-form.pdf"
    document_file.write_bytes(b"pdf")
    monkeypatch.setattr(service, "UPLOAD_ROOT", upload_root)
    db = RecordingSession(FakeResult({"file_url": str(document_file)}))

    result = service.get_admin_knowledge_document_version_file(
        db,  # type: ignore[arg-type]
        document_id=3,
        version_id=7,
    )

    assert result is not None
    assert result["filePath"] == document_file.resolve()
    assert result["fileName"] == "internship-form.pdf"
    assert result["mediaType"] == "application/pdf"
    assert db.parameters == {"document_id": 3, "version_id": 7}


def test_repair_restores_missing_version_from_managed_file(
    monkeypatch,
    tmp_path: Path,
) -> None:
    upload_root = tmp_path / "documents"
    version_dir = upload_root / "12" / "2.0"
    version_dir.mkdir(parents=True)
    document_file = version_dir / "policy.pdf"
    document_file.write_bytes(b"policy")
    monkeypatch.setattr(service, "PROJECT_ROOT", tmp_path)
    monkeypatch.setattr(service, "UPLOAD_ROOT", upload_root)
    db = RepairSession(
        [
            {
                "document_id": 12,
                "document_type": "PDF",
                "current_version": "2.0",
                "file_url": document_file.relative_to(tmp_path).as_posix(),
            }
        ]
    )

    repaired = service.repair_missing_managed_current_versions(
        db  # type: ignore[arg-type]
    )

    assert repaired == 1
    assert db.commits == 1
    assert db.insert_parameters == [
        {
            "document_id": 12,
            "version": "2.0",
            "file_url": document_file.relative_to(tmp_path).as_posix(),
            "file_hash": hashlib.sha256(b"policy").hexdigest(),
        }
    ]


def test_repair_ignores_file_outside_managed_upload_root(
    monkeypatch,
    tmp_path: Path,
) -> None:
    upload_root = tmp_path / "documents"
    upload_root.mkdir()
    outside_file = tmp_path / "private.pdf"
    outside_file.write_bytes(b"private")
    monkeypatch.setattr(service, "PROJECT_ROOT", tmp_path)
    monkeypatch.setattr(service, "UPLOAD_ROOT", upload_root)
    db = RepairSession(
        [
            {
                "document_id": 12,
                "document_type": "PDF",
                "current_version": "2.0",
                "file_url": outside_file.as_posix(),
            }
        ]
    )

    repaired = service.repair_missing_managed_current_versions(
        db  # type: ignore[arg-type]
    )

    assert repaired == 0
    assert db.insert_parameters == []
    assert db.commits == 0


def _configure_active_chunks(monkeypatch, tmp_path: Path) -> None:
    builds_root = tmp_path / "rag_builds"
    build_root = builds_root / "build-test"
    chunks_path = build_root / "rag" / "chunks.jsonl"
    chunks_path.parent.mkdir(parents=True)
    (build_root / "chroma").mkdir()
    pointer = tmp_path / "active_index.json"
    pointer.write_text(
        json.dumps({"chroma_dir": (build_root / "chroma").as_posix()}),
        encoding="utf-8",
    )
    chunks = [
        {
            "chunk_id": "policy_001",
            "document_name": "policy.pdf",
            "document_type": "policy",
            "source_priority": 1,
            "content_original": "Internship attendance policy",
            "content_vi": "Quy định chuyên cần thực tập",
            "language": "en",
            "page": 2,
            "section": "Attendance",
            "source_element_ids": ["policy.pdf|element:1"],
        },
        {
            "chunk_id": "form_001",
            "document_name": "request.docx",
            "document_type": "form",
            "source_priority": 2,
            "content_original": "Internship request form",
            "language": "en",
            "source_element_ids": [],
        },
    ]
    chunks_path.write_text(
        "\n".join(json.dumps(chunk, ensure_ascii=False) for chunk in chunks),
        encoding="utf-8",
    )
    monkeypatch.setattr(rag_index_service, "ACTIVE_INDEX_POINTER", pointer)
    monkeypatch.setattr(rag_index_service, "RAG_BUILDS_ROOT", builds_root)


def test_admin_chunks_support_search_filters_and_summary(
    monkeypatch,
    tmp_path: Path,
) -> None:
    _configure_active_chunks(monkeypatch, tmp_path)

    result = rag_index_service.list_admin_rag_chunks(
        search="chuyen can",
        document_type="policy",
        page=1,
        page_size=10,
    )

    assert result["activeBuildId"] == "build-test"
    assert result["summary"] == {
        "total": 2,
        "documents": 2,
        "translated": 1,
        "averageCharacters": 26,
    }
    assert result["total"] == 1
    assert result["items"][0]["chunkId"] == "policy_001"
    assert result["items"][0]["hasTranslation"] is True
    assert result["filters"]["documentTypes"] == ["form", "policy"]


def test_admin_chunk_detail_returns_full_content(
    monkeypatch,
    tmp_path: Path,
) -> None:
    _configure_active_chunks(monkeypatch, tmp_path)

    result = rag_index_service.get_admin_rag_chunk("policy_001")

    assert result["activeBuildId"] == "build-test"
    assert result["chunk"]["contentOriginal"] == "Internship attendance policy"
    assert result["chunk"]["contentVi"] == "Quy định chuyên cần thực tập"
    assert result["chunk"]["sourceElementIds"] == ["policy.pdf|element:1"]


def test_admin_chunk_detail_rejects_unknown_chunk(
    monkeypatch,
    tmp_path: Path,
) -> None:
    _configure_active_chunks(monkeypatch, tmp_path)

    with pytest.raises(ValueError, match="not found"):
        rag_index_service.get_admin_rag_chunk("missing")
