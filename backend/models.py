from datetime import datetime
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text, JSON,
)
from sqlalchemy.orm import relationship

from database import Base


# ─── Company ──────────────────────────────────────────────────────────────────

class Company(Base):
    """Tenant / workspace model. One company → many users and projects."""
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)  # url-safe
    plan = Column(String(20), default="free")   # free | pro | enterprise
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="company")
    subscription = relationship("Subscription", uselist=False, back_populates="company")


# ─── Subscription ──────────────────────────────────────────────────────────────

class Subscription(Base):
    """Plan limits per company. Reset analyses_used monthly."""
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    company_id = Column(Integer, ForeignKey("companies.id"), unique=True, nullable=False)
    plan = Column(String(20), default="free")          # free | pro | enterprise
    analyses_used = Column(Integer, default=0)          # resets monthly
    analyses_limit = Column(Integer, default=5)         # 5 free / 100 pro / 0=unlimited
    reset_date = Column(DateTime, default=datetime.utcnow)  # monthly reset date
    valid_until = Column(DateTime, nullable=True)       # null = active

    company = relationship("Company", back_populates="subscription")


# ─── User ─────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=True, index=True)
    full_name = Column(String(200), nullable=True)
    role = Column(String(20), default="member")        # owner | admin | member
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="users")
    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    equipment = relationship("Equipment", back_populates="owner", cascade="all, delete-orphan")
    analyses = relationship("Analysis", back_populates="user", cascade="all, delete-orphan")


# ─── Project ──────────────────────────────────────────────────────────────────

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Proje tanımı
    proje_adi = Column(String(200), nullable=False)
    proje_kodu = Column(String(100), default="")
    saha_kodu = Column(String(100), default="")
    lokasyon = Column(String(200), default="")
    is_tipi = Column(String(50), default="Fore Kazık")

    # Kazık parametreleri
    kazik_boyu = Column(Float, default=18.0)
    kazik_capi = Column(Integer, default=800)
    kazik_adedi = Column(Integer, default=30)
    yeralti_suyu = Column(Float, default=4.0)

    # Notlar
    proje_notu = Column(Text, default="")
    teklif_notu = Column(Text, default="")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship("User", back_populates="projects")
    soil_layers = relationship(
        "SoilLayer", back_populates="project",
        cascade="all, delete-orphan", order_by="SoilLayer.baslangic"
    )
    analyses = relationship("Analysis", back_populates="project", cascade="all, delete-orphan")


# ─── SoilLayer ────────────────────────────────────────────────────────────────

class SoilLayer(Base):
    __tablename__ = "soil_layers"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)

    baslangic = Column(Float, nullable=False)   # başlangıç derinliği (m)
    bitis = Column(Float, nullable=False)        # bitiş derinliği (m)
    formasyon = Column(String(100), default="")
    zem_tipi = Column(String(50), default="Kil")
    kohezyon = Column(String(50), default="Kohezyonlu")
    spt = Column(Integer, default=0)
    ucs = Column(Float, default=0.0)
    rqd = Column(Float, default=0.0)
    cpt_qc = Column(Float, default=0.0)  # CPT qc (MPa)
    su = Column(Float, default=0.0)      # undrained shear strength (kPa)
    aciklama = Column(Text, default="")

    project = relationship("Project", back_populates="soil_layers")


# ─── Analysis ─────────────────────────────────────────────────────────────────

class Analysis(Base):
    """
    Saved analysis snapshot. Stores the full tam_analiz() result as JSON.
    Allows users to retrieve, compare, and report on past calculations
    without re-running the engine.
    """
    __tablename__ = "analyses"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Snapshot of key scalar outputs (indexed for dashboard queries)
    motor_version = Column(String(20), default="v3.1")
    tork_nominal = Column(Float, nullable=True)
    tork_max = Column(Float, nullable=True)
    casing_m = Column(Float, nullable=True)
    sure_saat = Column(Float, nullable=True)          # single pile hours
    guven_seviyesi = Column(String(10), nullable=True) # A/B/C/D
    guven_puan = Column(Integer, nullable=True)
    risk_ozeti = Column(String(20), nullable=True)    # Yüksek/Orta/Düşük

    # Full engine output — allows replay without recalculation
    analiz_json = Column(JSON, nullable=True)

    # Cost snapshot (from FiyatAnalizi)
    maliyet_json = Column(JSON, nullable=True)

    ad = Column(String(200), default="")             # user-given name for this run
    notlar = Column(Text, default="")

    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="analyses")
    user = relationship("User", back_populates="analyses")


# ─── Equipment ────────────────────────────────────────────────────────────────

class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    ad = Column(String(100), nullable=False)
    tip = Column(String(50), default="Fore Kazık")
    marka = Column(String(100), default="")
    max_derinlik = Column(Float, default=24.0)
    max_cap = Column(Integer, default=1000)
    tork = Column(Float, default=180.0)
    crowd_force = Column(Float, default=0.0)          # crowd force / downward thrust (kN)
    casing = Column(String(20), default="Evet")       # Evet / Hayır / Şartlı
    dar_alan = Column(String(10), default="Hayır")    # Evet / Hayır
    yakit_sinifi = Column(String(20), default="Orta") # Düşük / Orta / Yüksek
    kelly_uzunluk = Column(Float, default=0.0)        # Kelly bar effective length (m)
    not_ = Column("not", Text, default="")

    owner = relationship("User", back_populates="equipment")
