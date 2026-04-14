"""
Integration tests for /projects/{id}/analyses and /analyses/recent routers.
"""

PROJE_PAYLOAD = {
    "proje_adi": "Analiz Test Projesi",
    "proje_kodu": "AT-001",
    "saha_kodu": "SH-01",
    "lokasyon": "İstanbul",
    "is_tipi": "Fore Kazık",
    "kazik_boyu": 18.0,
    "kazik_capi": 800,
    "kazik_adedi": 20,
    "yeralti_suyu": 4.0,
    "proje_notu": "",
    "teklif_notu": "",
}

ANALIZ_PAYLOAD = {
    "ad": "Test Analizi",
    "notlar": "Deneme notu",
    "motor_version": "v3.1",
    "tork_nominal": 150.0,
    "tork_max": 210.0,
    "casing_m": 6.0,
    "sure_saat": 3.5,
    "guven_seviyesi": "Yüksek",
    "guven_puan": 82,
    "risk_ozeti": "Orta",
    "analiz_json": {"test": True},
    "maliyet_json": None,
}


def _create_project(client, auth_headers):
    return client.post("/projects", json=PROJE_PAYLOAD, headers=auth_headers).json()


def test_save_analysis(client, auth_headers):
    proje = _create_project(client, auth_headers)
    res = client.post(
        f"/projects/{proje['id']}/analyses",
        json=ANALIZ_PAYLOAD,
        headers=auth_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["ad"] == "Test Analizi"
    assert data["tork_nominal"] == 150.0
    assert data["guven_puan"] == 82


def test_list_analyses_empty(client, auth_headers):
    proje = _create_project(client, auth_headers)
    res = client.get(f"/projects/{proje['id']}/analyses", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


def test_list_analyses(client, auth_headers):
    proje = _create_project(client, auth_headers)
    client.post(f"/projects/{proje['id']}/analyses", json=ANALIZ_PAYLOAD, headers=auth_headers)
    client.post(f"/projects/{proje['id']}/analyses", json={**ANALIZ_PAYLOAD, "ad": "İkinci"}, headers=auth_headers)
    res = client.get(f"/projects/{proje['id']}/analyses", headers=auth_headers)
    assert len(res.json()) == 2


def test_get_analysis(client, auth_headers):
    proje = _create_project(client, auth_headers)
    analiz = client.post(
        f"/projects/{proje['id']}/analyses", json=ANALIZ_PAYLOAD, headers=auth_headers
    ).json()
    res = client.get(f"/projects/{proje['id']}/analyses/{analiz['id']}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["id"] == analiz["id"]
    assert res.json()["analiz_json"] == {"test": True}


def test_get_analysis_not_found(client, auth_headers):
    proje = _create_project(client, auth_headers)
    res = client.get(f"/projects/{proje['id']}/analyses/9999", headers=auth_headers)
    assert res.status_code == 404


def test_delete_analysis(client, auth_headers):
    proje = _create_project(client, auth_headers)
    analiz = client.post(
        f"/projects/{proje['id']}/analyses", json=ANALIZ_PAYLOAD, headers=auth_headers
    ).json()
    res = client.delete(f"/projects/{proje['id']}/analyses/{analiz['id']}", headers=auth_headers)
    assert res.status_code == 204
    res2 = client.get(f"/projects/{proje['id']}/analyses/{analiz['id']}", headers=auth_headers)
    assert res2.status_code == 404


def test_analyses_not_visible_to_other_user(client, auth_headers):
    proje = _create_project(client, auth_headers)
    client.post(f"/projects/{proje['id']}/analyses", json=ANALIZ_PAYLOAD, headers=auth_headers)

    # İkinci kullanıcı bu projeye erişemez
    client.post("/auth/register", json={"username": "yabanci", "password": "pass12345", "email": "y@y.com"})
    r = client.post("/auth/login", data={"username": "yabanci", "password": "pass12345"})
    h2 = {"Authorization": f"Bearer {r.json()['access_token']}"}
    res = client.get(f"/projects/{proje['id']}/analyses", headers=h2)
    assert res.status_code == 404


def test_recent_analyses(client, auth_headers):
    proje = _create_project(client, auth_headers)
    client.post(f"/projects/{proje['id']}/analyses", json=ANALIZ_PAYLOAD, headers=auth_headers)
    res = client.get("/analyses/recent", headers=auth_headers)
    assert res.status_code == 200
    assert len(res.json()) >= 1


def test_recent_analyses_empty(client, auth_headers):
    res = client.get("/analyses/recent", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


def test_analysis_auto_name_when_empty(client, auth_headers):
    proje = _create_project(client, auth_headers)
    res = client.post(
        f"/projects/{proje['id']}/analyses",
        json={**ANALIZ_PAYLOAD, "ad": ""},
        headers=auth_headers,
    )
    assert res.status_code == 201
    # ad boş gönderildiğinde otomatik tarih tabanlı isim atanmalı
    assert res.json()["ad"] != ""
