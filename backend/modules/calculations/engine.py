"""
GeoDrill Backend Calculation Engine v3.0
=========================================
Mirror of frontend hesaplamalar.js — maintains calculation parity.
Any logic change must be applied in BOTH files.

v3.0 changes:
  - New torque formula: T = tau_eff × (pi × D³ / 8) × K_app × K_method × K_gw × K_depth × K_uncertainty
  - Resistance pathway priority: rock > su > CPT > SPT > inferred
  - Four-band machine suitability: RAHAT UYGUN / UYGUN / SINIRDA / UYGUN DEĞİL
  - Full cycle time: tam_cevrim_suresi() with concrete, rebar, contingency
  - Confidence scoring: guven_analizi() returns 0-100 score + level
  - Rule-based Turkish explanations: aciklama_uret()
  - Backward-compatible: all v2 callers continue to work unchanged

Source hierarchy and confidence classes are documented in
backend/configs/geotech_coefficients.py.
"""

import math
import re as _re
from typing import Dict, List, Optional

from configs.geotech_coefficients import KATSAYILAR


# ─── Soil Classification ──────────────────────────────────────────────────────

_STANDART = {
    "Dolgu", "Kil", "Silt", "Kum", "Çakıl",
    "Ayrışmış Kaya", "Kumtaşı", "Kireçtaşı", "Sert Kaya",
    "Organik Kil", "Torf",
}

# Rock compound nouns — checked before soil keywords
_KAYA_ANAHTAR = [
    (_re.compile(r"sert\s*kaya|granit|bazalt|diyabaz|gnays|mermer|kuvarsit|riyolit|andezit|gabro", _re.I), "Sert Kaya"),
    (_re.compile(r"kireçtaşı|kalker|kalkerli|fosilli\s*k|nümmülit|mikritik\s*k|biyoklastik|rudist", _re.I), "Kireçtaşı"),
    (_re.compile(r"kumtaşı|grovak|arenit|çakıltaşı|konglomera|brekş", _re.I), "Kumtaşı"),
    (_re.compile(r"ayrışmış\s*kaya|bozuşmuş\s*kaya", _re.I), "Ayrışmış Kaya"),
]

_ZEMIN_ANAHTAR = [
    (_re.compile(r"dolgu|moloz|yapay", _re.I), "Dolgu"),
    (_re.compile(r"çakıl", _re.I), "Çakıl"),
    (_re.compile(r"kum", _re.I), "Kum"),
    (_re.compile(r"silt", _re.I), "Silt"),
    (_re.compile(r"kil", _re.I), "Kil"),
]


def zemin_hesap_tipi(zem_tipi: str, kohezyon: str = "") -> Optional[str]:
    """
    Maps any free-text geological description to one of the 9 standard calculation types.
    Mirror of hesaplamalar.js::zeminHesapTipi — keep in sync.

    Returns one of: Dolgu, Kil, Silt, Kum, Çakıl, Ayrışmış Kaya,
    Kumtaşı, Kireçtaşı, Sert Kaya, or None if truly unknown.
    """
    if not zem_tipi:
        return "Kum"
    s = zem_tipi.strip()
    if s in _STANDART:
        return s
    for pattern, tip in _KAYA_ANAHTAR:
        if pattern.search(s):
            return tip
    # For mixed soil names, last keyword wins (dominant fraction in Turkish convention)
    last_tip, last_idx = None, -1
    for pattern, tip in _ZEMIN_ANAHTAR:
        m = pattern.search(s)
        if m and m.start() > last_idx:
            last_idx = m.start()
            last_tip = tip
    if last_tip:
        return last_tip
    # Fallback: kohezyon-based (only when cohesion class is explicitly known)
    if kohezyon == "Kohezyonlu":
        return "Kil"
    if kohezyon == "Kaya":
        return "Ayrışmış Kaya"
    if kohezyon == "Kohezyonsuz":
        return "Kum"
    return None  # truly unknown — callers use their own defaults


def zemin_sinifi(zem_tipi: str, kohezyon: str = "") -> str:
    """
    Returns broad soil class: "kohezyonlu" | "granüler" | "kaya" | "belirsiz".
    Used by torque, stability, and casing calculations.
    """
    tip = zemin_hesap_tipi(zem_tipi, kohezyon)
    if not tip:
        return "belirsiz"
    if tip in ("Kil", "Silt", "Organik Kil", "Torf"):
        return "kohezyonlu"
    if tip in ("Kum", "Çakıl", "Dolgu"):
        return "granüler"
    if tip in ("Ayrışmış Kaya", "Kumtaşı", "Kireçtaşı", "Sert Kaya"):
        return "kaya"
    return "belirsiz"


def guven_sinifi(layer: dict) -> dict:
    """
    Backward-compatible per-layer confidence class assessment.
    Returns {"sinif": "A"|"B"|"C", "aciklama": str}.

    v3.0: Also considers su and cpt_qc fields.
    """
    su = float(layer.get("su") or 0)
    cpt_qc = float(layer.get("cpt_qc") or 0)
    ucs = float(layer.get("ucs") or 0)
    spt = float(layer.get("spt") or 0)

    sinif_str = zemin_sinifi(layer.get("zem_tipi", ""), layer.get("kohezyon", ""))

    if sinif_str == "kaya" and ucs > 0:
        return {"sinif": "B", "aciklama": "UCS ölçümünden türetilmiş (Sınıf B)"}
    if sinif_str != "kaya" and su > 0:
        return {"sinif": "A", "aciklama": "Ölçülmüş su kullanıldı (Sınıf A)"}
    if cpt_qc > 0:
        return {"sinif": "B", "aciklama": "CPT qc korelasyonundan türetilmiş (Sınıf B)"}
    if ucs > 0:
        return {"sinif": "B", "aciklama": "UCS ölçümünden türetilmiş (Sınıf B)"}
    # SPT yalnızca kaya olmayan zeminlerde güven göstergesi sayılır (kaya'da SPT uygulanmaz)
    if spt > 0 and sinif_str != "kaya":
        return {"sinif": "B", "aciklama": "SPT korelasyonundan türetilmiş (Sınıf B)"}
    return {"sinif": "C", "aciklama": "Yalnızca niteliksel zemin adı (Sınıf C)"}


# ─── Stability Risk ───────────────────────────────────────────────────────────

