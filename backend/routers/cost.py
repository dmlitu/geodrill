"""
Maliyet hesaplama ve kaydetme router'ı.

POST /projects/{project_id}/cost   — maliyet hesapla + analiz snapshotuna ekle
GET  /projects/{project_id}/cost   — son kaydedilen maliyet analizini getir

Hesap kalemleri:
  1. Yakıt (mazot)           — ROP × tork × yakıt faktörü × fiyat
  2. Makine kirası/amortisman — saat başı kira × toplam süre
  3. İşçilik                  — operatör + yardımcı × saat
  4. Sarf malzeme             — bit, casing donanım, benton/polimer
  5. Mobilizasyon             — sabit maliyet (opsiyonel)
  6. Genel Gider + Kâr        — yüzde üstlerim
  7. Beton + donatı            — opsiyonel, kazık hacmi × birim fiyat

Çıktı: toplam maliyet, birim fiyatlar, piyasa karşılaştırması, kalem dökümü.
"""
import sys, os
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db
import models

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from modules.calculations.engine import (
    gerekli_tork_aralik, kazik_suresi, mazot_tahmini as _mazot,
    casing_metre, tam_cevrim_suresi,
)

router = APIRouter(tags=["cost"])

# ── Piyasa benchmark (₺, 2024 Q4 Türkiye ortalaması) ─────────────────────────
# Kaynak: Türkiye İnşaat Müteahhitleri Birliği fiyat endeksi + saha geri bildirimleri
_BENCHMARK_METRE_BASI = {
    "Fore Kazık": (3_500, 7_000),   # min, max ₺/m
    "Ankraj":     (2_500, 5_000),
    "Mini Kazık": (4_000, 9_000),
}


# ── Şemalar ──────────────────────────────────────────────────────────────────

class MaliyetParametreleri(BaseModel):
    # Yakıt
    mazot_fiyati:    float = Field(45.0,  gt=0, description="₺/litre")
    # Makine
    makine_kirasi:   float = Field(800.0, ge=0, description="₺/saat — kira veya amortisman")
    # İşçilik
    iscilik_saat:    float = Field(200.0, ge=0, description="₺/saat (operatör+yardımcı)")
    # Sarf malzeme
    sarf_malzeme:    float = Field(150.0, ge=0, description="₺/m — bit, casing donanım, polimer")
    # Mobilizasyon (sabit maliyet)
    mobilizasyon:    float = Field(0.0,   ge=0, description="₺ — taşıma, kurulum")
    # Beton + donatı (opsiyonel)
    beton_m3_fiyat:  float = Field(0.0,   ge=0, description="₺/m³ — 0 ise dahil edilmez")
    donatı_kg_fiyat: float = Field(0.0,   ge=0, description="₺/kg — 0 ise dahil edilmez")
    donatı_kg_m:     float = Field(0.0,   ge=0, description="kg/m — kazık başına donatı yoğunluğu")
    # Genel gider + kâr
    genel_gider_pct: float = Field(15.0,  ge=0, le=100, description="% — overhead")
    kar_pct:         float = Field(10.0,  ge=0, le=100, description="% — kâr payı")
    # Kaydet mi?
    kaydet:          bool  = True


class MaliyetKalem(BaseModel):
    ad:      str
    tutar:   float
    aciklama: str
    yuzde:   float   # toplam içindeki pay


class MaliyetSonuc(BaseModel):
    kalemler:         list[MaliyetKalem]
    alt_toplam:       float
    genel_gider:      float
    kar_payi:         float
    toplam:           float
    kazik_basi:       float
    metre_basi:       float
    benchmark_min:    float
    benchmark_max:    float
    benchmark_yorum:  str
    sure_saat_kazik:  float
    tork_knm:         float
    parametreler:     dict


# ── Helper ────────────────────────────────────────────────────────────────────

