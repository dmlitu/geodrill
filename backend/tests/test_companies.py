"""
Integration tests for /companies router.
"""


def test_create_company(client, auth_headers):
    res = client.post(
        "/companies",
        json={"name": "Test Firma A.Ş.", "slug": "test-firma"},
        headers=auth_headers,
    )
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Test Firma A.Ş."
    assert data["slug"] == "test-firma"
    assert data["plan"] == "free"


def test_create_company_duplicate_slug(client, auth_headers):
    client.post("/companies", json={"name": "Firma", "slug": "ayni-slug"}, headers=auth_headers)

    # İkinci kullanıcı aynı slug ile firma oluşturamaz
    client.post("/auth/register", json={"username": "user2", "password": "pass12345", "email": "u2@t.com"})
    r = client.post("/auth/login", data={"username": "user2", "password": "pass12345"})
    h2 = {"Authorization": f"Bearer {r.json()['access_token']}"}
    res = client.post("/companies", json={"name": "Başka Firma", "slug": "ayni-slug"}, headers=h2)
    assert res.status_code == 400


def test_get_my_company_when_member(client, auth_headers):
    client.post("/companies", json={"name": "Benim Firmam", "slug": "benim-firma"}, headers=auth_headers)
    res = client.get("/companies/me", headers=auth_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["company"]["name"] == "Benim Firmam"
    assert data["subscription"] is not None


def test_get_my_company_no_company(client, auth_headers):
    res = client.get("/companies/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["company"] is None


def test_join_company(client, auth_headers):
    # auth_headers kullanıcısı firma oluşturur
    client.post("/companies", json={"name": "Ortak Firma", "slug": "ortak"}, headers=auth_headers)

    # İkinci kullanıcı firmaya katılır
    client.post("/auth/register", json={"username": "katilimci", "password": "pass12345", "email": "k@k.com"})
    r = client.post("/auth/login", data={"username": "katilimci", "password": "pass12345"})
    h2 = {"Authorization": f"Bearer {r.json()['access_token']}"}

    res = client.post("/companies/me/join/ortak", headers=h2)
    assert res.status_code == 200
    assert res.json()["slug"] == "ortak"


def test_join_nonexistent_company(client, auth_headers):
    res = client.post("/companies/me/join/olmayan-slug", headers=auth_headers)
    assert res.status_code == 404


def test_create_company_auto_creates_subscription(client, auth_headers):
    """Firma oluşturulduğunda ücretsiz abonelik otomatik oluşmalı."""
    client.post("/companies", json={"name": "Abonelik Test", "slug": "ab-test"}, headers=auth_headers)
    res = client.get("/companies/me", headers=auth_headers)
    assert res.status_code == 200
    sub = res.json()["subscription"]
    assert sub is not None
    assert sub["plan"] == "free"
    assert sub["analyses_limit"] == 5


def test_update_company(client, auth_headers):
    client.post("/companies", json={"name": "Eski Ad", "slug": "guncelleme-test"}, headers=auth_headers)
    res = client.put("/companies/me", json={"name": "Yeni Ad", "slug": "guncelleme-test"}, headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["name"] == "Yeni Ad"


def test_update_company_no_company(client, auth_headers):
    res = client.put("/companies/me", json={"name": "Geçerli Ad", "slug": "gecerli-ad"}, headers=auth_headers)
    assert res.status_code == 404


def test_leave_company(client, auth_headers):
    """Member rolü firmayı terk edebilmeli."""
    client.post("/companies", json={"name": "Terk Test", "slug": "terk-test"}, headers=auth_headers)

    client.post("/auth/register", json={"username": "terkedecek", "password": "pass12345", "email": "t2@t.com"})
    r = client.post("/auth/login", data={"username": "terkedecek", "password": "pass12345"})
    h2 = {"Authorization": f"Bearer {r.json()['access_token']}"}

    client.post("/companies/me/join/terk-test", headers=h2)
    res = client.post("/companies/me/leave", headers=h2)
    assert res.status_code == 204