def stabilite_riski(tip: str, kohezyon: str, spt: float,
                    yas: float, baslangic: float = 0, su: float = 0) -> str:
    """
    Per-layer stability risk classification.

    Returns: "Yüksek" | "Orta" | "Düşük"

    Engineering basis:
        Source: EN 1536:2010 §5 (hole stability), FHWA GEC 10 §4.
        - Sand/gravel below GWT → always high risk (borehole collapse likely).
        - Very loose cohesionless (N<10) → high risk.
        - Medium-dense cohesionless (10<=N<30) → medium risk.
        - Fill with N<5 → high risk (very loose / uncontrolled fill).
        - Fill → medium risk (variable composition).
        - Soft clay (su<15 kPa or N<2): EN 1536 §5.3 soil-flow limit → high risk.
        - Soft-medium clay (su<40 kPa or N<8) → medium risk.
        - Organik Kil, Torf → always high risk (organic soils / peat).
        - All other conditions → low risk.
    """
    C = KATSAYILAR.stabilite
    hesap_tip = zemin_hesap_tipi(tip, kohezyon)

    # Granüler: Kum ve Çakıl — YAS ve gevşeklik kontrolü
    if hesap_tip in ("Kum", "Çakıl"):
        return "Yüksek" if (yas > 0 and baslangic >= yas) else "Orta"

    # Kohezyonsuz (genel)
    if kohezyon == "Kohezyonsuz" and spt <= C.cok_gevsek_spt:
        return "Yüksek"
    if kohezyon == "Kohezyonsuz" and spt <= C.orta_spt:
        return "Orta"

    # Organik / torf — her zaman yüksek risk
    if hesap_tip in ("Organik Kil", "Torf"):
        return "Yüksek"

    # Kohezyonlu (Kil, Silt, Organik Kil): yumuşak kil kontrolü
    # EN 1536:2010 §5.3: su < 15 kPa → zemin akması riski
    if hesap_tip in ("Kil", "Silt") or kohezyon == "Kohezyonlu":
        if su > 0 and su < 15:
            return "Yüksek"   # EN 1536 §5.3 soil-flow limit
        if su > 0 and su < 40:
            return "Orta"
        if spt > 0 and spt < 2:
            return "Yüksek"   # çok yumuşak kil (Terzaghi sınıflaması)
        if spt > 0 and spt < 8:
            return "Orta"     # yumuşak-orta kil

    # Dolgu: SPT bazlı değerlendirme (çok gevşek dolgu = yüksek risk)
    if hesap_tip == "Dolgu":
        if spt > 0 and spt < 5:
            return "Yüksek"
        return "Orta"

    return "Düşük"


# ─── Liquefaction Screening ───────────────────────────────────────────────────

def sivi_lasma_riski(tip: str, kohezyon: str, spt: float,
                     yas: float, baslangic: float) -> str:
    """
    Simplified liquefaction potential screening for granular soils below GWT.

    Returns: "Yüksek" | "Orta" | "Düşük" | "Yok"

    Engineering basis:
        Source: Seed & Idriss (1971); Youd et al. (2001) ASCE J. Geotech.
        - Only applicable: cohesionless below GWT, depth < 20 m.
        - (N1)60 < 15 → high liquefaction potential.
        - (N1)60 < 25 → moderate liquefaction potential.
        - Clay/rock/above GWT → "Yok" (not applicable).
    """
    sinif = zemin_sinifi(tip, kohezyon)
    if sinif != "granüler":
        return "Yok"
    if yas <= 0 or baslangic < yas:
        return "Yok"   # kuru veya YAS üstü
    if baslangic > 20:
        return "Yok"   # çok derin (sıvılaşma mekanizması geçersiz)
    n = float(spt or 0)
    if n == 0:
        return "Yok"   # SPT verisi yok — değerlendirme yapılamaz
    if n < 15:
        return "Yüksek"
    if n < 25:
        return "Orta"
    return "Düşük"


# ─── Casing Decision ──────────────────────────────────────────────────────────

def casing_durum(layers: list, yas: float) -> dict:
    """
    Casing / temporary support requirement assessment.

    Returns:
        {durum: str, gerekce: [str], zorunlu: bool}

    Engineering basis:
        Source: EN 1536:2010 §5, FHWA GEC 10 §7.3.
    """
    C = KATSAYILAR.casing
    gerekce = []
    zorunlu = False
    sartli = False

    for row in layers:
        spt = float(row.get("spt") or 0)
        k = float(row.get("bitis", 0)) - float(row.get("baslangic", 0))
        zem = row.get("zem_tipi", "")
        koh = row.get("kohezyon", "")
        bas = float(row.get("baslangic", 0))

        hesap_tip = zemin_hesap_tipi(zem, koh)
        if hesap_tip in ("Kum", "Çakıl") and k > C.kum_cakil_min_kalinlik:
            zorunlu = True
            gerekce.append(f"{zem} ({bas}–{row['bitis']} m, {k} m) — EN 1536 §5 gereği")
        if koh == "Kohezyonsuz" and yas > 0 and bas >= yas:
            zorunlu = True
            gerekce.append(f"Kohezyonsuz ({bas}–{row['bitis']} m) YAS ({yas} m) altında")
        if spt < C.cok_gevsek_spt and koh == "Kohezyonsuz":
            zorunlu = True
            gerekce.append(f"SPT={spt}<{C.cok_gevsek_spt} ({bas}–{row['bitis']} m) — çok gevşek")
        if hesap_tip == "Dolgu" and k > C.dolgu_sartli_kalinlik:
            sartli = True
            gerekce.append(f"Dolgu ({bas}–{row['bitis']} m, {k} m) — kalın dolgu, önerilir")

        # Yumuşak kil squeezing: YAS altında su<25 kPa veya SPT<2 → plastik akma riski
        # Kaynak: EN 1536:2010 §5.3; sondaj borusu kapanması (squeezing) mekanizması
        sinif_str = zemin_sinifi(zem, koh)
        su_val = float(row.get("su") or 0)
        if sinif_str == "kohezyonlu" and yas > 0 and bas >= yas:
            if (su_val > 0 and su_val < 25) or (su_val == 0 and spt > 0 and spt < 2):
                zorunlu = True
                param_str = f"su={su_val} kPa" if su_val > 0 else f"SPT={spt}"
                gerekce.append(
                    f"Yumuşak kil squeezing riski ({bas}–{row['bitis']} m): "
                    f"{param_str}, YAS altında — EN 1536 §5.3"
                )
            elif su_val > 0 and su_val < 50:
                sartli = True
                gerekce.append(
                    f"Orta kil squeezing olasılığı ({bas}–{row['bitis']} m): "
                    f"su={su_val} kPa, YAS altında"
                )

        # Organik kil ve Torf: her zaman zorunlu casing
        if hesap_tip in ("Organik Kil", "Torf"):
            zorunlu = True
            gerekce.append(
                f"{hesap_tip} ({bas}–{row['bitis']} m) — organik zemin, casing zorunlu"
            )

    durum = "Gerekli" if zorunlu else "Şartlı önerilir" if sartli else "Gerekmeyebilir"
    return {"durum": durum, "gerekce": gerekce, "zorunlu": zorunlu}


