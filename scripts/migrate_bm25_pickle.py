## File này là để vá lỗi của file bm25

from __future__ import annotations

import pickle
import shutil
from pathlib import Path

from src.rag.retrieval.bm25_store import BM25StorePayload


BM25_PATH = Path("data/rag/bm25.pkl")
BACKUP_PATH = Path("data/rag/bm25_old_backup.pkl")


class BM25MigrationUnpickler(pickle.Unpickler):
    def find_class(self, module: str, name: str):
        # Đường dẫn class cũ được lưu bên trong bm25.pkl
        if module == "src.rag.bm25_store" and name == "BM25StorePayload":
            return BM25StorePayload

        return super().find_class(module, name)


def migrate() -> None:
    if not BM25_PATH.exists():
        raise FileNotFoundError(f"Không tìm thấy: {BM25_PATH}")

    # Backup trước
    shutil.copy2(BM25_PATH, BACKUP_PATH)
    print(f"Backup: {BACKUP_PATH}")

    # Load pickle cũ nhưng remap class cũ -> class mới
    with BM25_PATH.open("rb") as f:
        payload = BM25MigrationUnpickler(f).load()

    if not isinstance(payload, BM25StorePayload):
        raise TypeError(
            f"Payload không đúng BM25StorePayload: {type(payload)}"
        )

    # Ghi lại file pickle.
    # Vì payload giờ là class ở src.rag.retrieval.bm25_store,
    # pickle mới sẽ lưu đường dẫn module mới.
    with BM25_PATH.open("wb") as f:
        pickle.dump(payload, f)

    print("Migration thành công.")
    print(f"File mới: {BM25_PATH}")
    print(
        "Class hiện tại:",
        payload.__class__.__module__,
        payload.__class__.__name__,
    )


if __name__ == "__main__":
    migrate()