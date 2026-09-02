"""Upload validation + safe temp-file handling for the CAD pipeline.

Untrusted input assumptions: the uploaded bytes may be an arbitrary file
(renamed, truncated, malicious, or a legitimate-but-corrupted DWG/DXF). This
module never trusts the client-provided filename for anything other than
extension sniffing / cosmetics, and never builds a shell command from it.
"""
import os
import re
import secrets
import shutil
import tempfile
from contextlib import contextmanager

MAX_UPLOAD_BYTES = int(os.environ.get("GEODRILL_CAD_MAX_UPLOAD_MB", "60")) * 1024 * 1024
ALLOWED_EXTENSIONS = {".dwg", ".dxf"}

# Magic-byte signatures. DWG files start with "AC10" + a version code (e.g.
# AC1032 = 2018/2019/2020, AC1027 = 2013, AC1024 = 2010, ...). DXF files are
# ASCII/UTF text and don't have a fixed magic number, so we sniff for the
# expected "0\nSECTION" (or "999" comment) opening tag instead.
_DWG_MAGIC = b"AC10"


class CadUploadError(ValueError):
    """Raised for any untrusted-input problem — always mapped to HTTP 400."""


def sanitize_extension(filename: str) -> str:
    """Return a lower-cased, validated extension (with the leading dot), never
    trusting the rest of the filename."""
    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise CadUploadError(
            f"Desteklenmeyen dosya uzantısı: {ext or '(yok)'}. Sadece .dwg ve .dxf kabul edilir."
        )
    return ext


def sniff_file_type(data: bytes, ext: str) -> str:
    """Validate the file signature roughly matches the claimed extension.
    Returns the confirmed logical type: 'dwg' or 'dxf'."""
    if len(data) < 16:
        raise CadUploadError("Dosya çok küçük / boş görünüyor.")

    looks_like_dwg = data[:4] == _DWG_MAGIC
    # DXF ascii files begin (after optional BOM/whitespace) with a "0" tag
    # line followed by SECTION/COMMENT; binary DXF starts with a fixed
    # "AutoCAD Binary DXF\r\n" sentinel.
    head_text = data[:64].lstrip(b"\xef\xbb\xbf").lstrip()
    looks_like_dxf_ascii = head_text[:1] in (b"0", b"9") or b"SECTION" in data[:2048]
    looks_like_dxf_binary = data[:20].startswith(b"AutoCAD Binary DXF")

    if ext == ".dwg":
        if not looks_like_dwg:
            raise CadUploadError("Dosya .dwg uzantılı ama geçerli bir DWG imzası taşımıyor.")
        return "dwg"
    else:
        if not (looks_like_dxf_ascii or looks_like_dxf_binary):
            raise CadUploadError("Dosya .dxf uzantılı ama geçerli bir DXF içeriği taşımıyor.")
        if looks_like_dxf_binary:
            raise CadUploadError("Binary DXF formatı henüz desteklenmiyor. Lütfen ASCII DXF veya DWG yükleyin.")
        return "dxf"


def validate_upload(filename: str, data: bytes) -> str:
    """Full validation pipeline. Returns 'dwg' or 'dxf'. Raises CadUploadError
    (mapped to HTTP 400 by the router) on any problem — never raises for the
    caller to crash on."""
    if len(data) > MAX_UPLOAD_BYTES:
        raise CadUploadError(
            f"Dosya boyutu sınırı aşıldı ({MAX_UPLOAD_BYTES // (1024*1024)}MB üst sınır)."
        )
    ext = sanitize_extension(filename)
    return sniff_file_type(data, ext)


@contextmanager
def secure_temp_dir(prefix="geodrill_cad_"):
    """A temp directory with an unguessable name, guaranteed cleaned up even
    on error — used for DWG->DXF conversion (the converter CLI needs real
    files, not stdin/stdout)."""
    path = tempfile.mkdtemp(prefix=prefix + secrets.token_hex(8) + "_")
    try:
        yield path
    finally:
        shutil.rmtree(path, ignore_errors=True)


_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


def safe_basename(original_filename: str, forced_ext: str) -> str:
    """Build a filesystem-safe basename for temp storage. The original name
    is never used as-is (path traversal, shell metacharacters, unicode
    tricks) — only a sanitized, truncated cosmetic prefix plus a random
    token, so collisions and traversal are both impossible."""
    stem = os.path.splitext(os.path.basename(original_filename or "upload"))[0]
    stem = _SAFE_NAME_RE.sub("_", stem)[:40] or "upload"
    return f"{stem}_{secrets.token_hex(6)}{forced_ext}"
