"""CAD subsystem health check.

Surfaces whether the DWG->DXF converter is actually resolvable on this
host *before* the first user finds out the hard way by uploading a .dwg
file. Called once at app startup (logged) and exposed live via GET /health
so it can be checked from outside the process too (deploy verification,
uptime monitoring).
"""
from __future__ import annotations

import shutil
import subprocess

from .dwg_converter import _CANDIDATE_TOOLS, _resolve_converter


def check_cad_environment() -> dict:
    result = {
        "dxf_parser": "ok",  # ezdxf is a hard dependency (requirements.txt) — if this process
                              # is running at all, importing modules.cad already succeeded.
        "dwg_converter": "unavailable",
        "converter_path": None,
        "converter_version": None,
        "detail": None,
    }
    try:
        path = _resolve_converter()
    except Exception as e:
        result["detail"] = str(e)
        return result

    result["dwg_converter"] = "ok"
    result["converter_path"] = path
    try:
        proc = subprocess.run([path, "--version"], capture_output=True, timeout=5, shell=False)
        out = (proc.stdout or proc.stderr or b"").decode("utf-8", errors="replace").strip()
        result["converter_version"] = out.splitlines()[0] if out else None
    except Exception:
        pass  # version probe is best-effort only — converter still counts as available
    return result


def format_startup_log(status: dict) -> str:
    lines = [
        "CAD subsystem:",
        f"  DXF parser: {status['dxf_parser'].upper()}",
        f"  DWG converter: {status['dwg_converter'].upper()}"
        + (f" ({status['converter_path']})" if status["converter_path"] else ""),
    ]
    if status["converter_version"]:
        lines.append(f"  Converter version: {status['converter_version']}")
    if status["dwg_converter"] != "ok":
        lines.append(
            "  WARNING: no DWG->DXF converter found — .dwg uploads will fail until "
            f"one of {_CANDIDATE_TOOLS} is on PATH or GEODRILL_DWG_CONVERTER is set. "
            ".dxf uploads are unaffected."
        )
    return "\n".join(lines)
