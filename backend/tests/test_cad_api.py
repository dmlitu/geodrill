"""HTTP-layer tests for POST /projects/{id}/cad/analyze and /cad/inspect."""
import io

import ezdxf

PROJE_PAYLOAD = {
    "proje_adi": "CAD Test", "proje_kodu": "", "saha_kodu": "", "lokasyon": "",
    "is_tipi": "Fore Kazık", "kazik_boyu": 18.0, "kazik_capi": 800,
    "kazik_adedi": 10, "yeralti_suyu": 4.0, "proje_notu": "", "teklif_notu": "",
}


def _proje_id(client, auth_headers):
    return client.post("/projects", json=PROJE_PAYLOAD, headers=auth_headers).json()["id"]


def _sample_dxf_bytes() -> bytes:
    doc = ezdxf.new("R2018")
    msp = doc.modelspace()
    for i in range(6):
        msp.add_circle((i * 100, 0), radius=32.5, dxfattribs={"layer": "FORE_KAZIK"})
    buf = io.StringIO()
    doc.write(buf)
    return buf.getvalue().encode("utf-8")


def test_analyze_requires_auth(client):
    files = {"file": ("t.dxf", _sample_dxf_bytes(), "application/octet-stream")}
    res = client.post("/projects/1/cad/analyze", files=files)
    assert res.status_code == 401


def test_analyze_rejects_nonexistent_project(client, auth_headers):
    files = {"file": ("t.dxf", _sample_dxf_bytes(), "application/octet-stream")}
    res = client.post("/projects/999999/cad/analyze", files=files, headers=auth_headers)
    assert res.status_code == 404


def test_analyze_returns_expected_shape(client, auth_headers):
    pid = _proje_id(client, auth_headers)
    files = {"file": ("t.dxf", _sample_dxf_bytes(), "application/octet-stream")}
    res = client.post(f"/projects/{pid}/cad/analyze", files=files, headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    for key in ("summary", "piles", "anchors", "diagnostics", "warnings", "needsReview"):
        assert key in body
    assert body["summary"]["pileCount"] == 6
    assert body["piles"]["count"] == 6
    assert len(body["piles"]["items"]) == 6
    item = body["piles"]["items"][0]
    for field in ("id", "x", "y", "layer", "blockName", "entityType", "confidence", "detectedBy"):
        assert field in item


def test_analyze_rejects_bad_extension(client, auth_headers):
    pid = _proje_id(client, auth_headers)
    files = {"file": ("notes.txt", b"hello world", "text/plain")}
    res = client.post(f"/projects/{pid}/cad/analyze", files=files, headers=auth_headers)
    assert res.status_code == 400


def test_analyze_rejects_garbage_dwg(client, auth_headers):
    pid = _proje_id(client, auth_headers)
    files = {"file": ("broken.dwg", b"not really a dwg" * 20, "application/octet-stream")}
    res = client.post(f"/projects/{pid}/cad/analyze", files=files, headers=auth_headers)
    assert res.status_code == 400


def test_analyze_does_not_leak_across_users(client, auth_headers):
    pid = _proje_id(client, auth_headers)
    client.post("/auth/register", json={"username": "otheruser", "password": "otherpass1234", "email": "o@o.com"})
    other_login = client.post("/auth/login", data={"username": "otheruser", "password": "otherpass1234"})
    other_headers = {"Authorization": f"Bearer {other_login.json()['access_token']}"}

    files = {"file": ("t.dxf", _sample_dxf_bytes(), "application/octet-stream")}
    res = client.post(f"/projects/{pid}/cad/analyze", files=files, headers=other_headers)
    assert res.status_code == 404


def test_inspect_returns_layer_and_block_diagnostics(client, auth_headers):
    pid = _proje_id(client, auth_headers)
    files = {"file": ("t.dxf", _sample_dxf_bytes(), "application/octet-stream")}
    res = client.post(f"/projects/{pid}/cad/inspect", files=files, headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["units"]
    assert any(l["name"] == "FORE_KAZIK" for l in body["layers"])
    assert body["entityStats"].get("CIRCLE") == 6
