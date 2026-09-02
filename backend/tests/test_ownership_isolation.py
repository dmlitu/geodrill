"""Direct IDOR / Broken Object Level Authorization checks.

test_projects.py already verifies user B's *list* endpoints come back
empty; these tests cover the sharper case — user B guessing/knowing user
A's numeric resource id and hitting it directly (GET/PUT/DELETE by id).
Every one of these must 404, never 200/403-with-data.
"""
import pytest

PROJE_PAYLOAD = {
    "proje_adi": "Isolation Test", "proje_kodu": "ISO-1", "saha_kodu": "",
    "lokasyon": "", "is_tipi": "Fore Kazık", "kazik_boyu": 18.0,
    "kazik_capi": 800, "kazik_adedi": 10, "yeralti_suyu": 4.0,
    "proje_notu": "", "teklif_notu": "",
}

SOIL_LAYER = {
    "baslangic": 0, "bitis": 10, "formasyon": "Kil", "zem_tipi": "Kil",
    "kohezyon": "Kohezyonlu", "spt": 15, "ucs": 0, "rqd": 0, "aciklama": "",
}

EQUIPMENT_PAYLOAD = {
    "ad": "Rig X", "tip": "Fore Kazık", "marka": "Test", "max_derinlik": 24.0,
    "max_cap": 1000, "tork": 180.0, "crowd_force": 0.0, "casing": "Evet",
    "dar_alan": "Hayır", "yakit_sinifi": "Orta", "kelly_uzunluk": 0.0, "not": "",
}


@pytest.fixture
def other_user_headers(client):
    client.post("/auth/register", json={
        "username": "isouser", "password": "pass12345678", "email": "iso@iso.com",
    })
    res = client.post("/auth/login", data={"username": "isouser", "password": "pass12345678"})
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture
def owned_project(client, auth_headers):
    return client.post("/projects", json=PROJE_PAYLOAD, headers=auth_headers).json()


# ── Projects ─────────────────────────────────────────────────────────────

def test_get_project_by_id_blocked_for_other_user(client, other_user_headers, owned_project):
    res = client.get(f"/projects/{owned_project['id']}", headers=other_user_headers)
    assert res.status_code == 404


def test_update_project_by_id_blocked_for_other_user(client, other_user_headers, owned_project):
    res = client.put(f"/projects/{owned_project['id']}", json=PROJE_PAYLOAD, headers=other_user_headers)
    assert res.status_code == 404


def test_delete_project_by_id_blocked_for_other_user(client, other_user_headers, owned_project):
    res = client.delete(f"/projects/{owned_project['id']}", headers=other_user_headers)
    assert res.status_code == 404


# ── Soil layers ──────────────────────────────────────────────────────────

def test_list_soil_layers_blocked_for_other_user(client, auth_headers, other_user_headers, owned_project):
    client.put(f"/projects/{owned_project['id']}/soil-layers/bulk", json=[SOIL_LAYER], headers=auth_headers)
    res = client.get(f"/projects/{owned_project['id']}/soil-layers", headers=other_user_headers)
    assert res.status_code == 404


def test_bulk_replace_soil_layers_blocked_for_other_user(client, other_user_headers, owned_project):
    res = client.put(
        f"/projects/{owned_project['id']}/soil-layers/bulk",
        json=[SOIL_LAYER], headers=other_user_headers,
    )
    assert res.status_code == 404


# ── Equipment ────────────────────────────────────────────────────────────

def test_update_equipment_blocked_for_other_user(client, auth_headers, other_user_headers):
    eq = client.post("/equipment", json=EQUIPMENT_PAYLOAD, headers=auth_headers).json()
    res = client.put(f"/equipment/{eq['id']}", json=EQUIPMENT_PAYLOAD, headers=other_user_headers)
    assert res.status_code == 404


def test_delete_equipment_blocked_for_other_user(client, auth_headers, other_user_headers):
    eq = client.post("/equipment", json=EQUIPMENT_PAYLOAD, headers=auth_headers).json()
    res = client.delete(f"/equipment/{eq['id']}", headers=other_user_headers)
    assert res.status_code == 404
    # and it's still there for the real owner
    assert client.get("/equipment", headers=auth_headers).json()


# ── Cost ─────────────────────────────────────────────────────────────────

def test_calculate_cost_blocked_for_other_user(client, auth_headers, other_user_headers, owned_project):
    client.put(f"/projects/{owned_project['id']}/soil-layers/bulk", json=[SOIL_LAYER], headers=auth_headers)
    res = client.post(f"/projects/{owned_project['id']}/cost", json={}, headers=other_user_headers)
    assert res.status_code == 404


def test_get_cost_blocked_for_other_user(client, other_user_headers, owned_project):
    res = client.get(f"/projects/{owned_project['id']}/cost", headers=other_user_headers)
    assert res.status_code == 404


# ── Reports (PDF / CSV export) ──────────────────────────────────────────

def test_pdf_report_blocked_for_other_user(client, other_user_headers, owned_project):
    res = client.get(f"/projects/{owned_project['id']}/report", headers=other_user_headers)
    assert res.status_code == 404


def test_csv_export_blocked_for_other_user(client, other_user_headers, owned_project):
    res = client.get(f"/projects/{owned_project['id']}/soil-layers/export", headers=other_user_headers)
    assert res.status_code == 404


# ── Analyses ─────────────────────────────────────────────────────────────

def test_list_analyses_blocked_for_other_user(client, other_user_headers, owned_project):
    res = client.get(f"/projects/{owned_project['id']}/analyses", headers=other_user_headers)
    assert res.status_code == 404


def test_save_analysis_blocked_for_other_user(client, other_user_headers, owned_project):
    res = client.post(
        f"/projects/{owned_project['id']}/analyses",
        json={"ad": "x", "notlar": ""}, headers=other_user_headers,
    )
    assert res.status_code == 404


# ── No-auth-at-all cases (defense in depth alongside the above) ─────────

@pytest.mark.parametrize("method,path", [
    ("get", "/projects"),
    ("get", "/dashboard"),
    ("get", "/equipment"),
    ("get", "/analyses/recent"),
])
def test_sensitive_endpoints_require_auth(client, method, path):
    res = getattr(client, method)(path)
    assert res.status_code == 401