def casing_metre(layers: list, yas: float) -> float:
    """
    Estimates required casing length (m).
    100% of high-risk layer, 50% of medium-risk layer.
    Source: EN 1536:2010 §5; FHWA GEC 10 §7.3.
    """
    C = KATSAYILAR.casing
    toplam = 0.0
    for row in layers:
        k = float(row.get("bitis", 0)) - float(row.get("baslangic", 0))
        risk = stabilite_riski(
            row.get("zem_tipi", ""), row.get("kohezyon", ""),
            float(row.get("spt") or 0), yas, float(row.get("baslangic", 0))
        )
        if risk == "Yüksek":
            toplam += k * C.yuksek_risk_oran
        elif risk == "Orta":
            toplam += k * C.orta_risk_oran
    return round(toplam * 10) / 10


# ─── Rate of Penetration ─────────────────────────────────────────────────────

def rop_hesapla(tip: str, ucs: float, cap_mm: float, kohezyon: str = "",
                spt: float = 0, yas: float = 0, baslangic: float = 0) -> float:
    """
    Estimated penetration rate (m/hr). Class C.

    v3.0 additions:
    - SPT-based ROP reduction for dense granular soils.
    - Groundwater ROP correction.

    Parameters
    ----------
    tip : str
        Soil type label.
    ucs : float
        UCS (MPa), 0 if not rock or not measured.
    cap_mm : float
        Pile diameter (mm).
    kohezyon : str
        Cohesion class.
    spt : float
        SPT N60. Used for dense granular reduction.
    yas : float
        Groundwater depth (m). 0 = no GWT data.
    baslangic : float
        Layer start depth (m) for GWT comparison.

    Returns
    -------
    float
        Penetration rate (m/hr), minimum min_rop.

    Source: FHWA GEC 10 §7; Zayed & Halpin (2005); Turkish field data.
    """
    R = KATSAYILAR.rop
    cap_m = cap_mm / 1000.0
    hesap_tip = zemin_hesap_tipi(tip, kohezyon)
    baz = R.baz.get(hesap_tip, R.varsayilan)

    # UCS reduction for rock
    if ucs > 0:
        baz *= max(R.ucs_azaltma_min, 1.0 - (ucs / 100.0) * R.ucs_azaltma_katsayi)

    # Diameter penalty
    baz *= max(R.cap_azaltma_min, 1.0 - (cap_m - R.referans_cap_m) * R.cap_azaltma_katsayi)

    # SPT-based reduction for dense granular layers
    sinif = zemin_sinifi(tip, kohezyon)
    if sinif == "granüler" and spt > R.spt_azaltma_esigi:
        spt_faktor = max(0.30, 1.0 - (spt - R.spt_azaltma_esigi) * R.spt_azaltma_katsayi)
        baz *= spt_faktor

    # Groundwater ROP correction
    GW = KATSAYILAR.zemin_suyu
    if yas > 0 and baslangic >= yas:
        if sinif == "kohezyonlu":
            baz *= GW.rop_kohezyonlu
        elif sinif == "granüler":
            baz *= GW.rop_kohezyon_siz
        elif sinif == "kaya":
            baz *= GW.rop_kaya

    return max(baz, R.min_rop)


# ─── Required Torque — Range Output ──────────────────────────────────────────

def gerekli_tork_aralik(layers: list, cap_mm: float,
                         is_tipi: str = "Fore Kazık",
                         yas: float = 0) -> dict:
    """
    Required torque range for Kelly/rotary bored pile drilling.

    v3.0 formula:
        T = tau_eff × (pi × D³ / 8) × K_app × K_method × K_gw × K_depth × K_uncertainty

    Parameters
    ----------
    layers : list
        List of soil layer dicts. Each must have baslangic, bitis, zem_tipi,
        kohezyon, spt, ucs, rqd. Optionally: cpt_qc, su.
    cap_mm : float
        Pile diameter (mm).
    is_tipi : str
        Project work type (affects K_method). Default "Fore Kazık".
    yas : float
        Groundwater depth (m). 0 = no GWT data.

    Returns
    -------
    dict
        {nominal, min, max, guven, aciklama, uyarilar, katman_detaylari}

    Source: FHWA GEC 10 §7, EN 1536:2010 §8.
    """
    from modules.calculations.soil_resistance import (
        direnc_indeksi, zemin_sinifi_detay,
        yontem_katsayisi, zemin_suyu_katsayisi, derinlik_katsayisi,
    )

    cap_m = cap_mm / 1000.0
    K = KATSAYILAR.tork
    aciklama = []
    uyarilar = []
    katman_detaylari = []
    max_nominal = 0.0
    guven_siniflari = []

    # K_method: method multiplier for the drilling technique
    k_method = yontem_katsayisi(is_tipi)
    if is_tipi not in KATSAYILAR.yontem.carpan:
        uyarilar.append(
            f"UYARI: '{is_tipi}' için tork çarpanı tanımlı değil; "
            f"Fore Kazık (1.00) varsayıldı."
        )

    if not layers:
        return {
            "nominal": 0, "min": 0, "max": 0, "guven": "C",
            "aciklama": ["Zemin verisi yok"], "uyarilar": uyarilar,
            "katman_detaylari": [],
        }

    for row in layers:
        spt = float(row.get("spt") or 0)
        ucs = float(row.get("ucs") or 0)
        rqd = float(row.get("rqd") or 0)
        baslangic = float(row.get("baslangic") or 0)
        bitis = float(row.get("bitis") or 0)
        zem = row.get("zem_tipi", "")
        koh = row.get("kohezyon", "")

        sinif = zemin_sinifi_detay(zem, koh)
        gs = guven_sinifi(row)
        guven_siniflari.append(gs["sinif"])

        # Get tau_eff via resistance pathway priority
        direnc = direnc_indeksi(row)
        tau_eff = direnc["tau_kPa"]

        # K_gw: groundwater factor
        k_gw = zemin_suyu_katsayisi(sinif, baslangic, yas)

        # K_depth: depth factor based on layer midpoint (FHWA GEC 10 §7.4)
        k_depth = derinlik_katsayisi(baslangic, bitis)

        # K_uncertainty: RQD-based variability for rock layers
        rqd_faktor = 1.0
        if sinif == "kaya":
            if rqd > 0 or ucs > 0:
                for esik in (75, 50, 25, 0):
                    if rqd >= esik:
                        rqd_faktor = K.rqd_faktor[esik]
                        break
            else:
                # No rock quality data → use worst-case RQD factor
                rqd_faktor = K.rqd_faktor[0]

        # Full torque formula: T = tau × (pi × D³ / 12) × K_app × K_method × K_gw × K_depth × K_rqd
        # FHWA GEC 10 §7.4: Kelly bucket base shear → pi*D³/12 (not /8 disk model)
        t_nominal = (
            tau_eff
            * (math.pi * cap_m**3 / 12.0)
            * K.uygulama_faktoru
            * k_method
            * k_gw
            * k_depth
            * rqd_faktor
        )

        # Build per-layer detail record
        katman_kayit = {
            "baslangic":     baslangic,
            "bitis":         bitis,
            "zem_tipi":      zem,
            "sinif":         sinif,
            "tau_eff_kPa":   tau_eff,
            "source":        direnc["source"],
            "confidence":    direnc["confidence"],
            "k_method":      k_method,
            "k_gw":          k_gw,
            "k_depth":       k_depth,
            "k_rqd":         rqd_faktor,
            "t_katman_kNm":  round(t_nominal * 10) / 10,
            "notes":         direnc["notes"],
        }
        katman_detaylari.append(katman_kayit)

        if t_nominal > max_nominal:
            max_nominal = t_nominal
            aciklama.clear()
            aciklama.extend([
                f"Belirleyici katman: {zem} ({baslangic}–{bitis} m)",
                f"τ_eff={tau_eff} kPa [kaynak: {direnc['source']}, Sınıf {direnc['confidence']}]",
                f"K_method={k_method}, K_gw={k_gw}, K_depth={k_depth}, K_rqd={rqd_faktor}",
                f"T_nom = {round(t_nominal * 10) / 10} kNm",
            ])

    nominal = round(max_nominal * 10) / 10
    guven = "C" if "C" in guven_siniflari else "B" if "B" in guven_siniflari else "A"

    return {
        "nominal":          nominal,
        "min":              round(nominal * K.alt_bant * 10) / 10,
        "max":              round(nominal * K.ust_bant * 10) / 10,
        "guven":            guven,
        "aciklama":         aciklama,
        "uyarilar":         uyarilar,
        "katman_detaylari": katman_detaylari,
    }


