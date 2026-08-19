from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse


router = APIRouter(
    prefix="/documents",
    tags=["Documents"],
)


PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parents[2]
)

DATA_DIR = PROJECT_ROOT / "data"

PREVIEW_DIR = (
    DATA_DIR
    / "preview"
)

FORM_PREFIXES = {
    "form-1": "Form-1-",
    "form-2": "Form-2-",
    "form-3": "Form-3-",
    "form-4": "Form-4-",
}


def _get_prefix(
    form_id: str,
) -> str:
    prefix = FORM_PREFIXES.get(
        form_id
    )

    if prefix is None:
        raise HTTPException(
            status_code=404,
            detail="Form not found.",
        )

    return prefix


def _find_docx(
    form_id: str,
) -> Path:
    prefix = _get_prefix(form_id)

    matches = sorted(
        DATA_DIR.glob(
            f"{prefix}*.docx"
        )
    )

    if not matches:
        raise HTTPException(
            status_code=404,
            detail=(
                f"DOCX file not found "
                f"for {form_id} in data/."
            ),
        )

    return matches[0]


def _pdf_path(
    docx_path: Path,
) -> Path:
    PREVIEW_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    return (
        PREVIEW_DIR
        / f"{docx_path.stem}.pdf"
    )


def _find_soffice() -> str | None:
    candidates = [
        shutil.which("soffice"),
        shutil.which("libreoffice"),
    ]

    if os.name == "nt":
        candidates.extend(
            [
                r"C:\Program Files\LibreOffice\program\soffice.exe",
                r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
            ]
        )

    for candidate in candidates:
        if (
            candidate
            and Path(candidate).exists()
        ):
            return str(candidate)

    return None


def _convert_libreoffice(
    docx_path: Path,
    pdf_path: Path,
) -> bool:
    soffice = _find_soffice()

    if not soffice:
        return False

    process = subprocess.run(
        [
            soffice,
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            str(PREVIEW_DIR),
            str(docx_path),
        ],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )

    return (
        process.returncode == 0
        and pdf_path.exists()
    )


def _convert_word(
    docx_path: Path,
    pdf_path: Path,
) -> bool:
    # Windows fallback using installed Microsoft Word.
    if os.name != "nt":
        return False

    try:
        import win32com.client  # type: ignore
    except Exception:
        return _convert_word_powershell(
            docx_path,
            pdf_path,
        )

    word = None
    document = None

    try:
        word = (
            win32com.client
            .DispatchEx(
                "Word.Application"
            )
        )

        word.Visible = False

        document = (
            word.Documents.Open(
                str(
                    docx_path.resolve()
                )
            )
        )

        # 17 = wdFormatPDF
        document.SaveAs(
            str(
                pdf_path.resolve()
            ),
            FileFormat=17,
        )

        return pdf_path.exists()

    except Exception:
        return _convert_word_powershell(
            docx_path,
            pdf_path,
        )

    finally:
        if document is not None:
            try:
                document.Close(False)
            except Exception:
                pass

        if word is not None:
            try:
                word.Quit()
            except Exception:
                pass


def _convert_word_powershell(
    docx_path: Path,
    pdf_path: Path,
) -> bool:
    script = """
$ErrorActionPreference = 'Stop'
$docxPath = $args[0]
$pdfPath = $args[1]
$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $document = $word.Documents.Open($docxPath)
    $document.SaveAs([ref] $pdfPath, [ref] 17)
}
finally {
    if ($document -ne $null) {
        $document.Close([ref] $false)
    }
    if ($word -ne $null) {
        $word.Quit()
    }
}
""".strip()

    process = subprocess.run(
        [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
            str(docx_path.resolve()),
            str(pdf_path.resolve()),
        ],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )

    return (
        process.returncode == 0
        and
        pdf_path.exists()
    )

def _ensure_pdf(
    form_id: str,
) -> Path:
    docx_path = _find_docx(
        form_id
    )

    pdf_path = _pdf_path(
        docx_path
    )

    # Keep the generated PDF only as a runtime artifact. Reconvert when the
    # source DOCX changes so the iframe always reflects the original file.
    if (
        pdf_path.exists()
        and
        pdf_path.stat().st_mtime
        >=
        docx_path.stat().st_mtime
    ):
        return pdf_path

    if pdf_path.exists():
        pdf_path.unlink()

    converted = (
        _convert_libreoffice(
            docx_path,
            pdf_path,
        )
        or
        _convert_word(
            docx_path,
            pdf_path,
        )
    )

    if not converted:
        raise HTTPException(
            status_code=503,
            detail=(
                "Cannot create PDF preview. "
                "Install LibreOffice or Microsoft Word. "
                "The original Word file can still be downloaded."
            ),
        )

    return pdf_path


@router.get(
    "/forms/{form_id}/download"
)
def download_form(
    form_id: str,
):
    path = _find_docx(
        form_id
    )

    return FileResponse(
        path=str(path),
        filename=path.name,
        media_type=(
            "application/vnd.openxmlformats-officedocument."
            "wordprocessingml.document"
        ),
    )


@router.get(
    "/forms/{form_id}/preview"
)
def preview_form(
    form_id: str,
):
    path = _ensure_pdf(
        form_id
    )

    return FileResponse(
        path=str(path),
        media_type="application/pdf",
        content_disposition_type="inline",
    )


@router.get(
    "/forms/{form_id}/info"
)
def form_info(
    form_id: str,
):
    path = _find_docx(
        form_id
    )

    return {
        "form_id":
            form_id,
        "file_name":
            path.name,
        "download_url":
            (
                f"/api/v1/documents/forms/"
                f"{form_id}/download"
            ),
        "preview_url":
            (
                f"/api/v1/documents/forms/"
                f"{form_id}/preview"
            ),
    }


