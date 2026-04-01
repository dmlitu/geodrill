PROJE_PAYLOAD = {
    "proje_adi": "Test Projesi",
    "proje_kodu": "TST-001",
    "saha_kodu": "SH-01",
    "lokasyon": "Ankara",
    "is_tipi": "Fore Kazık",
    "kazik_boyu": 18.0,
    "kazik_capi": 800,
    "kazik_adedi": 20,
    "yeralti_suyu": 4.0,
    "proje_notu": "",
    "teklif_notu": "",
}


def test_create_project(client, auth_headers):
    res = client.post("/projects", json=PROJE_PAYLOAD, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["proje_adi"] == "Test Projesi"
    assert data["kazik_boyu"] == 18.0
    assert "id" in data


def test_list_projects_empty(client, auth_headers):
    res = client.get("/projects", headers=auth_headers)
    assert res.status_code == 200
    assert res.json() == []


def test_list_projects(client, auth_headers):
    client.post("/projects", json=PROJE_PAYLOAD, headers=auth_headers)
    client.post("/projects", json={**PROJE_PAYLOAD, "proje_adi": "İkinci"}, headers=auth_headers)
    res = client.get("/projects", headers=auth_headers)
    assert len(res.json()) == 2


def test_get_project(client, auth_headers):
    created = client.post("/projects", json=PROJE_PAYLOAD, headers=auth_headers).json()
    res = client.get(f"/projects/{created['id']}", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["id"] == created["id"]


def test_get_project_not_found(client, auth_headers):
    res = client.get("/projects/9999", headers=auth_headers)
    assert res.status_code == 404


def test_update_project(client, auth_headers):
    created = client.post("/projects", json=PROJE_PAYLOAD, headers=auth_headers).json()
    updated = {**PROJE_PAYLOAD, "proje_adi": "Güncellenmiş"}
    res = client.put(f"/projects/{created['id']}", json=updated, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["proje_adi"] == "Güncellenmiş"


def test_delete_project(client, auth_headers):
    created = client.post("/projects", json=PROJE_PAYLOAD, headers=auth_headers).json()
    res = client.delete(f"/projects/{created['id']}", headers=auth_headers)
    assert res.status_code == 204
    res2 = client.get(f"/projects/{created['id']}", headers=auth_headers)
    assert res2.status_code == 404


def test_projects_isolated_per_user(client, auth_headers):
    """Kullanıcı sadece kendi projelerini görebilmeli."""
    client.post("/projects", json=PROJE_PAYLOAD, headers=auth_headers)

    # İkinci kullanıcı
    client.post("/auth/register", json={"username": "diger", "password": "pass12345678", "email": "d@d.com"})
    login = client.post("/auth/login", data={"username": "diger", "password": "pass12345678"})
    headers2 = {"Authorization": f"Bearer {login.json()['access_token']}"}

    res = client.get("/projects", headers=headers2)
    assert res.json() == []


def test_create_project_invalid_name(client, auth_headers):
    """Boş proje adı 422 döndürmeli."""
    res = client.post("/projects", json={**PROJE_PAYLOAD, "proje_adi": ""}, headers=auth_headers)
    assert res.status_code == 422