def gerekli_tork(layers: list, cap_mm: float) -> float:
    """Backward-compatible single-value wrapper for gerekli_tork_aralik."""
    return gerekli_tork_aralik(layers, cap_mm)["nominal"]


# ─── Critical Layer ───────────────────────────────────────────────────────────

def kritik_katman(layers: list) -> Optional[dict]:
    """
    Identifies the geotechnically most critical (complex) layer.

    Scoring = tau_eff × sinif_agirlik × thickness_m.
    The layer with the highest score is returned as the critical layer.

    Engineering basis:
        Rock layers govern torque. Dense granular layers below GWT govern
        stability. Thick cohesive layers affect construction time.
        Source: Engineering judgment; FHWA GEC 10 §3.
    """
    if not layers:
        return None

    from modules.calculations.soil_resistance import direnc_indeksi, zemin_sinifi_detay

    agirlik = KATSAYILAR.kritik_katman_agirlik
    max_skor = -1.0
    kritik = None

    for row in layers:
        sinif = zemin_sinifi_detay(
            row.get("zem_tipi", ""), row.get("kohezyon", "")
        )
        direnc = direnc_indeksi(row)
        tau = direnc["tau_kPa"]
        w = agirlik.get(sinif, 1.0)
        kalinlik = float(row.get("bitis", 0)) - float(row.get("baslangic", 0))
        skor = tau * w * max(kalinlik, 0.5)  # minimum 0.5 m to avoid zero-thickness

        if skor > max_skor:
            max_skor = skor
            kritik = {**row, "sinif": sinif, "kritik_skor": round(skor, 2)}

    return kritik


# ─── Full Cycle Time ──────────────────────────────────────────────────────────