def _layer_to_dict(l):
    return {
        "baslangic": l.baslangic, "bitis": l.bitis,
        "zem_tipi": l.zem_tipi, "kohezyon": l.kohezyon,
        "spt": l.spt, "ucs": l.ucs, "rqd": l.rqd,
        "cpt_qc": getattr(l, "cpt_qc", 0) or 0,
        "su": getattr(l, "su", 0) or 0,
        "formasyon": l.formasyon, "aciklama": l.aciklama,
    }


def _hesapla(project, layers, p: MaliyetParametreleri) -> MaliyetSonuc:
    """Core maliyet hesaplama — ORM bağımsız saf fonksiyon."""
    import math

    layer_dicts = [_layer_to_dict(l) for l in layers]
    yas = float(project.yeralti_suyu or 0)
    cap = project.kazik_capi
    boy = project.kazik_boyu
    adet = project.kazik_adedi
    is_tipi = project.is_tipi

    tork_aralik = gerekli_tork_aralik(layer_dicts, cap, is_tipi, yas)
    tork = tork_aralik["nominal"]
    c_m  = casing_metre(layer_dicts, yas)
    sure = kazik_suresi(layer_dicts, cap, boy, c_m)
    cevrim = tam_cevrim_suresi(layer_dicts, cap, boy, c_m, is_tipi)
    m_basi, tek_mazot = _mazot(tork, boy)["m_basi"], _mazot(tork, boy)["toplam"]

    toplam_sure = sure * adet   # toplam delgi saati

    # ── Kalem hesaplama ────────────────────────────────────────────────────
    # 1. Yakıt
    yakıt_tutar = round(m_basi * boy * adet * p.mazot_fiyati)

    # 2. Makine kirası
    makine_tutar = round(toplam_sure * p.makine_kirasi)

    # 3. İşçilik
    iscil_tutar = round(toplam_sure * p.iscilik_saat)

    # 4. Sarf malzeme
    sarf_tutar = round(boy * adet * p.sarf_malzeme)

    # 5. Mobilizasyon
    mobil_tutar = round(p.mobilizasyon)

    # 6. Beton + donatı (opsiyonel)
    r = (cap / 1000) / 2   # yarıçap (m)
    hacim_m3 = math.pi * r * r * boy  # tek kazık hacmi
    beton_tutar = round(hacim_m3 * adet * p.beton_m3_fiyat) if p.beton_m3_fiyat > 0 else 0
    donatı_tutar = round(p.donatı_kg_m * boy * adet * p.donatı_kg_fiyat) if (p.donatı_kg_fiyat > 0 and p.donatı_kg_m > 0) else 0

    alt_toplam = yakıt_tutar + makine_tutar + iscil_tutar + sarf_tutar + mobil_tutar + beton_tutar + donatı_tutar
    genel_gider = round(alt_toplam * p.genel_gider_pct / 100)
    kar_payi    = round((alt_toplam + genel_gider) * p.kar_pct / 100)
    toplam      = alt_toplam + genel_gider + kar_payi

    kazik_basi = round(toplam / adet) if adet else 0
    metre_basi = round(toplam / (boy * adet)) if boy * adet else 0

    # ── Kalemler listesi ──────────────────────────────────────────────────
    kalemler = []
    for ad, tutar, aciklama in [
        ("Yakıt (Mazot)",        yakıt_tutar,  f"{m_basi} L/m × {boy}m × {adet} kazık × {p.mazot_fiyati}₺/L"),
        ("Makine Kirası/Amort.", makine_tutar, f"{sure} sa/kazık × {adet} kazık × {p.makine_kirasi}₺/sa"),
        ("İşçilik",             iscil_tutar,  f"{sure} sa/kazık × {adet} kazık × {p.iscilik_saat}₺/sa"),
        ("Sarf Malzeme",        sarf_tutar,   f"{boy}m × {adet} kazık × {p.sarf_malzeme}₺/m"),
        ("Mobilizasyon",        mobil_tutar,  "Sabit maliyet"),
        ("Beton",               beton_tutar,  f"{hacim_m3:.2f} m³/kazık × {adet} kazık × {p.beton_m3_fiyat}₺/m³"),
        ("Donatı",              donatı_tutar, f"{p.donatı_kg_m} kg/m × {boy}m × {adet} kazık × {p.donatı_kg_fiyat}₺/kg"),
    ]:
        if tutar > 0:
            kalemler.append(MaliyetKalem(
                ad=ad, tutar=tutar, aciklama=aciklama,
                yuzde=round(tutar / toplam * 100, 1) if toplam else 0,
            ))

    # ── Benchmark karşılaştırması ──────────────────────────────────────────
    bmin, bmax = _BENCHMARK_LIMITE = _BENCHMARK_METRE_BASI.get(is_tipi, (3500, 7000))
    if metre_basi < bmin * 0.85:
        yorum = f"Hesaplanan birim fiyat ({metre_basi:,.0f} ₺/m) piyasa alt sınırının altında — parametreleri kontrol edin."
    elif metre_basi > bmax * 1.15:
        yorum = f"Hesaplanan birim fiyat ({metre_basi:,.0f} ₺/m) piyasa üst sınırının üzerinde — olağandışı zemin/makine koşulları mevcut olabilir."
    else:
        yorum = f"Hesaplanan birim fiyat ({metre_basi:,.0f} ₺/m) {is_tipi} için tipik piyasa aralığında ({bmin:,.0f}–{bmax:,.0f} ₺/m)."

    return MaliyetSonuc(
        kalemler=kalemler,
        alt_toplam=alt_toplam,
        genel_gider=genel_gider,
        kar_payi=kar_payi,
        toplam=toplam,
        kazik_basi=kazik_basi,
        metre_basi=metre_basi,
        benchmark_min=bmin,
        benchmark_max=bmax,
        benchmark_yorum=yorum,
        sure_saat_kazik=sure,
        tork_knm=tork,
        parametreler=p.model_dump(),
    )


