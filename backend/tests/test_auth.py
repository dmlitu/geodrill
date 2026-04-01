def test_register_success(client):
    res = client.post("/auth/register", json={
        "username": "yeni", "password": "sifre12345", "email": "yeni@test.com"
    })
    assert res.status_code == 201
    data = res.json()
    assert data["username"] == "yeni"
    assert data["is_active"] is True


def test_register_duplicate_username(client):
    payload = {"username": "tekrar", "password": "sifre12345", "email": "a@a.com"}
    client.post("/auth/register", json=payload)
    res = client.post("/auth/register", json=payload)
    assert res.status_code == 400
    assert "kullanılıyor" in res.json()["detail"]


def test_login_success(client):
    client.post("/auth/register", json={"username": "giris", "password": "sifre12345", "email": "g@g.com"})
    res = client.post("/auth/login", data={"username": "giris", "password": "sifre12345"})
    assert res.status_code == 200
    assert "access_token" in res.json()


def test_login_wrong_password(client):
    client.post("/auth/register", json={"username": "u1", "password": "dogru12345", "email": "u@u.com"})
    res = client.post("/auth/login", data={"username": "u1", "password": "yanlis12345"})
    assert res.status_code == 401


def test_me_authenticated(client, auth_headers):
    res = client.get("/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["username"] == "testuser"


def test_me_unauthenticated(client):
    res = client.get("/auth/me")
    assert res.status_code == 401