def tam_cevrim_suresi(layers: list, cap_mm: float, kazik_boyu: float,
                      casing_m: float, is_tipi: str = "Fore Kazık") -> dict:
    """
    Full pile cycle time calculation.

    Components:
        t_cycle = t_drill + t_beton + t_donati + t_casing +
                  t_kurulum + t_rekonumlama + t_beklenmedik

    Where:
        t_beklenmedik = acil_beklenmedik_oran × (t_drill + t_beton + t_donati)
        piles_per_day = floor(gunluk_calisma_saat / t_cycle)

    Parameters
    ----------
    layers : list
        Soil layer dicts.
    cap_mm : float
        Pile diameter (mm).
    kazik_boyu : float
        Pile length (m).
    casing_m : float
        Required casing length (m).
    is_tipi : str
        Work type (for ROP lookup in future; currently not changing base ROP).

    Returns
    -------
    dict
        {t_delme, t_beton, t_donati, t_casing_ops, t_kurulum, t_rekonumlama,
         t_beklenmedik, t_toplam_cevrim, kazik_basi_gun, gunluk_uretim_adet}

    Source: Zayed & Halpin (2005); EN 1536:2010 §8; Turkish field calibration.
    """
    CV = KATSAYILAR.cevrim
    S = KATSAYILAR.sure  # backward-compat alias

    # ── Drilling time (t_delme) ──────────────────────────────────────────────
    t_delme = 0.0
    uc_deg = 0
    onceki_tip = None

    for row in layers:
        k = float(row.get("bitis", 0)) - float(row.get("baslangic", 0))
        koh_row = row.get("kohezyon", "")
        ucs_row = float(row.get("ucs") or 0)
        spt_row = float(row.get("spt") or 0)
        bas_row = float(row.get("baslangic") or 0)
        hesap_tip = zemin_hesap_tipi(row.get("zem_tipi", ""), koh_row)
        rop = rop_hesapla(
            row.get("zem_tipi", ""), ucs_row, cap_mm, koh_row,
            spt=spt_row, yas=0, baslangic=bas_row
        )
        t_delme += k / rop

        kaya_tipleri = ("Kumtaşı", "Kireçtaşı", "Sert Kaya", "Ayrışmış Kaya")
        if (hesap_tip in kaya_tipleri
                and onceki_tip is not None
                and onceki_tip not in kaya_tipleri):
            uc_deg += 1
        onceki_tip = hesap_tip

    t_delme += uc_deg * CV.alet_degisim_saat

    # Depth surcharge (rod handling overhead)
    ek_sure = (CV.derinlik_ek[40] if kazik_boyu >= 40
               else CV.derinlik_ek[30] if kazik_boyu >= 30
               else CV.derinlik_ek[20] if kazik_boyu >= 20
               else CV.derinlik_ek[0])
    t_delme += ek_sure

    # ── Parallel / sequential components ────────────────────────────────────
    t_beton = kazik_boyu * CV.beton_saat_m         # concrete placement
    t_donati = kazik_boyu * CV.donati_saat_m        # rebar cage
    t_casing_ops = casing_m * CV.casing_saat_m      # casing installation

    # ── Rig positioning and logistics ───────────────────────────────────────
    t_kurulum = CV.kurulum
    t_rekonumlama = CV.yeniden_konumlanma

    # ── Contingency (unforeseen downtime) ────────────────────────────────────
    t_beklenmedik = (t_delme + t_beton + t_donati) * CV.acil_beklenmedik_oran

    # ── Total cycle per pile ─────────────────────────────────────────────────
    t_toplam_cevrim = (
        t_delme + t_beton + t_donati + t_casing_ops
        + t_kurulum + t_rekonumlama + t_beklenmedik
    )

    # ── Productivity ─────────────────────────────────────────────────────────
    gunluk_uretim_adet = int(math.floor(CV.gunluk_calisma_saat / t_toplam_cevrim)) if t_toplam_cevrim > 0 else 0
    kazik_basi_gun = round(t_toplam_cevrim / CV.gunluk_calisma_saat * 10) / 10

    return {
        "t_delme":            round(t_delme * 10) / 10,
        "t_beton":            round(t_beton * 10) / 10,
        "t_donati":           round(t_donati * 10) / 10,
        "t_casing_ops":       round(t_casing_ops * 10) / 10,
        "t_kurulum":          round(t_kurulum * 10) / 10,
        "t_rekonumlama":      round(t_rekonumlama * 10) / 10,
        "t_beklenmedik":      round(t_beklenmedik * 10) / 10,
        "t_toplam_cevrim":    round(t_toplam_cevrim * 10) / 10,
        "kazik_basi_gun":     kazik_basi_gun,
        "gunluk_uretim_adet": gunluk_uretim_adet,
    }


def kazik_suresi(layers: list, cap_mm: float, kazik_boyu: float,
                 casing_m: float) -> float:
    """
    Backward-compatible single-pile drilling time (hours).

    Delegates to tam_cevrim_suresi and returns only the drilling component (t_delme).
    For full cycle including concrete, rebar, and logistics, use tam_cevrim_suresi().

    Source: Zayed & Halpin (2005); FHWA GEC 10 §6; Turkish field calibration.
    """
    cevrim = tam_cevrim_suresi(layers, cap_mm, kazik_boyu, casing_m)
    return cevrim["t_delme"]


# ─── Fuel Estimate ────────────────────────────────────────────────────────────

def mazot_tahmini(tork: float, kazik_boyu: float) -> dict:
    """
    Fuel consumption estimate per pile and per metre.

    Piecewise-linear model calibrated against OEM curves.
    Source: Conservative OEM fuel consumption data; Turkish contractor records.
    Class C — highly rig-dependent.

    Returns:
        {m_basi: float (L/m), toplam: float (L per pile)}
    """
    MZ = KATSAYILAR.mazot
    if tork < 100:
        m_basi = MZ.hafif_baz + tork * MZ.hafif_katsayi
    elif tork < 200:
        m_basi = MZ.orta_baz + (tork - 100) * MZ.orta_katsayi
    else:
        m_basi = MZ.agir_baz + (tork - 200) * MZ.agir_katsayi
    m_basi = round(m_basi * 10) / 10
    return {"m_basi": m_basi, "toplam": round(m_basi * kazik_boyu * 10) / 10}


# ─── Confidence Analysis ──────────────────────────────────────────────────────

def guven_analizi(layers: list, yas: float, kazik_boyu: float) -> dict:
    """
    Computes data confidence score and level for the full project analysis.

    Score range: 0–100 (additive; normalised to 100 cap).
    Levels: HIGH (>= 65), MEDIUM (35–64), LOW (< 35).

    Parameters
    ----------
    layers : list
        Soil layer dicts.
    yas : float
        Groundwater depth (m). >0 means GWT is known.
    kazik_boyu : float
        Pile design length (m). Used to check casing coverage completeness.

    Returns
    -------
    dict
        {puan, seviye, sebepler, eksik_veriler}

    Engineering basis:
        Source: FHWA GEC 10 §3.3 site characterisation adequacy;
        EN 1997-1 Table A.1 geotechnical category.
    """
    GV = KATSAYILAR.guven
    puan = 0
    sebepler = []
    eksik_veriler = []

    if not layers:
        return {
            "puan": 0,
            "seviye": "LOW",
            "sebepler": ["Zemin katmanı verisi yok"],
            "eksik_veriler": ["Zemin logu", "SPT/CPT", "Yüzey bilgisi"],
        }

    has_cpt = False
    has_su = False
    has_spt = False
    has_ucs = False
    has_rqd = False
    yas_bilinen = yas > 0

    for row in layers:
        if float(row.get("cpt_qc") or 0) > 0:
            has_cpt = True
        if float(row.get("su") or 0) > 0:
            has_su = True
        if float(row.get("spt") or 0) > 0:
            has_spt = True
        if float(row.get("ucs") or 0) > 0:
            has_ucs = True
        if float(row.get("rqd") or 0) > 0:
            has_rqd = True

    # Scoring
    if has_cpt:
        puan += GV.cpt_puan
        sebepler.append(f"CPT qc ölçümü mevcut (+{GV.cpt_puan} puan)")
    else:
        eksik_veriler.append("CPT qc profili")

    if has_su:
        puan += GV.su_olculmus_puan
        sebepler.append(f"Ölçülmüş su (laboratuvar/arazi) mevcut (+{GV.su_olculmus_puan} puan)")
    else:
        eksik_veriler.append("Ölçülmüş drenajsız kayma dayanımı (su)")

    if has_spt:
        puan += GV.spt_puan
        sebepler.append(f"SPT N değerleri mevcut (+{GV.spt_puan} puan)")
    else:
        eksik_veriler.append("SPT değerleri")

    if yas_bilinen:
        puan += GV.yas_bilinen_puan
        sebepler.append(f"Yeraltı suyu seviyesi bilinmekte (+{GV.yas_bilinen_puan} puan)")
    else:
        eksik_veriler.append("Yeraltı suyu seviyesi")

    if has_ucs:
        puan += GV.ucs_olculmus_puan
        sebepler.append(f"UCS ölçümü mevcut (+{GV.ucs_olculmus_puan} puan)")
    else:
        eksik_veriler.append("UCS (tek eksenli basınç dayanımı)")

    if has_rqd:
        puan += GV.rqd_olculmus_puan
        sebepler.append(f"RQD değerleri mevcut (+{GV.rqd_olculmus_puan} puan)")
    else:
        eksik_veriler.append("RQD (kaya kalite göstergesi)")

    # Casing coverage check (bonus for completeness)
    if layers:
        max_bitis = max(float(r.get("bitis", 0)) for r in layers)
        if max_bitis >= kazik_boyu:
            puan += GV.tam_kaplama_puan
            sebepler.append(f"Zemin logu kazık boyunu tam kapsamakta (+{GV.tam_kaplama_puan} puan)")
        else:
            eksik_veriler.append(
                f"Zemin logu kazık boyunu kapsamıyor "
                f"(log={max_bitis} m < kazık={kazik_boyu} m)"
            )

    puan = min(puan, 100)

    if puan >= GV.yuksek_esigi:
        seviye = "HIGH"
    elif puan >= GV.orta_esigi:
        seviye = "MEDIUM"
    else:
        seviye = "LOW"

    return {
        "puan":          puan,
        "seviye":        seviye,
        "sebepler":      sebepler,
        "eksik_veriler": eksik_veriler,
    }


