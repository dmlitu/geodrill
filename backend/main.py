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
    logger.info("GeoDrill API started successfully")
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
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
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


@app.get("/")
def root():
    return {"status": "ok", "message": "GeoDrill API v0.1.0"}
