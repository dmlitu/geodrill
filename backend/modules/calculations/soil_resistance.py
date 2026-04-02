"""
GeoDrill Soil Resistance Index Module
======================================
Computes the effective shear resistance (tau_eff) for each soil layer using
the priority-based resistance pathway system.

RESISTANCE PATHWAY PRIORITY (high → low data quality):
  1. Rock layers         : tau = UCS_eff × 1000 / 35 (FHWA GEC 10 §7.4)
  2. Cohesive + Su meas. : tau = max(su, 20) kPa          [Class A]
  3. Cohesive + CPT qc   : tau = max(qc_MPa × 1000 / Nkt, 20) kPa  [Class B]
  4. Cohesive + SPT N60  : tau = max(N60 × 4, 20) kPa    [Class B]
  5. Granular + CPT qc   : tau = max(qc_MPa × 100, 15) kPa [Class B]
  6. Granular + SPT N60  : tau = max(N60 × 2, 15) kPa    [Class C]

Source references:
  - FHWA GEC 10 (2010) — Drilled Shafts: Construction Procedures and Design Methods
  - FHWA GEC 5 (2002)  — Soil Parameter Development and Correlations
  - EN 1536:2010 / TS EN 1536 — Bored pile execution
  - Robertson & Campanella (1983) — CPT Nkt bearing factor
"""

from typing import Dict, Optional
from configs.geotech_coefficients import KATSAYILAR


# ─── Soil Classification Helpers ─────────────────────────────────────────────

_KAYA_TIPLERI = frozenset({"Ayrışmış Kaya", "Kumtaşı", "Kireçtaşı", "Sert Kaya"})
_KOHEZYONLU_TIPLERI = frozenset({"Kil", "Silt"})
_GRANÜLER_TIPLERI = frozenset({"Kum", "Çakıl", "Dolgu"})


def zemin_sinifi_detay(zem_tipi: str, kohezyon: str) -> str:
    """
    Returns the detailed soil class string for resistance pathway selection.

    Parameters
    ----------
    zem_tipi : str
        Soil type as stored in the database (one of the 9 standard types or
        free-text geological description). If free-text, classification is
        based on kohezyon field.
    kohezyon : str
        Cohesion class: "Kohezyonlu", "Kohezyonsuz", "Kaya", or empty.

    Returns
    -------
    str
        One of: "kohezyonlu" | "granüler" | "kaya" | "belirsiz"

    Engineering basis:
        Classification drives which resistance formula is applied.
        "kaya" always uses UCS-based formula regardless of SPT/CPT.
        Source: EN 1536:2010 §4 soil classification for pile design.
    """
    if not zem_tipi:
        # Fall back to kohezyon field
        if kohezyon == "Kohezyonlu":
            return "kohezyonlu"
        if kohezyon == "Kohezyonsuz":
            return "granüler"
        if kohezyon == "Kaya":
            return "kaya"
        return "belirsiz"

    tip = zem_tipi.strip()
    if tip in _KAYA_TIPLERI:
        return "kaya"
    if tip in _KOHEZYONLU_TIPLERI:
        return "kohezyonlu"
    if tip in _GRANÜLER_TIPLERI:
        return "granüler"

    # Free-text: use kohezyon field as discriminator
    if kohezyon == "Kaya":
        return "kaya"
    if kohezyon == "Kohezyonlu":
        return "kohezyonlu"
    if kohezyon == "Kohezyonsuz":
        return "granüler"
    return "belirsiz"


def yontem_katsayisi(is_tipi: str) -> float:
    """
    Returns the method multiplier (K_method) for the given pile/anchor type.

    Parameters
    ----------
    is_tipi : str
        Project work type, e.g. "Fore Kazık", "CFA Kazık", "Yerinden Etme",
        "Ankraj", "Mini Kazık".

    Returns
    -------
    float
        K_method multiplier from KATSAYILAR.yontem.carpan.
        Defaults to 1.00 (Fore Kazık reference) if not found.

    Engineering basis:
        Different drilling methods generate different torque demands on the
        drive system due to tool geometry, soil arching and displacement effects.
        Source: FHWA GEC 8; EN 1536; OEM specifications.
    """
    return KATSAYILAR.yontem.carpan.get(is_tipi, 1.00)