# ─── Machine Suitability ──────────────────────────────────────────────────────

def makine_uygunluk(
    makine: dict,
    tork: float,
    kazik_boyu: float,
    kazik_capi: float,
    casing_gerekli: bool,
    is_tipi: str = "Fore Kazık",
    zemin: Optional[list] = None,
    yas: float = 0,
) -> dict:
    """
    Equipment suitability evaluation — four-band decision system.

    Bands (T_ratio = makine.tork / T_req_peak):
        RAHAT UYGUN : T_ratio >= 1.30
        UYGUN       : 1.10 <= T_ratio < 1.30
        SINIRDA     : 0.85 <= T_ratio < 1.10
        UYGUN DEĞİL : T_ratio < 0.85

    Parameters
    ----------
    makine : dict or ORM Equipment
        Machine record with keys: ad, tip, tork, max_derinlik, max_cap,
        casing, crowd_force (optional).
    tork : float
        Required torque (kNm) — peak value from gerekli_tork_aralik.
    kazik_boyu : float
        Pile design depth (m).
    kazik_capi : float
        Pile diameter (mm).
    casing_gerekli : bool
        True if casing is mandatory.
    is_tipi : str
        Project work type (for method compatibility check).
    zemin : list or None
        Soil layers (for displacement check). If None, displacement check skipped.
    yas : float
        Groundwater depth (m).

    Returns
    -------
    dict
        {karar, karar_bant, gerekce, red_sebepler, uyarilar,
         tork_oran, crowd_force_ok, displacement_ok, uretkenlik_notu}

    Source: FHWA GEC 10 §7; EN 1536; OEM technical specifications.
    """
    M = KATSAYILAR.makine
    B = M.bantlar
    Y = KATSAYILAR.yontem
    red = []
    uyarilar = []
    crowd_force_ok = True
    displacement_ok = True

    # Attribute access helper (works for both dicts and ORM objects)
    def _get(obj, key, default=None):
        if isinstance(obj, dict):
            return obj.get(key, default)
        return getattr(obj, key, default)

    makine_tip = _get(makine, "tip", "")
    makine_tork = float(_get(makine, "tork") or 0)
    makine_max_derinlik = float(_get(makine, "max_derinlik") or 0)
    makine_max_cap = float(_get(makine, "max_cap") or 0)
    makine_casing = _get(makine, "casing", "Hayır")
    makine_crowd_force = float(_get(makine, "crowd_force") or 0)
    makine_ad = _get(makine, "ad", "Makine")

    # ── 1. Method compatibility check ────────────────────────────────────────
    desteklenenler = M.method_uyumluluk.get(is_tipi, [is_tipi])
    if makine_tip not in desteklenenler:
        return {
            "karar":            "Uygun Değil",
            "karar_bant":       "UYGUN DEĞİL",
            "gerekce":          f"Method uyumsuz: proje '{is_tipi}' — makine '{makine_tip}'",
            "red_sebepler":     [f"Method uyumsuzluğu: {makine_tip} ≠ {is_tipi}"],
            "uyarilar":         [],
            "tork_oran":        0.0,
            "crowd_force_ok":   True,
            "displacement_ok":  False,
            "uretkenlik_notu":  "Method uyumsuzluğu nedeniyle üretkenlik değerlendirilemedi.",
        }

    # ── 2. Physical geometry checks ──────────────────────────────────────────
    if makine_max_derinlik > 0 and makine_max_derinlik < kazik_boyu:
        red.append(f"Derinlik yetersiz: {makine_max_derinlik} m < {kazik_boyu} m")
    if makine_max_cap > 0 and makine_max_cap < kazik_capi:
        red.append(f"Çap yetersiz: {makine_max_cap} mm < {kazik_capi} mm")
    # Kelly bar uzunluk kontrolü: kelly_uzunluk > 0 ise teorik max derinliği sınırlar
    makine_kelly = float(_get(makine, "kelly_uzunluk") or 0)
    if makine_kelly > 0 and kazik_boyu > makine_kelly:
        red.append(
            f"Kelly bar uzunluğu yetersiz: {makine_kelly} m < {kazik_boyu} m — "
            f"modüler Kelly veya geçme Kelly ile çözülebilir"
        )

    # ── 3. Torque ratio (T_ratio) ────────────────────────────────────────────
    tork_oran = makine_tork / tork if tork > 0 else 999.0

    if tork_oran < B.sinirda_esigi:
        red.append(
            f"Tork yetersiz: {makine_tork} kNm < gerekli minimum "
            f"{round(tork * B.sinirda_esigi)} kNm "
            f"(oran={round(tork_oran * 100)}%, eşik=%{round(B.sinirda_esigi * 100)})"
        )

    if red:
        return {
            "karar":            "Uygun Değil",
            "karar_bant":       "UYGUN DEĞİL",
            "gerekce":          red[0],
            "red_sebepler":     red,
            "uyarilar":         [],
            "tork_oran":        round(tork_oran, 3),
            "crowd_force_ok":   True,
            "displacement_ok":  True,
            "uretkenlik_notu":  "Temel kriter başarısız; üretkenlik değerlendirilemedi.",
        }

    # ── 4. Casing check ──────────────────────────────────────────────────────
    if casing_gerekli and makine_casing == "Hayır":
        return {
            "karar":            "Uygun Değil",
            "karar_bant":       "UYGUN DEĞİL",
            "gerekce":          "Casing kapasitesi yok; yardımcı ekipman gerektirir",
            "red_sebepler":     ["Casing gerekli ancak makine casing donanımına sahip değil"],
            "uyarilar":         ["Casing gerektirir — uygun ekipman temin edin"],
            "tork_oran":        round(tork_oran, 3),
            "crowd_force_ok":   True,
            "displacement_ok":  True,
            "uretkenlik_notu":  "Casing eksikliği giderilirse yeniden değerlendirin.",
        }

    if casing_gerekli and makine_casing == "Şartlı":
        uyarilar.append("Casing kapasitesi şartlı — konfigürasyonu doğrulayın")

    # ── 5. Displacement method soil check ────────────────────────────────────
    displacement_methods = {"Yerinden Etme", "Kısmi Yerinden Etme"}
    if is_tipi in displacement_methods and zemin:
        for row in zemin:
            spt_row = float(row.get("spt") or 0)
            ucs_row = float(row.get("ucs") or 0)
            if spt_row > Y.displacement_spt_red:
                displacement_ok = False
                uyarilar.append(
                    f"YERİNDEN ETME REDDİ: {row.get('zem_tipi','')} "
                    f"({row.get('baslangic')}–{row.get('bitis')} m) "
                    f"SPT={spt_row} > {Y.displacement_spt_red} (FHWA GEC 8)"
                )
            elif spt_row > Y.displacement_spt_uyari:
                uyarilar.append(
                    f"Yerinden etme uyarısı: SPT={spt_row} > {Y.displacement_spt_uyari} "
                    f"({row.get('zem_tipi','')} {row.get('baslangic')}–{row.get('bitis')} m)"
                )
            if ucs_row > Y.ucs_red:
                displacement_ok = False
                uyarilar.append(
                    f"Yerinden etme metodu kaya formasyonda uygulanamaz: "
                    f"UCS={ucs_row} MPa > {Y.ucs_red} MPa "
                    f"({row.get('zem_tipi','')} {row.get('baslangic')}–{row.get('bitis')} m)"
                )

    # ── 6. Crowd force check ──────────────────────────────────────────────────
    if makine_crowd_force > 0 and tork > 0 and kazik_capi > 0:
        cap_m = kazik_capi / 1000.0
        gereken_crowd = tork * M.crowd_force_katsayi / cap_m
        if makine_crowd_force < gereken_crowd:
            crowd_force_ok = False
            uyarilar.append(
                f"Crowd force düşük: {makine_crowd_force} kN < tahmini gerekli "
                f"{round(gereken_crowd)} kN "
                f"(T×{M.crowd_force_katsayi}/D, Sınıf C)"
            )

    # ── 7. Four-band decision ─────────────────────────────────────────────────
    if tork_oran >= B.rahat_esigi:
        karar = "Rahat Uygun"
        karar_bant = "RAHAT UYGUN"
        gerekce = (
            f"Rahat uygun — tork marjı +%{round((tork_oran - 1) * 100)}. "
            f"Derinlik: {makine_max_derinlik} m, Çap: {makine_max_cap} mm."
        )
        uretkenlik_notu = (
            f"Tork rezervi yeterli, optimum üretkenlik beklenir. "
            f"Kazık başına tahmini süre düşük olacaktır."
        )
    elif tork_oran >= B.uygun_esigi:
        karar = "Uygun"
        karar_bant = "UYGUN"
        gerekce = (
            f"Uygun — tork oranı %{round(tork_oran * 100)}. "
            f"Yeterli operasyonel marj mevcut."
        )
        uretkenlik_notu = (
            f"Normal operasyonel marjda çalışma. "
            f"Beklenmedik zemin sertleşmelerinde tork limiti izlenmelidir."
        )
    elif tork_oran >= B.sinirda_esigi:
        karar = "Şartlı Uygun"
        karar_bant = "SINIRDA"
        gerekce = (
            f"Sınırda — tork oranı %{round(tork_oran * 100)}. "
            f"Dikkatli izleme ve risk yönetimi gereklidir."
        )
        uyarilar.append(
            f"Sınır koşullarda çalışma: tork %{round(tork_oran * 100)} kapasitede. "
            f"Zemin sertleşmesi durumunda iş durabilir."
        )
        uretkenlik_notu = (
            f"Marjinal tork ile çalışma üretkenliği düşürür ve ekipman aşınmasını artırır. "
            f"Rotasyon hızını kısıtlayın; sürekli izleme önerilebilir."
        )
    else:
        # Should have been caught in red checks, but defensive fallback
        karar = "Uygun Değil"
        karar_bant = "UYGUN DEĞİL"
        gerekce = f"Tork yetersiz: oran %{round(tork_oran * 100)}"
        uretkenlik_notu = "Yetersiz kapasite — üretkenlik değerlendirilemedi."

    # If displacement is not ok, downgrade to Uygun Değil
    if not displacement_ok and is_tipi in displacement_methods:
        karar = "Uygun Değil"
        karar_bant = "UYGUN DEĞİL"
        gerekce = "Yerinden etme metodu mevcut zemin/kaya koşullarında uygulanamaz."
        uretkenlik_notu = "Yerinden etme yöntemi reddedildi — metodu değiştirin."

    return {
        "karar":            karar,
        "karar_bant":       karar_bant,
        "gerekce":          gerekce,
        "red_sebepler":     red,
        "uyarilar":         uyarilar,
        "tork_oran":        round(tork_oran, 3),
        "crowd_force_ok":   crowd_force_ok,
        "displacement_ok":  displacement_ok,
        "uretkenlik_notu":  uretkenlik_notu,
    }