# ── Endpoint: hesapla + kaydet ────────────────────────────────────────────────

@router.post("/projects/{project_id}/cost", response_model=MaliyetSonuc)
def calculate_cost(
    project_id: int,
    payload: MaliyetParametreleri,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(404, detail="Proje bulunamadı")

    layers = (
        db.query(models.SoilLayer)
        .filter(models.SoilLayer.project_id == project_id)
        .order_by(models.SoilLayer.baslangic)
        .all()
    )
    if not layers:
        raise HTTPException(400, detail="Zemin verisi girilmemiş")

    try:
        sonuc = _hesapla(project, layers, payload)
    except Exception as e:
        raise HTTPException(500, detail=f"Hesaplama hatası: {e}")

    # Mevcut açık analize ekle (en son kaydedilen)
    if payload.kaydet:
        last = (
            db.query(models.Analysis)
            .filter(models.Analysis.project_id == project_id)
            .order_by(models.Analysis.created_at.desc())
            .first()
        )
        if last:
            last.maliyet_json = sonuc.model_dump()
            db.commit()

    return sonuc


# ── Endpoint: son maliyet getir ───────────────────────────────────────────────

@router.get("/projects/{project_id}/cost", response_model=MaliyetSonuc)
def get_last_cost(
    project_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id,
    ).first()
    if not project:
        raise HTTPException(404, detail="Proje bulunamadı")

    last = (
        db.query(models.Analysis)
        .filter(
            models.Analysis.project_id == project_id,
            models.Analysis.maliyet_json.isnot(None),
        )
        .order_by(models.Analysis.created_at.desc())
        .first()
    )
    if not last or not last.maliyet_json:
        raise HTTPException(404, detail="Kayıtlı maliyet analizi bulunamadı")

    try:
        return MaliyetSonuc(**last.maliyet_json)
    except Exception:
        raise HTTPException(500, detail="Maliyet verisi okunamadı")