def zemin_suyu_katsayisi(sinif: str, baslangic: float, yas: float) -> float:
    """
    Returns the groundwater correction factor (K_gw) for a soil layer.

    Parameters
    ----------
    sinif : str
        Soil class: "kohezyonlu" | "granüler" | "kaya" | "belirsiz".
    baslangic : float
        Layer start depth (m).
    yas : float
        Groundwater table depth (m). Pass 0 to disable GWT effects.

    Returns
    -------
    float
        K_gw multiplier: >1 means GWT increases torque demand.
        1.00 when layer is above GWT, or when yas <= 0 (no GWT data).

    Engineering basis:
        Below GWT, cohesionless soils tend to flow into the bore opening,
        increasing rotary resistance. Cohesive soils show minor disturbance
        effects. Rock is GWT-independent for face cutting torque.
        Source: EN 1536:2010 §5; conservative engineering judgment.
    """
    GW = KATSAYILAR.zemin_suyu

    # No GWT data or layer is above GWT → no correction
    if yas <= 0 or baslangic < yas:
        return 1.00

    # Layer starts at or below GWT
    if sinif == "kaya":
        return GW.tork_kaya
    if sinif == "kohezyonlu":
        return GW.tork_kohezyonlu
    if sinif == "granüler":
        return GW.tork_kohezyon_siz
    # belirsiz: use the more conservative granular factor
    return GW.tork_kohezyon_siz


def derinlik_katsayisi(bitis: float) -> float:
    """
    Returns the depth factor (K_depth) based on pile bottom depth.

    Parameters
    ----------
    bitis : float
        Layer bottom depth (m) — typically the pile tip depth for the deepest layer.

    Returns
    -------
    float
        K_depth from KATSAYILAR.derinlik.derinlik_esikler.
        Larger depth → higher K_depth → more conservative torque estimate.

    Engineering basis:
        Greater drilling depths increase effective stress on the drill string,
        rod weight contribution, and frictional side resistance.
        Source: FHWA GEC 10 §6; EN 1536 commentary; OEM data.
    """
    thresholds = KATSAYILAR.derinlik.derinlik_esikler
    # Iterate from highest threshold downward
    for esik in sorted(thresholds.keys(), reverse=True):
        if bitis >= esik:
            return thresholds[esik]
    return 1.00


# ─── Resistance Index ─────────────────────────────────────────────────────────

