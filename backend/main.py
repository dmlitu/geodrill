import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine, SessionLocal
from auth import hash_password
import models
from routers import auth as auth_router
from routers import projects as projects_router
from routers import soil as soil_router
from routers import equipment as equipment_router
from routers import reports as reports_router


def seed_default_users():
    """Demo kullanıcılarını ilk çalışmada oluştur."""
    db = SessionLocal()
    try:
        defaults = [
            ("demo", "demo"),
            ("firma1", "1234"),
            ("admin", "admin123"),
        ]
        for username, password in defaults:
            exists = db.query(models.User).filter(models.User.username == username).first()
            if not exists:
                db.add(models.User(
                    username=username,
                    hashed_password=hash_password(password),
                ))
        db.commit()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_default_users()
    yield


app = FastAPI(
    title="GeoDrill API",
    version="0.1.0",
    lifespan=lifespan,
)

_raw_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173",
)
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(projects_router.router)
app.include_router(soil_router.router)
app.include_router(equipment_router.router)
app.include_router(reports_router.router)


@app.get("/")
def root():
    return {"status": "ok", "message": "GeoDrill API v0.1.0"}