# ─── Automated Turkish Explanation ───────────────────────────────────────────

def aciklama_uret(
    makine_ad: str,
    karar: str,
    tork_oran: float,
    kritik_katman_row: Optional[dict],
    guven: dict,
    is_tipi: str,
    zemin: Optional[list] = None,
    yas: float = 0,
) -> str:
    """
    Generates a 2–3 sentence professional Turkish geotechnical assessment
    for a machine suitability decision.

    Parameters
    ----------
    makine_ad : str
        Machine name/identifier.
    karar : str
        Decision from makine_uygunluk: "Rahat Uygun" / "Uygun" /
        "Şartlı Uygun" / "Uygun Değil".
    tork_oran : float
        T_machine / T_req ratio.
    kritik_katman_row : dict or None
        Critical layer dict from kritik_katman().
    guven : dict
        Confidence analysis dict from guven_analizi().
    is_tipi : str
        Project work type.
    zemin : list or None
        Soil layers for contextual notes.
    yas : float
        Groundwater depth (m).

    Returns
    -------
    str
        Professional Turkish assessment text (2–3 sentences).
    """
    # Part 1: Decision statement
    oran_str = f"%{round(tork_oran * 100)}"
    if karar in ("Rahat Uygun",):
        c1 = (
            f"{makine_ad}, {is_tipi} projesi için gerekli torka karşı "
            f"{oran_str} oranında tork kapasitesine sahip olup rahat uygun kategorisindedir."
        )
    elif karar == "Uygun":
        c1 = (
            f"{makine_ad}, proje gereksinimleri için yeterli tork kapasitesine ({oran_str}) "
            f"sahip olup {is_tipi} işi için uygun değerlendirmektedir."
        )
    elif karar == "Şartlı Uygun":
        c1 = (
            f"{makine_ad}, tork kapasitesi {oran_str} olup sınır koşullarda çalışma "
            f"gerektirmekte; {is_tipi} için şartlı uygun olarak değerlendirilmektedir."
        )
    else:
        c1 = (
            f"{makine_ad}, {is_tipi} projesi için gerekli koşulları karşılayamamaktadır "
            f"(tork oranı: {oran_str})."
        )

    # Part 2: Critical layer / geology context
    c2 = ""
    if kritik_katman_row:
        zem = kritik_katman_row.get("zem_tipi", "belirsiz zemin")
        bas = kritik_katman_row.get("baslangic", "?")
        bit = kritik_katman_row.get("bitis", "?")
        sinif = kritik_katman_row.get("sinif", "")
        if sinif == "kaya":
            c2 = (
                f"Belirleyici katman {bas}–{bit} m arasındaki {zem} olup kaya yüzeyi kesme "
                f"torku hesabı en yüksek direktif değeri belirlemiştir (FHWA GEC 10 §7.4)."
            )
        elif sinif == "granüler":
            c2 = (
                f"Belirleyici katman {bas}–{bit} m arasındaki {zem} formasyonudur; "
                f"granüler zemin koşulları muhafaza borusu gereksinimini de etkilemektedir."
            )
        else:
            c2 = (
                f"Zemin profilindeki belirleyici katman {bas}–{bit} m arasında "
                f"konumlanan {zem} tabakasıdır."
            )

    # Part 3: Confidence and recommendation
    seviye = guven.get("seviye", "LOW")
    if seviye == "HIGH":
        c3 = (
            "Analiz yüksek güven seviyesinde veri kalitesiyle desteklenmekte olup "
            "sonuçlar tasarım aşamasında doğrudan kullanılabilir."
        )
    elif seviye == "MEDIUM":
        c3 = (
            "Analiz orta güven seviyesindedir; kritik katmanlar için ek saha araştırması "
            "yapılması önerilmektedir."
        )
    else:
        c3 = (
            "Veri kalitesi düşük güven sınıfındadır; bu sonuçlar ön değerlendirme amacıyla "
            "kullanılmalı ve kesin tasarım öncesi kapsamlı zemin araştırması yapılmalıdır."
        )

    parts = [p for p in (c1, c2, c3) if p]
    return " ".join(parts)


