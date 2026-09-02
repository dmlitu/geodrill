"""CAD subsystem health check — see modules/cad/health.py.

These verify the check degrades gracefully (never raises) whether or not a
converter is actually installed on the machine running the tests, and that
GET /health surfaces it without ever flipping overall service health.
"""
from modules.cad.health import check_cad_environment, format_startup_log


def test_check_cad_environment_never_raises():
    status = check_cad_environment()
    assert status["dxf_parser"] == "ok"
    assert status["dwg_converter"] in ("ok", "unavailable")


def test_check_cad_environment_reports_converter_when_configured(monkeypatch, tmp_path):
    fake_converter = tmp_path / "dwg2dxf"
    fake_converter.write_text("#!/bin/sh\necho 'dwg2dxf 0.14'\n")
    fake_converter.chmod(0o755)
    monkeypatch.setenv("GEODRILL_DWG_CONVERTER", str(fake_converter))

    status = check_cad_environment()
    assert status["dwg_converter"] == "ok"
    assert status["converter_path"] == str(fake_converter)


def test_check_cad_environment_reports_unavailable_when_misconfigured(monkeypatch):
    monkeypatch.setenv("GEODRILL_DWG_CONVERTER", "/definitely/not/a/real/path")
    status = check_cad_environment()
    assert status["dwg_converter"] == "unavailable"
    assert status["converter_path"] is None


def test_format_startup_log_includes_warning_when_unavailable():
    text = format_startup_log({
        "dxf_parser": "ok", "dwg_converter": "unavailable",
        "converter_path": None, "converter_version": None, "detail": "not found",
    })
    assert "WARNING" in text
    assert ".dxf uploads are unaffected" in text


def test_health_endpoint_reports_cad_block(client):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert "cad" in body
    assert body["cad"]["dxf_parser"] == "ok"
    assert body["cad"]["dwg_converter"] in ("ok", "unavailable")
    # A missing converter must never take the whole service down.
    assert body["status"] == "healthy"
