import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./geodrill.db")

# Render'ın verdiği postgres:// URL'ini SQLAlchemy'nin beklediği postgresql:// formatına çevir
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

is_sqlite = DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

pool_kwargs = {}
if not is_sqlite:
    # Neon free tier ~100 toplam bağlantıyı destekler; küçük SaaS için 5 + 10 yeter.
    # SQLAlchemy 2.0 önerisi: pool_pre_ping (kopuk bağlantı tespiti), pool_recycle 30dk.
    pool_kwargs = {
        "pool_size": 5,
        "max_overflow": 10,
        "pool_pre_ping": True,
        "pool_recycle": 1800,
    }

engine = create_engine(DATABASE_URL, connect_args=connect_args, **pool_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
