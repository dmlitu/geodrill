import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("geodrill")

from database import Base, engine, SessionLocal
from auth import hash_password
import models
from routers import auth as auth_router
from routers import projects as projects_router
from routers import soil as soil_router
from routers import equipment as equipment_router
from routers import reports as reports_router
from routers.soil_import import router as soil_import_router
from routers import companies as companies_router
from routers import analyses as analyses_router
from routers import dashboard as dashboard_router
from routers import cost as cost_router


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
    except Exception as exc:
        logger.warning("seed_default_users failed (non-fatal): %s", exc)
        db.rollback()
    finally:
        db.close()


def _run_schema_migrations():
    """ADD COLUMN migrations for existing tables.

    Her migration ayrı transaction'da çalışır.
    PostgreSQL'de tek transaction içinde bir ALTER TABLE başarısız olunca
    transaction "aborted" durumuna geçer ve sonraki tüm komutlar sessizce
    atlanır — bu, kolonların hiç eklenmemesine neden olurdu.

    Çözüm: her ALTER TABLE kendi engine.begin() bloğunda; IF NOT EXISTS
    ile idempotent yapıldığından yeniden çalıştırma güvenlidir.
    """
    from sqlalchemy import text
    migrations = [
        # v3.0: CPT ve Su alanları zemin katmanlarına
        "ALTER TABLE soil_layers ADD COLUMN IF NOT EXISTS cpt_qc REAL DEFAULT 0.0",
        "ALTER TABLE soil_layers ADD COLUMN IF NOT EXISTS su REAL DEFAULT 0.0",
        # v3.1: Soil layer kaya durumu alanı
        "ALTER TABLE soil_layers ADD COLUMN IF NOT EXISTS kaya_durumu VARCHAR(30)",
        # v3.0: Crowd force makine tablosuna
        "ALTER TABLE equipment ADD COLUMN IF NOT EXISTS crowd_force REAL DEFAULT 0.0",
        # v3.1 SaaS: User tablosuna yeni alanlar
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(200)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'member'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INTEGER",
        # v3.1 SaaS: Equipment tablosuna kelly_uzunluk
        "ALTER TABLE equipment ADD COLUMN IF NOT EXISTS kelly_uzunluk REAL DEFAULT 0.0",
    ]
    for sql in migrations:
        try:
            with engine.begin() as conn:   # her migration kendi transaction'ı
                conn.execute(text(sql))
        except Exception as exc:
            # SQLite eski sürüm uyumu veya beklenmedik hata — loglayarak devam et,
            # ama tamamen sessize alma (12-Factor logs as event streams).
            logger.warning("schema migration skipped: %s -- %s", sql, exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        Base.metadata.create_all(bind=engine)
        _run_schema_migrations()
        seed_default_users()
        logger.info("GeoDrill API started successfully — port %s", os.environ.get("PORT", "10000"))
    except Exception as exc:
        logger.error("Startup error (non-fatal): %s", exc, exc_info=True)
    yield
    logger.info("GeoDrill API shutting down")


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

# Local dev origin'leri yalnızca geliştirme ortamında ekle — prod'da least-privilege.
_ENV = os.getenv("ENV", "dev").lower()
if _ENV in ("dev", "test", "local"):
    for _local in ("http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"):
        if _local not in ALLOWED_ORIGINS:
            ALLOWED_ORIGINS.append(_local)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    # X-XSS-Protection deprecated (OWASP recommends removal); CSP yeter.
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # API tarafı için en sıkı CSP: hiçbir kaynağa frame/script izni yok.
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    return response

from routers.auth import limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Sunucu hatası oluştu"})


app.include_router(auth_router.router)
app.include_router(projects_router.router)
app.include_router(soil_router.router)
app.include_router(equipment_router.router)
app.include_router(reports_router.router)
app.include_router(soil_import_router, tags=["soil-import"])
app.include_router(companies_router.router)
app.include_router(analyses_router.router)
app.include_router(dashboard_router.router)
app.include_router(cost_router.router)


@app.get("/")
def root():
    return {"status": "ok", "message": "GeoDrill API v3.1.0"}


@app.get("/health")
def health():
    """Liveness + readiness check. DB bağlantısını da doğrular."""
    from sqlalchemy import text
    from fastapi.responses import JSONResponse
    db_status = "ok"
    db_error: str | None = None
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        db_status = "down"
        db_error = str(exc)[:120]

    body = {"status": "healthy" if db_status == "ok" else "degraded",
            "version": "3.1.0", "db": db_status}
    if db_error:
        body["db_error"] = db_error
    return JSONResponse(status_code=200 if db_status == "ok" else 503, content=body)