def direnc_indeksi(row: dict) -> dict:
    """
    Compute effective shear resistance index (tau_eff) for a single soil layer.

    Applies the priority-based resistance pathway:
      1. Rock → UCS-based (FHWA GEC 10 §7.4)
      2. Cohesive + Su measured → direct su value (Class A)
      3. Cohesive + CPT qc → CPT Nkt formula (Class B)
      4. Cohesive + SPT → N60 × 4 kPa (Class B)
      5. Granular + CPT qc → qc × 100 kPa (Class B)
      6. Granular + SPT → N60 × 2 kPa (Class C)

    Parameters
    ----------
    row : dict
        Layer dictionary with keys:
          zem_tipi    (str)   — soil type label
          kohezyon    (str)   — cohesion class
          spt         (int/float) — SPT N60 blow count (0 if not measured)
          ucs         (float) — unconfined compressive strength (MPa), 0 if absent
          rqd         (float) — Rock Quality Designation (%), 0 if absent
          cpt_qc      (float) — CPT cone resistance (MPa), 0 if absent [optional]
          su          (float) — undrained shear strength (kPa), 0 if absent [optional]
          baslangic   (float) — layer start depth (m)
          bitis       (float) — layer end depth (m)

    Returns
    -------
    dict
        {
          tau_kPa   : float  — effective shear resistance in kPa
          source    : str    — pathway used ("ucs", "su", "cpt_kohezif",
                               "spt_kohezif", "cpt_granüler", "spt_granüler",
                               "ucs_varsayilan", "belirsiz")
          confidence: str    — "A" (direct), "B" (correlated), "C" (inferred)
          raw_value : float  — input value used (UCS, su, qc, or N60)
          raw_unit  : str    — unit of raw_value ("MPa", "kPa", "MPa", "blows")
          notes     : list   — engineering notes for the calculation trace
        }

    Engineering basis:
        Priority mirrors the data quality hierarchy in FHWA GEC 10 §3 and
        EN 1997-1 §2.4 (ground investigation adequacy).
        Direct measurements (su, UCS measured) yield Class A confidence.
        CPT/SPT correlations yield Class B.
        Inferred/qualitative-only yields Class C.
    """
    K = KATSAYILAR.tork
    notes = []

    zem_tipi = row.get("zem_tipi", "") or ""
    kohezyon = row.get("kohezyon", "") or ""
    spt = float(row.get("spt") or 0)
    ucs = float(row.get("ucs") or 0)
    rqd = float(row.get("rqd") or 0)
    cpt_qc = float(row.get("cpt_qc") or 0)
    su = float(row.get("su") or 0)
    baslangic = float(row.get("baslangic") or 0)
    bitis = float(row.get("bitis") or 0)

    sinif = zemin_sinifi_detay(zem_tipi, kohezyon)

    # ── Pathway 1: Rock (UCS-based) ──────────────────────────────────────────
    if sinif == "kaya":
        kaya_tipleri = list(K.kaya_ucs_varsayilan.keys())
        # Find which standard rock type applies for default UCS lookup
        from modules.calculations.engine import zemin_hesap_tipi
        hesap_tip = zemin_hesap_tipi(zem_tipi, kohezyon) or zem_tipi

        if ucs > 0:
            ucs_eff = ucs
            confidence = "B"   # UCS measured but correlation to shear is B
            raw_value = ucs
            raw_unit = "MPa"
            notes.append(
                f"Ölçülmüş UCS={ucs} MPa → τ={ucs*1000/K.kaya_ucs_tau_boleni:.1f} kPa "
                f"(UCS×1000/{K.kaya_ucs_tau_boleni}, FHWA GEC 10 §7.4, Sınıf B)"
            )
            source = "ucs"
        else:
            ucs_eff = K.kaya_ucs_varsayilan.get(hesap_tip, 10.0)
            confidence = "C"   # default UCS — lowest confidence
            raw_value = ucs_eff
            raw_unit = "MPa"
            notes.append(
                f"UCS ölçümü yok; {hesap_tip} için varsayılan UCS={ucs_eff} MPa "
                f"(FHWA GEC 10 Tablo 7.1, Sınıf C)"
            )
            source = "ucs_varsayilan"

        tau_kPa = (ucs_eff * 1000.0) / K.kaya_ucs_tau_boleni

        # RQD uncertainty note
        if rqd > 0:
            notes.append(f"RQD={rqd}% — belirsizlik faktörü kayıt değerlendirmesine dahil edildi")

        return {
            "tau_kPa":    round(tau_kPa, 2),
            "source":     source,
            "confidence": confidence,
            "raw_value":  raw_value,
            "raw_unit":   raw_unit,
            "notes":      notes,
        }

    # ── Pathway 2: Cohesive + Su measured ────────────────────────────────────
    if sinif == "kohezyonlu" and su > 0:
        tau_kPa = max(su, K.cpt_su_min)
        notes.append(
            f"Ölçülmüş su={su} kPa kullanıldı (zemin: {zem_tipi}). "
            f"τ = max(su, {K.cpt_su_min}) = {tau_kPa:.1f} kPa. Sınıf A."
        )
        return {
            "tau_kPa":    round(tau_kPa, 2),
            "source":     "su",
            "confidence": "A",
            "raw_value":  su,
            "raw_unit":   "kPa",
            "notes":      notes,
        }

    # ── Pathway 3: Cohesive + CPT qc ─────────────────────────────────────────
    if sinif == "kohezyonlu" and cpt_qc > 0:
        tau_kPa = max(cpt_qc * 1000.0 / K.cpt_nkt, K.cpt_su_min)
        notes.append(
            f"CPT qc={cpt_qc} MPa → su≈{cpt_qc*1000/K.cpt_nkt:.1f} kPa "
            f"(qc×1000/Nkt={K.cpt_nkt}, Robertson & Campanella 1983). "
            f"τ = max(su, {K.cpt_su_min}) = {tau_kPa:.1f} kPa. Sınıf B."
        )
        return {
            "tau_kPa":    round(tau_kPa, 2),
            "source":     "cpt_kohezif",
            "confidence": "B",
            "raw_value":  cpt_qc,
            "raw_unit":   "MPa",
            "notes":      notes,
        }

    # ── Pathway 4: Cohesive + SPT ─────────────────────────────────────────────
    if sinif == "kohezyonlu" and spt > 0:
        tau_kPa = max(spt * K.kohezyon_spt, K.kohezyon_su_min)
        notes.append(
            f"SPT N60={spt} → su≈{spt * K.kohezyon_spt:.1f} kPa "
            f"(N×{K.kohezyon_spt}, FHWA GEC 5 Tablo 3-1). "
            f"τ = max(su, {K.kohezyon_su_min}) = {tau_kPa:.1f} kPa. Sınıf B."
        )
        return {
            "tau_kPa":    round(tau_kPa, 2),
            "source":     "spt_kohezif",
            "confidence": "B",
            "raw_value":  spt,
            "raw_unit":   "blows",
            "notes":      notes,
        }

    # ── Pathway 5: Granular + CPT qc ─────────────────────────────────────────
    if sinif == "granüler" and cpt_qc > 0:
        tau_kPa = max(cpt_qc * K.cpt_kqc_kohezyon_siz, K.kohezyon_siz_tau_min)
        notes.append(
            f"CPT qc={cpt_qc} MPa → τ≈{cpt_qc * K.cpt_kqc_kohezyon_siz:.1f} kPa "
            f"(qc×{K.cpt_kqc_kohezyon_siz}, FHWA GEC 5 CPT korelasyonu). "
            f"τ = max(τ, {K.kohezyon_siz_tau_min}) = {tau_kPa:.1f} kPa. Sınıf B."
        )
        return {
            "tau_kPa":    round(tau_kPa, 2),
            "source":     "cpt_granüler",
            "confidence": "B",
            "raw_value":  cpt_qc,
            "raw_unit":   "MPa",
            "notes":      notes,
        }

    # ── Pathway 6: Granular + SPT ─────────────────────────────────────────────
    if sinif == "granüler" and spt > 0:
        tau_kPa = max(spt * K.kohezyon_siz_spt, K.kohezyon_siz_tau_min)
        notes.append(
            f"SPT N60={spt} → τ≈{spt * K.kohezyon_siz_spt:.1f} kPa "
            f"(N×{K.kohezyon_siz_spt}, granüler proxy, Sınıf C). "
            f"τ = max(τ, {K.kohezyon_siz_tau_min}) = {tau_kPa:.1f} kPa. Sınıf C."
        )
        return {
            "tau_kPa":    round(tau_kPa, 2),
            "source":     "spt_granüler",
            "confidence": "C",
            "raw_value":  spt,
            "raw_unit":   "blows",
            "notes":      notes,
        }

    # ── Fallback: no measurable data ─────────────────────────────────────────
    # Use minimum floor based on best-guess soil class
    if sinif == "kohezyonlu":
        tau_kPa = K.kohezyon_su_min
        notes.append(
            f"Ölçüm yok; kohezif zemin tabanı τ={K.kohezyon_su_min} kPa kullanıldı. "
            f"Sınıf C — veri eksik."
        )
    elif sinif == "granüler":
        tau_kPa = K.kohezyon_siz_tau_min
        notes.append(
            f"Ölçüm yok; granüler zemin tabanı τ={K.kohezyon_siz_tau_min} kPa kullanıldı. "
            f"Sınıf C — veri eksik."
        )
    else:
        tau_kPa = K.kohezyon_siz_tau_min
        notes.append(
            f"Zemin sınıfı belirsiz ve ölçüm yok; τ={K.kohezyon_siz_tau_min} kPa kullanıldı. "
            f"Sınıf C — veri yetersiz."
        )

    return {
        "tau_kPa":    round(tau_kPa, 2),
        "source":     "belirsiz",
        "confidence": "C",
        "raw_value":  0.0,
        "raw_unit":   "—",
        "notes":      notes,
    }
