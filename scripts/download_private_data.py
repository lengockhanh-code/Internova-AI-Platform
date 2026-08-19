from __future__ import annotations

import io
import os
import shutil
import sys
import tempfile
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
    os.getenv(
        "SUPABASE_URL",
        "",
    )
    .strip()
    .rstrip("/")
)

SUPABASE_SECRET_KEY = (
    os.getenv(
        "SUPABASE_SECRET_KEY",
        "",
    )
    or os.getenv(
        "SUPABASE_SERVICE_ROLE_KEY",
        "",
    )
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
# REQUIRED RAG ARTIFACTS
# ============================================================

def data_ready(
    base_dir: Path | None = None,
) -> bool:
    """
    Kiểm tra những artifact tối thiểu
    mà RAG production cần.

    Hỗ trợ kiểm tra DATA_DIR thật hoặc
    staging directory trong lúc extract.
    """

    base = (
        base_dir
        if base_dir is not None
        else DATA_DIR
    )

    chroma_dir = (
        base
        / "chroma"
    )

    bm25_path = (
        base
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
    """
    Download private data.zip from
    Supabase Storage.
    """

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
        "apikey":
            SUPABASE_SECRET_KEY,
    }

    print(
        "Downloading private RAG data: "
        f"{RAG_DATA_BUCKET}/"
        f"{RAG_DATA_OBJECT}"
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

        archive_size_mb = (
            len(response.content)
            / 1024
            / 1024
        )

        print(
            "RAG archive downloaded: "
            f"{archive_size_mb:.2f} MB"
        )

        return response.content


# ============================================================
# ZIP PATH NORMALIZATION
# ============================================================

def normalize_zip_path(
    member_name: str,
) -> str:
    """
    Chuẩn hóa path bên trong ZIP.

    Hỗ trợ:

    data/chroma/...
        -> chroma/...

    data/rag/bm25.pkl
        -> rag/bm25.pkl

    chroma/...
        -> chroma/...

    rag/bm25.pkl
        -> rag/bm25.pkl

    project/data/chroma/...
        -> chroma/...

    Điều này giúp ZIP được tạo theo nhiều
    cách khác nhau vẫn extract đúng vào
    /app/data.
    """

    normalized = (
        member_name
        .replace("\\", "/")
        .lstrip("/")
    )

    while normalized.startswith(
        "./"
    ):
        normalized = (
            normalized[2:]
        )

    # --------------------------------------------
    # ZIP chứa nguyên folder data/
    # --------------------------------------------

    if normalized.startswith(
        "data/"
    ):
        return normalized[
            len("data/"):
        ]

    # --------------------------------------------
    # ZIP có thêm một thư mục root:
    #
    # project/data/chroma/...
    # backup/data/rag/...
    # --------------------------------------------

    marker = "/data/"

    if marker in normalized:
        return normalized.split(
            marker,
            1,
        )[1]

    # --------------------------------------------
    # ZIP đã chứa trực tiếp:
    #
    # chroma/
    # rag/
    # ...
    # --------------------------------------------

    return normalized


# ============================================================
# SAFE EXTRACTION
# ============================================================

def extract_archive(
    archive_bytes: bytes,
) -> Path:
    """
    Extract ZIP vào staging directory,
    normalize folder structure,
    validate paths và chống Zip Slip.

    Return:
        staging_data_dir
    """

    staging_root = Path(
        tempfile.mkdtemp(
            prefix=".internova_data_",
            dir=str(ROOT_DIR),
        )
    )

    staging_data_dir = (
        staging_root
        / "data"
    )

    staging_data_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    destination = (
        staging_data_dir.resolve()
    )

    print(
        "Extracting RAG data "
        f"to temporary directory: "
        f"{destination}"
    )

    try:
        with zipfile.ZipFile(
            io.BytesIO(
                archive_bytes
            )
        ) as archive:

            extracted_files = 0

            for member in (
                archive.infolist()
            ):
                normalized_name = (
                    normalize_zip_path(
                        member.filename
                    )
                )

                # Root folder "data/"
                # có thể trở thành empty path.
                if not normalized_name:
                    continue

                target_path = (
                    destination
                    / normalized_name
                ).resolve()

                # --------------------------------
                # Zip Slip protection
                # --------------------------------

                if (
                    target_path
                    != destination
                    and destination
                    not in target_path.parents
                ):
                    raise RuntimeError(
                        "Unsafe path found "
                        "inside ZIP: "
                        f"{member.filename}"
                    )

                # --------------------------------
                # Directory
                # --------------------------------

                if member.is_dir():

                    target_path.mkdir(
                        parents=True,
                        exist_ok=True,
                    )

                    continue

                # --------------------------------
                # File
                # --------------------------------

                target_path.parent.mkdir(
                    parents=True,
                    exist_ok=True,
                )

                with archive.open(
                    member,
                    "r",
                ) as source:

                    with target_path.open(
                        "wb"
                    ) as destination_file:

                        shutil.copyfileobj(
                            source,
                            destination_file,
                        )

                extracted_files += 1

            print(
                "Extracted files: "
                f"{extracted_files}"
            )

    except Exception:
        shutil.rmtree(
            staging_root,
            ignore_errors=True,
        )

        raise

    return staging_data_dir


# ============================================================
# VALIDATION
# ============================================================

def validate_extracted_data(
    staging_data_dir: Path,
) -> None:
    """
    Validate required RAG artifacts
    before replacing production data.
    """

    chroma_path = (
        staging_data_dir
        / "chroma"
    )

    bm25_path = (
        staging_data_dir
        / "rag"
        / "bm25.pkl"
    )

    print(
        "Validating extracted data..."
    )

    print(
        "Expected Chroma path: "
        f"{chroma_path}"
    )

    print(
        "Expected BM25 path: "
        f"{bm25_path}"
    )

    if data_ready(
        staging_data_dir
    ):
        print(
            "Required RAG artifacts "
            "found."
        )

        return

    # Debug useful top-level directories
    # without exposing document contents.
    children = []

    if staging_data_dir.exists():

        children = sorted(
            item.name
            for item
            in staging_data_dir.iterdir()
        )

    raise RuntimeError(
        "RAG archive was extracted, "
        "but required artifacts were "
        "not found. "
        "Expected at least: "
        "data/chroma/ and "
        "data/rag/bm25.pkl. "
        f"Extracted top-level entries: "
        f"{children}"
    )


# ============================================================
# INSTALL DATA
# ============================================================

def install_extracted_data(
    staging_data_dir: Path,
) -> None:
    """
    Replace /app/data only after
    staging validation succeeds.
    """

    staging_root = (
        staging_data_dir.parent
    )

    print(
        "Installing production RAG "
        f"data into: {DATA_DIR}"
    )

    # Dockerfile có thể đã tạo
    # /app/data/chroma và /app/data/rag
    # rỗng trước đó.
    if DATA_DIR.exists():

        shutil.rmtree(
            DATA_DIR
        )

    shutil.move(
        str(staging_data_dir),
        str(DATA_DIR),
    )

    shutil.rmtree(
        staging_root,
        ignore_errors=True,
    )


# ============================================================
# MAIN
# ============================================================

def main() -> None:

    print(
        "Checking production RAG data..."
    )

    # --------------------------------------------
    # Existing valid data
    # --------------------------------------------

    if data_ready():

        print(
            "Production RAG data already "
            "exists. Skipping download."
        )

        return

    # --------------------------------------------
    # Download
    # --------------------------------------------

    archive_bytes = (
        download_archive()
    )

    # --------------------------------------------
    # Extract + normalize
    # --------------------------------------------

    staging_data_dir = (
        extract_archive(
            archive_bytes
        )
    )

    # --------------------------------------------
    # Validate before installing
    # --------------------------------------------

    validate_extracted_data(
        staging_data_dir
    )

    # --------------------------------------------
    # Install
    # --------------------------------------------

    install_extracted_data(
        staging_data_dir
    )

    # --------------------------------------------
    # Final validation
    # --------------------------------------------

    if not data_ready():

        raise RuntimeError(
            "Production data installation "
            "completed but final RAG "
            "validation failed."
        )

    print(
        "Production RAG data is ready."
    )

    print(
        f"Chroma: "
        f"{DATA_DIR / 'chroma'}"
    )

    print(
        f"BM25: "
        f"{DATA_DIR / 'rag' / 'bm25.pkl'}"
    )


# ============================================================
# ENTRYPOINT
# ============================================================

if __name__ == "__main__":

    try:
        main()

    except Exception as exc:

        print(
            "Failed to prepare "
            f"production RAG data: {exc}",
            file=sys.stderr,
        )

        sys.exit(1)