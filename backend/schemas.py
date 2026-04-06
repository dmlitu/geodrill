from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator, EmailStr


# ─── Company / Subscription ───────────────────────────────────────────────────

PLAN_TIPLERI = Literal["free", "pro", "enterprise"]

PLAN_LIMITLER = {
    "free": 5,
    "pro": 100,
    "enterprise": 0,   # 0 = unlimited
}


class CompanyCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    slug: str = Field(..., min_length=2, max_length=100, pattern=r"^[a-z0-9\-]+$")


class CompanyOut(BaseModel):
    id: int
    name: str
    slug: str
    plan: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SubscriptionOut(BaseModel):
    id: int
    plan: str
    analyses_used: int
    analyses_limit: int
    reset_date: datetime
    valid_until: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ─── Auth ─────────────────────────────────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8, max_length=128)
    email: Optional[str] = None
    full_name: Optional[str] = None
    # Optional: create/join company on registration
    company_name: Optional[str] = Field(None, max_length=200)
    company_slug: Optional[str] = Field(None, max_length=100, pattern=r"^[a-z0-9\-]+$")


class UserOut(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: str = "member"
    company_id: Optional[int] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class UserWithCompany(UserOut):
    company: Optional[CompanyOut] = None

    model_config = {"from_attributes": True}


# ─── Soil Layer ───────────────────────────────────────────────────────────────

ZEMIN_TIPLERI = {
    "Dolgu", "Kil", "Silt", "Kum", "Çakıl",
    "Ayrışmış Kaya", "Kumtaşı", "Kireçtaşı", "Sert Kaya",
    "Organik Kil", "Torf",
}

KOHEZYON_TIPLERI = Literal["Kohezyonlu", "Kohezyonsuz", "Kaya"]
IS_TIPLERI = Literal["Fore Kazık", "Ankraj", "Mini Kazık"]


class SoilLayerCreate(BaseModel):
    baslangic: float = Field(..., ge=0)
    bitis: float = Field(..., gt=0)
    formasyon: str = ""
    zem_tipi: str = Field("Kil", min_length=1, max_length=50)
    kohezyon: KOHEZYON_TIPLERI = "Kohezyonlu"
    spt: int = Field(0, ge=0, le=300)

    @field_validator("zem_tipi")
    @classmethod
    def zem_tipi_gecerli(cls, v: str) -> str:
        if v not in ZEMIN_TIPLERI:
            raise ValueError(
                f"Geçersiz zemin tipi: '{v}'. "
                f"Geçerli tipler: {', '.join(sorted(ZEMIN_TIPLERI))}"
            )
        return v

    ucs: float = Field(0.0, ge=0)
    rqd: float = Field(0.0, ge=0, le=100)
    cpt_qc: float = Field(0.0, ge=0)
    su: float = Field(0.0, ge=0)
    aciklama: str = ""

    _KAYA_TIPLERI = {"Ayrışmış Kaya", "Kumtaşı", "Kireçtaşı", "Sert Kaya"}

    @model_validator(mode="after")
    def bitis_gt_baslangic(self):
        if self.bitis <= self.baslangic:
            raise ValueError("Bitiş derinliği başlangıç derinliğinden büyük olmalı")
        return self

    @model_validator(mode="after")
    def kaya_spt_sifirla(self):
        if self.zem_tipi in self._KAYA_TIPLERI:
            self.spt = 0
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
    is_tipi: IS_TIPLERI = "Fore Kazık"
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
    kazik_boyu: float
    kazik_capi: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Analysis ─────────────────────────────────────────────────────────────────

class AnalysisCreate(BaseModel):
    ad: str = Field("", max_length=200)
    notlar: str = ""
    analiz_json: Optional[Dict[str, Any]] = None
    maliyet_json: Optional[Dict[str, Any]] = None
    # Scalar summary fields (extracted from analiz_json for fast queries)
    tork_nominal: Optional[float] = None
    tork_max: Optional[float] = None
    casing_m: Optional[float] = None
    sure_saat: Optional[float] = None
    guven_seviyesi: Optional[str] = None
    guven_puan: Optional[int] = None
    risk_ozeti: Optional[str] = None
    motor_version: str = "v3.1"


class AnalysisSummary(BaseModel):
    id: int
    project_id: int
    ad: str
    motor_version: str
    tork_nominal: Optional[float]
    casing_m: Optional[float]
    sure_saat: Optional[float]
    guven_seviyesi: Optional[str]
    guven_puan: Optional[int]
    risk_ozeti: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class AnalysisOut(AnalysisSummary):
    user_id: int
    tork_max: Optional[float]
    notlar: str
    analiz_json: Optional[Dict[str, Any]]
    maliyet_json: Optional[Dict[str, Any]]

    model_config = {"from_attributes": True}


# ─── Dashboard ────────────────────────────────────────────────────────────────

class DashboardOut(BaseModel):
    proje_sayisi: int
    analiz_sayisi: int
    toplam_kazik: int
    son_aktivite: Optional[datetime]
    risk_dagilim: Dict[str, int]          # {"Yüksek": 2, "Orta": 5, "Düşük": 8}
    plan: str
    analyses_used: int
    analyses_limit: int
    son_projeler: List[ProjectSummary]


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
    kelly_uzunluk: float = Field(0.0, ge=0)
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
    kelly_uzunluk: float = 0.0
    not_: str = Field("", alias="not")

    model_config = {"from_attributes": True, "populate_by_name": True}