# ─── Full Analysis ────────────────────────────────────────────────────────────

def tam_analiz(proje: dict, layers: list) -> dict:
    """
    Convenience function: runs all calculations for a project+layers combo.
    Returns structured analysis dict suitable for report generation.

    Backward-compatible with v2.0 — all existing keys are preserved.
    v3.0 additions: guven_analizi, tam_cevrim_suresi fields included.
    """
    cap_mm = float(proje.get("kazik_capi", 800))
    kazik_boyu = float(proje.get("kazik_boyu", 18))
    yas = float(proje.get("yeralti_suyu", 0))
    is_tipi = proje.get("is_tipi", "Fore Kazık")

    tork_aralik = gerekli_tork_aralik(layers, cap_mm, is_tipi, yas)
    tork = tork_aralik["nominal"]
    casing_result = casing_durum(layers, yas)
    casing_m = casing_metre(layers, yas)

    # Full cycle (new in v3.0)
    cevrim = tam_cevrim_suresi(layers, cap_mm, kazik_boyu, casing_m, is_tipi)

    # Legacy sure = drilling time only (backward compat)
    sure = cevrim["t_delme"]

    mazot = mazot_tahmini(tork, kazik_boyu)
    gun = round(sure * proje.get("kazik_adedi", 1) * 10) / 10

    stabilite_skor = 0
    if layers:
        S = KATSAYILAR.stabilite
        toplam_puan = sum(
            S.puan.get(
                stabilite_riski(
                    r.get("zem_tipi", ""), r.get("kohezyon", ""),
                    float(r.get("spt") or 0), yas, float(r.get("baslangic", 0))
                ), 15
            )
            for r in layers
        )
        stabilite_skor = round(toplam_puan / len(layers))

    guven = guven_analizi(layers, yas, kazik_boyu)
    krit = kritik_katman(layers)

    return {
        # ── v2 fields (backward compat) ──────────────────────────────────────
        "tork_nominal":    tork,
        "tork_min":        tork_aralik["min"],
        "tork_max":        tork_aralik["max"],
        "tork_guven":      tork_aralik["guven"],
        "tork_aciklama":   tork_aralik["aciklama"],
        "tork_uyarilar":   tork_aralik["uyarilar"],
        "casing_durum":    casing_result["durum"],
        "casing_gerekce":  casing_result["gerekce"],
        "casing_zorunlu":  casing_result["zorunlu"],
        "casing_m":        casing_m,
        "sure":            sure,
        "m_basi":          mazot["m_basi"],
        "toplam_mazot":    mazot["toplam"],
        "toplam_gun":      gun,
        "stabilite_skor":  stabilite_skor,
        # ── v3 additions ─────────────────────────────────────────────────────
        "cevrim":          cevrim,
        "guven_analizi":   guven,
        "kritik_katman":   krit,
        "katman_detaylari": tork_aralik.get("katman_detaylari", []),
    }
