from __future__ import annotations

from pathlib import Path
import gc

import chromadb
from chromadb.api.client import SharedSystemClient
from langchain_openai import OpenAIEmbeddings

from src.config import get_settings
from src.rag.schemas import DocumentChunk


COLLECTION_NAME = "internship_documents"


def build_embedding_text(chunk: DocumentChunk) -> str:
    """Build embedding text from document-derived content and metadata."""

    parts = [
        f"Document: {chunk.document_name}",
        f"Document type: {chunk.document_type}",
        f"Section: {chunk.section or ''}",
        f"Content: {chunk.content_original}",
    ]

    if chunk.content_vi:
        parts.append(
            f"Vietnamese support: {chunk.content_vi}"
        )

    return "\n".join(parts)


def chroma_metadata(chunk: DocumentChunk) -> dict[str, str | int | float | bool]:
    metadata = {
        "chunk_id": chunk.chunk_id,
        "document_name": chunk.document_name,
        "document_type": chunk.document_type,
        "source_priority": chunk.source_priority,
        "page": chunk.page,
        "section": chunk.section,
        "topic": chunk.topic,
        "policy_version": chunk.policy_version,
        "effective_date": chunk.effective_date,
    }
    return {key: value for key, value in metadata.items() if value is not None}


def build_chroma_store(
    chunks: list[DocumentChunk],
    persist_dir: Path,
    reuse_from_dir: Path | None = None,
) -> None:
    """Build a fresh Chroma store, reusing unchanged embeddings when safe.

    ``reuse_from_dir`` is optional and should only point to an index built with
    the same embedding model. Reuse is additionally guarded by an exact match
    of the stored embedding text, so a renamed/re-enriched chunk is re-embedded.
    """
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required to build the vector index")

    embedding_model = settings.openai_embedding_model
    embeddings = OpenAIEmbeddings(
        model=embedding_model,
        api_key=settings.openai_api_key,
    )

    documents = [build_embedding_text(chunk) for chunk in chunks]
    chunk_ids = [chunk.chunk_id for chunk in chunks]

    reusable = _load_reusable_embeddings(
        reuse_from_dir=reuse_from_dir,
        chunk_ids=chunk_ids,
        documents=documents,
    )

    missing_indices = [
        index
        for index, chunk_id in enumerate(chunk_ids)
        if chunk_id not in reusable
    ]

    new_vectors: list[list[float]] = []
    if missing_indices:
        new_vectors = embeddings.embed_documents(
            [documents[index] for index in missing_indices]
        )

    new_vector_by_index = {
        index: vector
        for index, vector in zip(
            missing_indices,
            new_vectors,
            strict=True,
        )
    }

    vectors: list[list[float]] = []
    for index, chunk_id in enumerate(chunk_ids):
        reused_vector = reusable.get(chunk_id)
        if reused_vector is not None:
            vectors.append(reused_vector)
        else:
            vectors.append(new_vector_by_index[index])

    client = chromadb.PersistentClient(path=str(persist_dir))
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass

    collection = client.create_collection(
        COLLECTION_NAME,
        metadata={"embedding_model": embedding_model},
    )
    collection.add(
        ids=chunk_ids,
        documents=documents,
        embeddings=vectors,
        metadatas=[chroma_metadata(chunk) for chunk in chunks],
    )

    del collection
    del client
    SharedSystemClient.clear_system_cache()
    gc.collect()


def _load_reusable_embeddings(
    reuse_from_dir: Path | None,
    chunk_ids: list[str],
    documents: list[str],
) -> dict[str, list[float]]:
    """Load embeddings for unchanged chunks from the previous Chroma index."""
    if reuse_from_dir is None:
        return {}

    reuse_from_dir = Path(reuse_from_dir)
    if not reuse_from_dir.exists() or not chunk_ids:
        return {}

    client = None
    collection = None

    try:
        client = chromadb.PersistentClient(path=str(reuse_from_dir))
        collection = client.get_collection(COLLECTION_NAME)

        response = collection.get(
            ids=chunk_ids,
            include=["documents", "embeddings"],
        )

        old_ids = response.get("ids") or []
        old_documents = response.get("documents") or []
        old_embeddings = response.get("embeddings")

        if old_embeddings is None:
            return {}

        current_document_by_id = dict(zip(chunk_ids, documents, strict=True))
        reusable: dict[str, list[float]] = {}

        for chunk_id, old_document, old_embedding in zip(
            old_ids,
            old_documents,
            old_embeddings,
            strict=False,
        ):
            if current_document_by_id.get(chunk_id) != old_document:
                continue
            if old_embedding is None:
                continue

            if hasattr(old_embedding, "tolist"):
                vector = old_embedding.tolist()
            else:
                vector = list(old_embedding)

            reusable[str(chunk_id)] = [
                float(value)
                for value in vector
            ]

        return reusable

    except Exception:
        # Reuse is an optimization only. Any compatibility/read problem simply
        # falls back to embedding all chunks from scratch.
        return {}

    finally:
        if collection is not None:
            del collection
        if client is not None:
            del client
        SharedSystemClient.clear_system_cache()
        gc.collect()