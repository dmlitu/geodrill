"""
GeoDrill Geotechnical Coefficient Registry
==========================================
All engineering constants are centralised here with source notes.
To calibrate the model, update this file. Do not scatter magic numbers.

SOURCE HIERARCHY:
  1. EN 1536:2010 / TS EN 1536 — bored pile execution
  2. FHWA GEC 10 (2010) — drilled shafts / bored pile construction
  3. FHWA GEC 5 — soil parameter development and correlations
  4. OEM manufacturer data — machine capability limits
  5. Conservative engineering judgment (documented below)

CONFIDENCE CLASSES:
  A — Measured / direct project data (lab, in-situ)
  B — Correlated from recognised in-situ tests (SPT, UCS)
  C — Qualitative log / inferred only
"""

from dataclasses import dataclass, field
from typing import Dict


@dataclass(frozen=True)
class TorkCoefficients:
    # Cohesive SPT→su correlation factor (kPa per blow)
    # Source: FHWA GEC 5 Table 3-1 / Terzaghi & Peck (1967). Class B.
    # Conservative k_su = 4 used (literature range 4–6).
    kohezyon_spt: float = 4.0
    kohezyon_su_min: float = 20.0  # kPa floor

    # Cohesionless SPT→mobilised friction proxy (kPa per blow). Class C.
    kohezyon_siz_spt: float = 2.0
    kohezyon_siz_tau_min: float = 15.0  # kPa

    # Rock face shear: tau ≈ UCS/35 for rotary face-cutting model
    # Source: FHWA GEC 10 §7.4 rock-socket interface shear. Class B.
    # Note: τ=UCS/10 over-predicts torque when applied to full face area πd³/8.
    # UCS/35 calibrates to field torque records for Kelly boring in weak–medium rock.
    kaya_ucs_tau_boleni: float = 35.0  # tau [kPa] = UCS [MPa] × 1000 / 35

    # RQD variability factors (lower RQD → higher uncertainty → conservative upward margin)
    # Source: FHWA GEC 10 §7.4 rock quality + conservative judgment
    rqd_faktor: Dict[int, float] = field(default_factory=lambda: {
        75: 1.00, 50: 1.10, 25: 1.20, 0: 1.35
    })

    # Application factor (tool geometry, efficiency, non-homogeneity)
    # Calibrated against OEM reference curves for Kelly rotary boring.
    uygulama_faktoru: float = 1.25

    # Output uncertainty band around nominal
    alt_bant: float = 0.80   # lower limit = nominal × 0.80
    ust_bant: float = 1.30   # upper limit = nominal × 1.30


@dataclass(frozen=True)
class RopCoefficients:
    # Base ROP by soil type (m/hr) at Ø800 mm reference diameter. Class C.
    # Source: FHWA GEC 10 §7 + generalised industry data
    baz: Dict[str, float] = field(default_factory=lambda: {
        "Dolgu": 8.0, "Kil": 6.0, "Silt": 6.5,
        "Kum": 5.0, "Çakıl": 3.5, "Ayrışmış Kaya": 2.0,
        "Kumtaşı": 1.2, "Kireçtaşı": 0.9, "Sert Kaya": 0.5,
    })
    varsayilan: float = 3.0
    ucs_azaltma_katsayi: float = 0.75   # at UCS=100 MPa → factor 0.25
    ucs_azaltma_min: float = 0.25
    referans_cap_m: float = 0.80
    cap_azaltma_katsayi: float = 0.50
    cap_azaltma_min: float = 0.45
    min_rop: float = 0.25               # absolute floor (hard rock), m/hr


@dataclass(frozen=True)
class SureCoefficients:
    kurulum_saat: float = 0.50          # rig positioning + setup (Zayed & Halpin 2005 §4)
    alet_degisim_saat: float = 0.60     # bit/tool change at rock transition
    casing_saat_m: float = 0.10         # casing installation, hrs/m
    kafes_sure_saat: float = 0.40       # reinforcement cage lowering (Zayed & Halpin 2005 §4)
    # Concrete: tremie pour rate 20 m³/hr (Zayed & Halpin 2005 §4.3)
    beton_katsayi: float = 1 / 20       # hrs/m³ = 0.05 → 20 m³/hr pour rate
    # Depth surcharges (extra Kelly extensions, concrete delivery logistics)
    derinlik_ek: Dict[int, float] = field(default_factory=lambda: {
        30: 0.8, 20: 0.4, 0: 0.0
    })


@dataclass(frozen=True)
class CasingCoefficients:
    # Source: EN 1536:2010 §5 — hole stability and casing design
    kum_cakil_min_kalinlik: float = 0.50   # m — sand/gravel above this → required
    dolgu_sartli_kalinlik: float = 2.00    # m — thick fill → conditional
    cok_gevsek_spt: int = 10              # SPT N < 10 cohesionless → required
    yuksek_risk_oran: float = 1.00        # 100% of high-risk layer
    orta_risk_oran: float = 0.50          # 50% of medium-risk layer


@dataclass(frozen=True)
class StabiliteCoefficients:
    puan: Dict[str, int] = field(default_factory=lambda: {
        "Yüksek": 70, "Orta": 40, "Düşük": 15
    })
    yuksek_esigi: int = 50
    orta_esigi: int = 30
    cok_gevsek_spt: int = 10
    orta_spt: int = 30


@dataclass(frozen=True)
class MakineCoefficients:
    tork_min_oran: float = 0.80    # < 80% of required → UYGUN DEĞİL
    tork_uygun_oran: float = 1.00  # 80–100% → ŞARTLI; ≥ 100% → UYGUN
    # Method compatibility map
    # Source: EN 1536 drilling method classification + OEM specs
    method_uyumluluk: Dict[str, list] = field(default_factory=lambda: {
        "Fore Kazık": ["Fore Kazık"],
        "CFA Kazık":  ["Fore Kazık", "CFA Kazık"],
        "Ankraj":     ["Ankraj"],
        "Mini Kazık": ["Ankraj", "Mini Kazık"],
    })


@dataclass(frozen=True)
class GeotechCoefficients:
    tork: TorkCoefficients = field(default_factory=TorkCoefficients)
    rop: RopCoefficients = field(default_factory=RopCoefficients)
    sure: SureCoefficients = field(default_factory=SureCoefficients)
    casing: CasingCoefficients = field(default_factory=CasingCoefficients)
    stabilite: StabiliteCoefficients = field(default_factory=StabiliteCoefficients)
    makine: MakineCoefficients = field(default_factory=MakineCoefficients)


# Singleton — import this everywhere
KATSAYILAR = GeotechCoefficients()
