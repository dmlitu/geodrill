from datetime import datetime
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey,
    Integer, String, Text,
)
from sqlalchemy.orm import relationship

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    projects = relationship("Project", back_populates="owner", cascade="all, delete-orphan")
    equipment = relationship("Equipment", back_populates="owner", cascade="all, delete-orphan")


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
    soil_layers = relationship("SoilLayer", back_populates="project", cascade="all, delete-orphan", order_by="SoilLayer.baslangic")


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
    kelly_uzunluk = Column(Float, default=0.0)        # Kelly bar effective length (m); 0 = unknown
    not_ = Column("not", Text, default="")

    owner = relationship("User", back_populates="equipment")
