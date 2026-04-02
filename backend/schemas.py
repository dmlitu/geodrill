from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, model_validator


# ─── Auth ────────────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=128)
    email: Optional[str] = None
    full_name: Optional[str] = None


class UserOut(BaseModel):
    id: int
    username: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Soil Layer ───────────────────────────────────────────────────────────────

class SoilLayerCreate(BaseModel):
    baslangic: float = Field(..., ge=0)
    bitis: float = Field(..., gt=0)
    formasyon: str = ""
    zem_tipi: str = "Kil"
    kohezyon: str = "Kohezyonlu"
    spt: int = Field(10, ge=0, le=300)
    ucs: float = Field(0.0, ge=0)
    rqd: float = Field(0.0, ge=0, le=100)
    cpt_qc: float = Field(0.0, ge=0)
    su: float = Field(0.0, ge=0)
    aciklama: str = ""

    @model_validator(mode="after")
    def bitis_gt_baslangic(self):
        if self.bitis <= self.baslangic:
            raise ValueError("Bitiş derinliği başlangıç derinliğinden büyük olmalı")
        return self


class SoilLayerOut(SoilLayerCreate):
    id: int
    project_id: int

    model_config = {"from_attributes": True}


# ─── Project ──────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    proje_adi: str = Field(..., min_length=1, max_length=200)
    proje_kodu: str = ""
    saha_kodu: str = ""
    lokasyon: str = ""
    is_tipi: str = "Fore Kazık"
    kazik_boyu: float = Field(18.0, gt=0, le=200)
    kazik_capi: int = Field(800, gt=0, le=5000)
    kazik_adedi: int = Field(30, gt=0)
    yeralti_suyu: float = Field(4.0, ge=0)
    proje_notu: str = ""
    teklif_notu: str = ""


class ProjectOut(ProjectCreate):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime
    soil_layers: List[SoilLayerOut] = []

    model_config = {"from_attributes": True}


class ProjectSummary(BaseModel):
    id: int
    proje_adi: str
    proje_kodu: str
    lokasyon: str
    is_tipi: str
    kazik_adedi: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Equipment ────────────────────────────────────────────────────────────────

class EquipmentCreate(BaseModel):
    ad: str = Field(..., min_length=1, max_length=100)
    tip: str = "Fore Kazık"
    marka: str = ""
    max_derinlik: float = Field(24.0, gt=0)
    max_cap: int = Field(1000, gt=0)
    tork: float = Field(180.0, gt=0)
    crowd_force: float = Field(0.0, ge=0)
    casing: str = "Evet"
    dar_alan: str = "Hayır"
    yakit_sinifi: str = "Orta"
    not_: str = Field("", alias="not")

    model_config = {"populate_by_name": True}


class EquipmentOut(BaseModel):
    id: int
    owner_id: int
    ad: str
    tip: str
    marka: str
    max_derinlik: float
    max_cap: int
    tork: float
    crowd_force: float
    casing: str
    dar_alan: str
    yakit_sinifi: str
    not_: str = Field("", alias="not")

    model_config = {"from_attributes": True, "populate_by_name": True}
