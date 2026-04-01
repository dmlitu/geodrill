import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base, get_db
from main import app
from routers.auth import limiter

# StaticPool: tüm bağlantılar aynı bellekte DB'yi paylaşır
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def client():
    # Tabloları test engine'inde oluştur
    Base.metadata.create_all(bind=engine)

    session = TestingSessionLocal()

    def override_get_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    limiter.enabled = False

    # lifespan'i atlatmak için raise_server_exceptions=True yeterli; seed çalışmaz
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c

    app.dependency_overrides.clear()
    limiter.enabled = True
    session.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def auth_headers(client):
    """Demo kullanıcı kayıt + login, JWT header döner."""
    client.post("/auth/register", json={
        "username": "testuser", "password": "testpass1234", "email": "t@t.com"
    })
    res = client.post("/auth/login", data={"username": "testuser", "password": "testpass1234"})
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
