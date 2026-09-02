"""Performance/robustness regressions from the CAD timeout investigation:
- load_dxf_lenient no longer wastes a doomed-to-fail parse attempt on the
  untouched text before repairing.
- POST /projects/{id}/cad/analyze has an outer safety-net timeout that
  fails cleanly (no internal detail leaked) instead of hanging forever.
"""
import io
from unittest.mock import patch

import ezdxf
import pytest

from modules.cad import dxf_repair


def _dxf_bytes(build_fn) -> bytes:
    doc = ezdxf.new("R2018")
    build_fn(doc)
    buf = io.StringIO()
    doc.write(buf)
    return buf.getvalue().encode("utf-8")


def test_load_dxf_lenient_repairs_before_first_parse_attempt():
    """The caller (parser.py) only reaches load_dxf_lenient after its own
    plain Drawing.read() already failed — retrying that exact same call
    on the untouched text would be pure waste. Verify the first thing
    that happens is a repair pass, not a parse."""
    def build(doc):
        msp = doc.modelspace()
        for _ in range(3):
            msp.add_circle((0, 0), radius=1.0, dxfattribs={"layer": "KAZIK"})

    text = _dxf_bytes(build).decode("utf-8")
    lines = text.splitlines()
    circle_idx = next(i for i, line in enumerate(lines) if line.strip() == "CIRCLE")
    for i in range(circle_idx, len(lines) - 1):
        if lines[i].strip() == "40":
            lines[i + 1] = ""
            break
    corrupted = "\n".join(lines) + "\n"

    with patch.object(dxf_repair, "_repair_pass", wraps=dxf_repair._repair_pass) as spy:
        doc, dropped, rounds = dxf_repair.load_dxf_lenient(corrupted)
        # First call to _repair_pass must happen before any successful parse —
        # i.e. round 0 must call it, proving we didn't try the untouched
        # text first.
        assert spy.call_count >= 1
        assert spy.call_args_list[0].args[0] == corrupted  # first repair call sees the ORIGINAL text
    assert dropped  # something was actually dropped/repaired
    assert len(doc.modelspace()) == 2  # one CIRCLE was corrupted and dropped, 2 survive


def test_load_dxf_lenient_still_raises_on_undroppable_corruption():
    with pytest.raises(dxf_repair.DxfUnrecoverableError):
        dxf_repair.load_dxf_lenient("this is not dxf at all, no group codes here")


# ── Outer processing-timeout safety net (router level) ──────────────────

PROJE_PAYLOAD = {
    "proje_adi": "Timeout Test", "proje_kodu": "", "saha_kodu": "", "lokasyon": "",
    "is_tipi": "Fore Kazık", "kazik_boyu": 18.0, "kazik_capi": 800,
    "kazik_adedi": 10, "yeralti_suyu": 4.0, "proje_notu": "", "teklif_notu": "",
}


def _sample_dxf_bytes() -> bytes:
    doc = ezdxf.new("R2018")
    msp = doc.modelspace()
    msp.add_circle((0, 0), radius=32.5, dxfattribs={"layer": "FORE_KAZIK"})
    buf = io.StringIO()
    doc.write(buf)
    return buf.getvalue().encode("utf-8")


def test_analyze_times_out_cleanly_instead_of_hanging(client, auth_headers, monkeypatch):
    import time as time_mod
    import routers.cad as cad_router

    monkeypatch.setattr(cad_router, "CAD_PROCESSING_TIMEOUT_SECONDS", 0.05)

    def _slow_analyze(self, data, filename):
        time_mod.sleep(0.5)
        return {}  # never actually reached before the timeout fires

    monkeypatch.setattr(cad_router.CadAnalyzer, "analyze", _slow_analyze)

    pid = client.post("/projects", json=PROJE_PAYLOAD, headers=auth_headers).json()["id"]
    files = {"file": ("t.dxf", _sample_dxf_bytes(), "application/octet-stream")}
    res = client.post(f"/projects/{pid}/cad/analyze", files=files, headers=auth_headers)

    assert res.status_code == 503
    detail = res.json()["detail"]
    assert "uzun sürdü" in detail
    # never leak internal exception types/tracebacks in the timeout path
    assert "TimeoutError" not in detail and "asyncio" not in detail
