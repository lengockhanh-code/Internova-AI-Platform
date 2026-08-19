from __future__ import annotations

import io
import os
import sys
import zipfile
from pathlib import Path

import httpx


# ============================================================
# PATHS
# ============================================================

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"


# ============================================================
# SUPABASE CONFIG
# ============================================================

SUPABASE_URL = (
    os.getenv("SUPABASE_URL", "")
    .strip()
    .rstrip("/")
)

SUPABASE_SECRET_KEY = (
    os.getenv("SUPABASE_SECRET_KEY", "")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
).strip()

RAG_DATA_BUCKET = os.getenv(
    "RAG_DATA_BUCKET",
    "internova_private",
).strip()

RAG_DATA_OBJECT = os.getenv(
    "RAG_DATA_OBJECT",
    "data.zip",
).strip()


# ============================================================
# CHECK DATA
# ============================================================

def data_ready() -> bool:
    """
    Kiểm tra những artifact tối thiểu
    mà production RAG cần.
    """

    chroma_dir = DATA_DIR / "chroma"

    bm25_path = (
        DATA_DIR
        / "rag"
        / "bm25.pkl"
    )

    return (
        chroma_dir.exists()
        and chroma_dir.is_dir()
        and bm25_path.exists()
        and bm25_path.is_file()
    )


# ============================================================
# DOWNLOAD
# ============================================================

def download_archive() -> bytes:
    if not SUPABASE_URL:
        raise RuntimeError(
            "SUPABASE_URL is missing."
        )

    if not SUPABASE_SECRET_KEY:
        raise RuntimeError(
            "SUPABASE_SECRET_KEY is missing."
        )

    if not RAG_DATA_BUCKET:
        raise RuntimeError(
            "RAG_DATA_BUCKET is missing."
        )

    if not RAG_DATA_OBJECT:
        raise RuntimeError(
            "RAG_DATA_OBJECT is missing."
        )

    url = (
        f"{SUPABASE_URL}"
        f"/storage/v1/object/authenticated/"
        f"{RAG_DATA_BUCKET}/"
        f"{RAG_DATA_OBJECT}"
    )

    headers = {
        "apikey": SUPABASE_SECRET_KEY,
    }

    print(
        f"Downloading private RAG data: "
        f"{RAG_DATA_BUCKET}/{RAG_DATA_OBJECT}"
    )

    with httpx.Client(
        timeout=httpx.Timeout(
            connect=15.0,
            read=300.0,
            write=30.0,
            pool=15.0,
        ),
        follow_redirects=True,
    ) as client:
        response = client.get(
            url,
            headers=headers,
        )

        response.raise_for_status()

        print(
            "RAG archive downloaded: "
            f"{len(response.content) / 1024 / 1024:.2f} MB"
        )

        return response.content

# ============================================================
# SAFE EXTRACTION
# ============================================================

def safe_extract_zip(
    archive_bytes: bytes,
) -> None:
    DATA_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    destination = (
        DATA_DIR.resolve()
    )

    print(
        f"Extracting RAG data to: "
        f"{destination}"
    )

    with zipfile.ZipFile(
        io.BytesIO(archive_bytes)
    ) as archive:

        for member in archive.infolist():
            member_path = (
                destination
                / member.filename
            ).resolve()

            # Prevent zip-slip.
            if (
                destination
                not in member_path.parents
                and member_path
                != destination
            ):
                raise RuntimeError(
                    "Unsafe path found "
                    f"in ZIP: {member.filename}"
                )

        archive.extractall(
            destination
        )


# ============================================================
# MAIN
# ============================================================

def main() -> None:
    print(
        "Checking production RAG data..."
    )

    if data_ready():
        print(
            "RAG data already exists. "
            "Skipping download."
        )
        return

    archive_bytes = (
        download_archive()
    )

    safe_extract_zip(
        archive_bytes
    )

    if not data_ready():
        raise RuntimeError(
            "RAG archive was extracted, "
            "but required artifacts were "
            "not found. Expected at least: "
            "data/chroma/ and "
            "data/rag/bm25.pkl"
        )

    print(
        "Production RAG data is ready."
    )


if __name__ == "__main__":
    try:
        main()

    except Exception as exc:
        print(
            f"Failed to prepare "
            f"production RAG data: {exc}",
            file=sys.stderr,
        )

        sys.exit(1)