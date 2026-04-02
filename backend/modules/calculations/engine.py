"""
GeoDrill Backend Calculation Engine v2.0
=========================================
Mirror of frontend hesaplamalar.js — maintains calculation parity.
Any logic change must be applied in BOTH files.

Source hierarchy and confidence classes are documented in
backend/configs/geotech_coefficients.py.
"""

import math
from typing import Optional
from configs.geotech_coefficients import KATSAYILAR


# ─── Soil Classification ──────────────────────────────────────────────────────

import re as _re

_STANDART = {
    "Dolgu", "Kil", "Silt", "Kum", "Çakıl",
    "Ayrışmış Kaya", "Kumtaşı", "Kireçtaşı", "Sert Kaya",
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


def zemin_hesap_tipi(zem_tipi: str, kohezyon: str = "") -> str:
    """Maps any free-text geological description to one of the 9 standard calculation types.
    Mirror of hesaplamalar.js::zeminHesapTipi — keep in sync.
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
    tip = zemin_hesap_tipi(zem_tipi, kohezyon)
    if not tip:
        return "belirsiz"
    if tip in ("Kil", "Silt"):
        return "kohezyonlu"
    if tip in ("Kum", "Çakıl", "Dolgu"):
        return "granüler"
    if tip in ("Ayrışmış Kaya", "Kumtaşı", "Kireçtaşı", "Sert Kaya"):
        return "kaya"
    return "belirsiz"


def guven_sinifi(layer: dict) -> dict:
    if (layer.get("ucs") or 0) > 0:
        return {"sinif": "B", "aciklama": "UCS ölçümünden türetilmiş (Sınıf B)"}
    if (layer.get("spt") or 0) > 0:
        return {"sinif": "B", "aciklama": "SPT korelasyonundan türetilmiş (Sınıf B)"}
    return {"sinif": "C", "aciklama": "Yalnızca niteliksel zemin adı (Sınıf C)"}


# ─── Stability Risk ───────────────────────────────────────────────────────────

def stabilite_riski(tip: str, kohezyon: str, spt: float, yas: float, baslangic: float = 0) -> str:
    """
    Per-layer stability risk classification.
    Source: EN 1536:2010 §5, FHWA GEC 10 §4
    """
    C         = KATSAYILAR.stabilite
    hesap_tip = zemin_hesap_tipi(tip, kohezyon)
    if hesap_tip in ("Kum", "Çakıl"):
        return "Yüksek" if (yas > 0 and baslangic >= yas) else "Orta"
    if kohezyon == "Kohezyonsuz" and spt <= C.cok_gevsek_spt:
        return "Yüksek"
    if kohezyon == "Kohezyonsuz" and spt <= C.orta_spt:
        return "Orta"
    if hesap_tip == "Dolgu":
        return "Orta"
    return "Düşük"


# ─── Casing Decision ──────────────────────────────────────────────────────────

def casing_durum(layers: list, yas: float) -> dict:
    """
    Casing/temporary support requirement.
    Source: EN 1536:2010 §5, FHWA GEC 10 §7.3
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

    durum = "Gerekli" if zorunlu else "Şartlı önerilir" if sartli else "Gerekmeyebilir"
    return {"durum": durum, "gerekce": gerekce, "zorunlu": zorunlu}


def casing_metre(layers: list, yas: float) -> float:
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

def rop_hesapla(tip: str, ucs: float, cap_mm: float, kohezyon: str = "") -> float:
    """Estimated penetration rate (m/hr). Class C."""
    R         = KATSAYILAR.rop
    cap_m     = cap_mm / 1000
    hesap_tip = zemin_hesap_tipi(tip, kohezyon)
    baz       = R.baz.get(hesap_tip, R.varsayilan)
    if ucs > 0:
        baz *= max(R.ucs_azaltma_min, 1 - (ucs / 100) * R.ucs_azaltma_katsayi)
    baz *= max(R.cap_azaltma_min, 1 - (cap_m - R.referans_cap_m) * R.cap_azaltma_katsayi)
    return max(baz, R.min_rop)


# ─── Required Torque — Range Output ──────────────────────────────────────────

def gerekli_tork_aralik(layers: list, cap_mm: float, is_tipi: str = "Fore Kazık") -> dict:
    """
    Required torque range for Kelly/rotary bored pile drilling.
    Source: FHWA GEC 10 §7, EN 1536:2010 §8
    Returns: {nominal, min, max, guven, aciklama, uyarilar}
    """
    cap_m = cap_mm / 1000
    K = KATSAYILAR.tork
    aciklama = []
    uyarilar = []
    max_nominal = 0.0
    guven_siniflari = []

    if is_tipi != "Fore Kazık":
        uyarilar.append(
            f"UYARI: Tork modeli yalnızca Kelly/Rotary (Fore Kazık) için doğrulanmıştır. "
            f"'{is_tipi}' için farklı hesap motoru gereklidir."
        )

    if not layers:
        return {"nominal": 0, "min": 0, "max": 0, "guven": "C",
                "aciklama": ["Zemin verisi yok"], "uyarilar": uyarilar}

    for row in layers:
        spt = float(row.get("spt") or 0)
        ucs = float(row.get("ucs") or 0)
        rqd = float(row.get("rqd") or 0)
        zem       = row.get("zem_tipi", "")
        koh       = row.get("kohezyon", "")
        hesap_tip = zemin_hesap_tipi(zem, koh)
        sinif     = zemin_sinifi(zem, koh)
        gs        = guven_sinifi(row)
        guven_siniflari.append(gs["sinif"])

        # For rock types with no measured UCS, use type-specific default UCS
        ucs_etkili = ucs if ucs > 0 else (K.kaya_ucs_varsayilan.get(hesap_tip, 10.0) if sinif == "kaya" else 0.0)

        if ucs_etkili > 0 and sinif == "kaya":
            varsayilan_mi = ucs == 0
            tau = (ucs_etkili * 1000) / K.kaya_ucs_tau_boleni
            sinif_str = "C" if varsayilan_mi else "B"
            not_str = " (varsayılan)" if varsayilan_mi else ""
            tau_iz = f"UCS={ucs_etkili} MPa{not_str} → τ={round(tau)} kPa (UCS/35, FHWA GEC 10 §7.4, Sınıf {sinif_str})"
        elif sinif == "kohezyonlu":
            tau = max(spt * K.kohezyon_spt, K.kohezyon_su_min)
            tau_iz = f"SPT={spt} → su≈{round(tau)} kPa (N×{K.kohezyon_spt}, FHWA GEC 5, Sınıf B)"
        else:
            tau = max(spt * K.kohezyon_siz_spt, K.kohezyon_siz_tau_min)
            tau_iz = f"SPT={spt} → τ≈{round(tau)} kPa (granüler proxy, Sınıf C)"

        # RQD variability factor
        rqd_faktor = 1.0
        if rqd > 0 or ucs_etkili > 0:
            for esik in (75, 50, 25, 0):
                if rqd >= esik:
                    rqd_faktor = K.rqd_faktor[esik]
                    break

        t = tau * rqd_faktor * math.pi * cap_m**3 / 8 * K.uygulama_faktoru
        if t > max_nominal:
            max_nominal = t
            aciklama.clear()
            rqd_note = f" × RQD-faktör {rqd_faktor} (RQD={rqd}%)" if rqd_faktor != 1.0 else ""
            aciklama.extend([
                f"Belirleyici katman: {zem} ({row.get('baslangic')}–{row.get('bitis')} m)",
                tau_iz + rqd_note,
                f"Tnom = {round(t * 10) / 10} kNm",
            ])

    nominal = round(max_nominal * 10) / 10
    guven = "C" if "C" in guven_siniflari else "B" if "B" in guven_siniflari else "A"

    return {
        "nominal": nominal,
        "min": round(nominal * K.alt_bant * 10) / 10,
        "max": round(nominal * K.ust_bant * 10) / 10,
        "guven": guven,
        "aciklama": aciklama,
        "uyarilar": uyarilar,
    }


def gerekli_tork(layers: list, cap_mm: float) -> float:
    """Backward-compatible single-value wrapper."""
    return gerekli_tork_aralik(layers, cap_mm)["nominal"]


# ─── Pile Duration ────────────────────────────────────────────────────────────

def kazik_suresi(layers: list, cap_mm: float, kazik_boyu: float, casing_m: float) -> float:
    """Single-pile drilling cycle time (hours). Class C."""
    cap_m = cap_mm / 1000
    S = KATSAYILAR.sure
    sure = S.kurulum_saat
    uc_deg = 0
    onceki_tip = None

    for row in layers:
        k         = float(row.get("bitis", 0)) - float(row.get("baslangic", 0))
        koh_row   = row.get("kohezyon", "")
        hesap_tip = zemin_hesap_tipi(row.get("zem_tipi", ""), koh_row)
        sure += k / rop_hesapla(row.get("zem_tipi", ""), float(row.get("ucs") or 0), cap_mm, koh_row)
        kaya_tipleri = ("Kumtaşı", "Kireçtaşı", "Sert Kaya", "Ayrışmış Kaya")
        # Only count tool change on soil→rock transition, not rock-start or rock→rock
        if hesap_tip in kaya_tipleri \
                and onceki_tip is not None and onceki_tip not in kaya_tipleri:
            uc_deg += 1
        onceki_tip = hesap_tip

    sure += uc_deg * S.alet_degisim_saat
    sure += casing_m * S.casing_saat_m
    # Cage and concrete are post-rig parallel operations — excluded from rig cycle time

    ek_sure = (S.derinlik_ek[30] if kazik_boyu >= 30
               else S.derinlik_ek[20] if kazik_boyu >= 20
               else S.derinlik_ek[0])
    sure += ek_sure
    return round(sure * 10) / 10


# ─── Fuel Estimate ────────────────────────────────────────────────────────────

def mazot_tahmini(tork: float, kazik_boyu: float) -> dict:
    """Fuel consumption estimate. Class C."""
    if tork < 100:
        m_basi = 8.0 + tork * 0.040
    elif tork < 200:
        m_basi = 12.0 + (tork - 100) * 0.080
    else:
        m_basi = 20.0 + (tork - 200) * 0.075
    m_basi = round(m_basi * 10) / 10
    return {"m_basi": m_basi, "toplam": round(m_basi * kazik_boyu * 10) / 10}


# ─── Machine Suitability ──────────────────────────────────────────────────────

def makine_uygunluk(makine: dict, tork: float, kazik_boyu: float,
                    kazik_capi: float, casing_gerekli: bool,
                    is_tipi: str = "Fore Kazık") -> dict:
    """
    Equipment suitability: method + geometry + torque + casing checks.
    Source: FHWA GEC 10 §7, EN 1536, OEM technical specifications
    """
    M = KATSAYILAR.makine
    red = []
    uyarilar = []

    # 1. Method compatibility
    desteklenenler = M.method_uyumluluk.get(is_tipi, [is_tipi])
    if makine.get("tip") not in desteklenenler:
        return {
            "karar": "Uygun Değil",
            "gerekce": f"Method uyumsuz: proje '{is_tipi}' — makine '{makine.get('tip')}'",
            "red_sebepler": [f"Method uyumsuzluğu: {makine.get('tip')} ≠ {is_tipi}"],
            "uyarilar": [],
        }

    if (makine.get("max_derinlik") or 0) < kazik_boyu:
        red.append(f"Derinlik yetersiz: {makine.get('max_derinlik')} m < {kazik_boyu} m")
    if (makine.get("max_cap") or 0) < kazik_capi:
        red.append(f"Çap yetersiz: {makine.get('max_cap')} mm < {kazik_capi} mm")

    tork_oran = (makine.get("tork") or 0) / tork if tork > 0 else 999
    if tork_oran < M.tork_min_oran:
        red.append(
            f"Tork yetersiz: {makine.get('tork')} kNm < "
            f"minimum {round(tork * M.tork_min_oran)} kNm"
        )

    if red:
        return {"karar": "Uygun Değil", "gerekce": red[0], "red_sebepler": red, "uyarilar": []}

    if casing_gerekli and makine.get("casing") == "Hayır":
        return {
            "karar": "Şartlı Uygun",
            "gerekce": "Casing kapasitesi yok; yardımcı ekipman ile değerlendirilebilir",
            "red_sebepler": [],
            "uyarilar": ["Casing gerekli ancak makine casing donanımına sahip değil"],
        }

    if tork_oran < M.tork_uygun_oran:
        return {
            "karar": "Şartlı Uygun",
            "gerekce": f"Tork nominalin %{round(tork_oran * 100)}'i — sınır koşullarda çalışma",
            "red_sebepler": [],
            "uyarilar": [f"Tork sınırda: %{round(tork_oran * 100)} kapasite"],
        }

    if casing_gerekli and makine.get("casing") == "Şartlı":
        uyarilar.append("Casing kapasitesi şartlı — konfigürasyonu doğrulayın")

    return {
        "karar": "Uygun",
        "gerekce": (
            f"Tüm kriterler karşılandı. "
            f"Tork marjı +%{round((tork_oran - 1) * 100)}. "
            f"Derinlik: {makine.get('max_derinlik')} m. Çap: {makine.get('max_cap')} mm"
        ),
        "red_sebepler": [],
        "uyarilar": uyarilar,
    }


# ─── Full Analysis ────────────────────────────────────────────────────────────

def tam_analiz(proje: dict, layers: list) -> dict:
    """
    Convenience function: runs all calculations for a project+layers combo.
    Returns structured analysis dict suitable for report generation.
    """
    cap_mm = float(proje.get("kazik_capi", 800))
    kazik_boyu = float(proje.get("kazik_boyu", 18))
    yas = float(proje.get("yeralti_suyu", 0))
    is_tipi = proje.get("is_tipi", "Fore Kazık")

    tork_aralik = gerekli_tork_aralik(layers, cap_mm, is_tipi)
    tork = tork_aralik["nominal"]
    casing_result = casing_durum(layers, yas)
    casing_m = casing_metre(layers, yas)
    sure = kazik_suresi(layers, cap_mm, kazik_boyu, casing_m)
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

    return {
        "tork_nominal": tork,
        "tork_min": tork_aralik["min"],
        "tork_max": tork_aralik["max"],
        "tork_guven": tork_aralik["guven"],
        "tork_aciklama": tork_aralik["aciklama"],
        "tork_uyarilar": tork_aralik["uyarilar"],
        "casing_durum": casing_result["durum"],
        "casing_gerekce": casing_result["gerekce"],
        "casing_zorunlu": casing_result["zorunlu"],
        "casing_m": casing_m,
        "sure": sure,
        "m_basi": mazot["m_basi"],
        "toplam_mazot": mazot["toplam"],
        "toplam_gun": gun,
        "stabilite_skor": stabilite_skor,
    }
