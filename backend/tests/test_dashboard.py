"""
Integration tests for GET /dashboard router.
"""

PROJE_PAYLOAD = {
    "proje_adi": "Dashboard Test",
    "proje_kodu": "DT-001",
    "saha_kodu": "SH-01",
    "lokasyon": "Ankara",
    "is_tipi": "Fore Kazık",
    "kazik_boyu": 20.0,
    "kazik_capi": 1000,
    "kazik_adedi": 15,
    "yeralti_suyu": 5.0,
    "proje_notu": "",
    "teklif_notu": "",
}

ANALIZ_PAYLOAD = {
    "ad": "Dashboard Analiz",
    "notlar": "",
    "motor_version": "v3.1",
    "tork_nominal": 180.0,
    "tork_max": 230.0,
    "casing_m": 8.0,
    "sure_saat": 4.0,
    "guven_seviyesi": "Orta",
    "guven_puan": 70,
    "risk_ozeti": "Yüksek",
    "analiz_json": {"sonuc": "test"},
    "maliyet_json": None,
}


def test_dashboard_empty(client, auth_headers):
    """Proje ve analiz yokken dashboard sıfır döndürmeli."""
    res = client.get("/dashboard", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["proje_sayisi"] == 0
    assert data["analiz_sayisi"] == 0
    assert data["toplam_kazik"] == 0
    assert data["son_projeler"] == []


def test_dashboard_with_projects(client, auth_headers):
    """Projeler oluşturulunca dashboard sayıları güncellenmeli."""
    client.post("/projects", json=PROJE_PAYLOAD, headers=auth_headers)
    client.post("/projects", json={**PROJE_PAYLOAD, "proje_adi": "İkinci"}, headers=auth_headers)

    res = client.get("/dashboard", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["proje_sayisi"] == 2
    assert data["toplam_kazik"] == PROJE_PAYLOAD["kazik_adedi"] * 2
    assert len(data["son_projeler"]) == 2


def test_dashboard_with_analyses(client, auth_headers):
    """Analizler kaydedilince analiz sayısı ve risk dağılımı güncellenmeli."""
    proje = client.post("/projects", json=PROJE_PAYLOAD, headers=auth_headers).json()
    client.post(f"/projects/{proje['id']}/analyses", json=ANALIZ_PAYLOAD, headers=auth_headers)
    client.post(f"/projects/{proje['id']}/analyses", json={**ANALIZ_PAYLOAD, "risk_ozeti": "Düşük"}, headers=auth_headers)

    res = client.get("/dashboard", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["analiz_sayisi"] == 2
    assert data["risk_dagilim"]["Yüksek"] >= 1
    assert data["risk_dagilim"]["Düşük"] >= 1


def test_dashboard_plan_info(client, auth_headers):
    """Plan, kullanım ve limit alanları dönmeli."""
    res = client.get("/dashboard", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert "plan" in data
    assert "analyses_used" in data
    assert "analyses_limit" in data


def test_dashboard_isolated_per_user(client, auth_headers):
    """Her kullanıcı sadece kendi projelerini görür."""
    client.post("/projects", json=PROJE_PAYLOAD, headers=auth_headers)

    client.post("/auth/register", json={"username": "diger2", "password": "pass12345", "email": "d2@d.com"})
    r = client.post("/auth/login", data={"username": "diger2", "password": "pass12345"})
    h2 = {"Authorization": f"Bearer {r.json()['access_token']}"}

    res = client.get("/dashboard", headers=h2)
    assert res.json()["proje_sayisi"] == 0


def test_dashboard_son_projeler_limit(client, auth_headers):
    """son_projeler en fazla 5 proje döndürmeli."""
    for i in range(7):
        client.post("/projects", json={**PROJE_PAYLOAD, "proje_adi": f"Proje {i}"}, headers=auth_headers)

    res = client.get("/dashboard", headers=auth_headers)
    assert len(res.json()["son_projeler"]) <= 5
