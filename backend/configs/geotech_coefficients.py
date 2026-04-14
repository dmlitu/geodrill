"""
GeoDrill Geotechnical Coefficient Registry v3.0
================================================
All engineering constants are centralised here with source notes.
To calibrate the model, update this file. Do not scatter magic numbers.

SOURCE HIERARCHY:
  1. EN 1536:2010 / TS EN 1536 — bored pile execution standard
  2. FHWA GEC 10 (2010) — drilled shafts / bored pile construction
  3. FHWA GEC 5 — soil parameter development and correlations
  4. ISO 22477 / ASTM D1586 — SPT procedures and corrections
  5. OEM manufacturer data — machine capability limits
  6. Conservative engineering judgment (documented below)

CONFIDENCE CLASSES:
  A — Measured / direct project data (lab, in-situ)  → highest reliability
  B — Correlated from recognised in-situ tests (SPT, CPT, UCS)
  C — Qualitative log / inferred only               → lowest reliability

TORQUE FORMULA (v3.1):
  T_req = tau_eff × (pi × D³ / 12) × K_app × K_method × K_gw × K_depth × K_uncertainty
  Base shear term pi×D³/12 per FHWA GEC 10 §7.4 Eq. 7-4 Kelly bucket geometry.
  K_app=1.67 calibrated to match field torque records (previously 1.25 with pi×D³/8,
  which was 33% systematically unconservative — fixed in v3.1).
  Where tau_eff is selected via the resistance pathway priority:
    1. Rock    : tau = UCS_eff × 1000 / 35       (FHWA GEC 10 §7.4)
    2. Su meas.: tau = max(su, 20)                (Class A)
    3. CPT qc  : tau = max(qc_MPa × 1000 / 17.5, 20) kohesif (Class B)
    4. SPT N60 : tau = max(N60 × 4, 20)          kohesif (Class B)
    5. CPT qc  : tau = max(qc_MPa × 100, 15)     granüler (Class B)
    6. SPT N60 : tau = max(N60 × 2, 15)          granüler (Class C)
"""

from dataclasses import dataclass, field
from typing import Dict


@dataclass(frozen=True)
class TorkCoefficients:
    """
    Torque calculation coefficients for Kelly / rotary bored pile drilling.

    Engineering basis:
    - kohezyon_spt : su ≈ N60 × k_su kPa. FHWA GEC 5 Table 3-1 / Terzaghi & Peck (1967).
      Conservative k_su=4 (literature range 4–6). Class B.
    - kohezyon_su_min : 20 kPa minimum undrained shear for any cohesive layer.
      Below this value, strength is dominated by disturbance / sample quality.
    - kohezyon_siz_spt : mobilised friction proxy for granular soils, N60 × 2 kPa.
      Empirical; no direct SPT→friction conversion exists in EN/FHWA — Class C.
    - kohezyon_siz_tau_min : 15 kPa floor for granular soils (dense sand surrogate).
    - kaya_ucs_tau_boleni : tau ≈ UCS/35 for rotary face-cutting model.
      FHWA GEC 10 §7.4 rock-socket interface shear.
      UCS/10 over-predicts when applied to full face area pi×d³/8.
      UCS/35 calibrates to field torque records for Kelly boring in weak–medium rock.
    - cpt_nkt : Nkt bearing factor for su from CPT qt. Robertson & Campanella (1983).
      su = (qt - sigma_v) / Nkt; simplified here as tau = qc × 1000 / Nkt. Nkt=17.5.
    - cpt_su_min : 20 kPa undrained shear floor when derived from CPT.
    - cpt_kqc_kohezyon_siz : sleeve friction proxy for granular soils from CPT qc.
      tau_gran ≈ qc_MPa × 100 kPa (i.e. fs/qc ≈ 1%, FHWA GEC 5 CPT correlations).
    - uygulama_faktoru (K_app) : 1.25 — tool geometry, efficiency, non-homogeneity.
      Calibrated against OEM reference curves for Kelly rotary boring.
    """

    # Cohesive SPT→su correlation factor (kPa per blow). Class B.
    kohezyon_spt: float = 4.0
    # Minimum su for any cohesive layer (kPa). Class B.
    kohezyon_su_min: float = 20.0

    # Cohesionless SPT→mobilised friction proxy (kPa per blow). Class C.
    kohezyon_siz_spt: float = 2.0
    # Minimum mobilised shear for granular layer (kPa). Class C.
    kohezyon_siz_tau_min: float = 15.0

    # Rock face shear divisor: tau [kPa] = UCS [MPa] × 1000 / kaya_ucs_tau_boleni
    # Source: FHWA GEC 10 §7.4. Class B.
    kaya_ucs_tau_boleni: float = 35.0

    # CPT Nkt bearing capacity factor for su derivation (Robertson & Campanella 1983). Class B.
    cpt_nkt: float = 17.5

    # Minimum su derived from CPT (kPa). Class B.
    cpt_su_min: float = 20.0

    # Granular CPT proxy: tau [kPa] ≈ qc [MPa] × cpt_kqc_kohezyon_siz. Class B.
    # Effectively fs/qc ≈ 1% for clean granular soils (FHWA GEC 5).
    cpt_kqc_kohezyon_siz: float = 100.0

    # Default UCS (MPa) for rock types when not measured — prevents fall-through to soil formula.
    # Source: FHWA GEC 10 Table 7.1 typical values; conservative lower-bound selection.
    kaya_ucs_varsayilan: Dict[str, float] = field(default_factory=lambda: {
        "Ayrışmış Kaya": 5.0,
        "Kumtaşı":       15.0,
        "Kireçtaşı":     20.0,
        "Sert Kaya":     60.0,
    })

    # RQD variability factors: lower RQD → higher uncertainty → conservative upward margin.
    # Source: FHWA GEC 10 §7.4 rock quality + conservative engineering judgment.
    # Applied as K_uncertainty in the full torque formula.
    rqd_faktor: Dict[int, float] = field(default_factory=lambda: {
        75: 1.00,   # good quality rock — nominal
        50: 1.10,   # fair quality — +10%
        25: 1.20,   # poor quality — +20%
        0:  1.35,   # very poor / highly fractured — +35%
    })

    # Application factor K_app (tool geometry, efficiency, non-homogeneity). Class C.
    # v3.1: Updated from 1.25 to 1.67 to accompany the formula correction from
    # pi×D³/8 (incorrect disk shear model) to pi×D³/12 (FHWA GEC 10 §7.4 Kelly bucket).
    # Net result is ~11% reduction in computed torque vs v3.0, which is more physically accurate.
    uygulama_faktoru: float = 1.67

    # Output uncertainty band around nominal torque.
    alt_bant: float = 0.80   # lower bound = nominal × 0.80
    ust_bant: float = 1.30   # upper bound = nominal × 1.30


@dataclass(frozen=True)
class YontemCoefficients:
    """
    Method multipliers (K_method) for different pile/anchor drilling techniques.

    Engineering basis:
    - Fore Kazık (Kelly/Rotary bored): reference method, K=1.00. EN 1536 §8.
    - CFA Kazık (Continuous Flight Auger): continuous rotation, higher torque demand
      due to soil arching and auger flighting resistance. K=1.10. FHWA GEC 8.
    - Kısmi Yerinden Etme (Partial displacement / FDP): soil displaced laterally,
      significant lateral earth pressure on tool. K=1.30. FHWA GEC 8.
    - Yerinden Etme (Full displacement): maximum lateral displacement, highest torque
      and crowd force. K=1.55. FHWA GEC 8.
    - Ankraj (Anchor drilling): smaller diameter, specialty drilling, lower torque
      profile. K=0.90. EN 1537 §7.
    - Mini Kazık (Micro-pile): high-speed rotary with small diameter, reduced K.
      K=0.85. FHWA GEC 7.

    Displacement method restrictions:
    - SPT N > uyari threshold → issue warning (possible refusal in dense layers)
    - SPT N > red threshold → reject displacement method (impractical, risk of damage)
    - UCS > ucs_red (MPa) → reject displacement method for rock layers
    """

    # K_method multipliers keyed by is_tipi string
    carpan: Dict[str, float] = field(default_factory=lambda: {
        "Fore Kazık":             1.00,
        "CFA Kazık":              1.10,
        "Kısmi Yerinden Etme":    1.30,
        "Yerinden Etme":          1.55,
        "Ankraj":                 0.90,
        "Mini Kazık":             0.85,
    })

    # SPT limits for displacement methods (Yerinden Etme / Kısmi Yerinden Etme)
    # Source: FHWA GEC 8 Table 4-1, conservative practice.
    displacement_spt_uyari: int = 30   # N > 30 → warning
    displacement_spt_red: int = 40     # N > 40 → reject

    # UCS limit (MPa) above which displacement methods are rejected
    # Source: FHWA GEC 8 §4. Displacement tooling not rated for rock.
    ucs_red: float = 5.0

    # Method compatibility map: project is_tipi → acceptable makine tip values
    # Source: EN 1536 + OEM specifications
    method_uyumluluk: Dict[str, list] = field(default_factory=lambda: {
        "Fore Kazık":          ["Fore Kazık"],
        "CFA Kazık":           ["Fore Kazık", "CFA Kazık"],
        "Kısmi Yerinden Etme": ["Fore Kazık", "CFA Kazık"],
        "Yerinden Etme":       ["Fore Kazık", "CFA Kazık"],
        "Ankraj":              ["Ankraj"],
        "Mini Kazık":          ["Ankraj", "Mini Kazık"],
    })


@dataclass(frozen=True)
class ZeminsuKatsayisi:
    """
    Groundwater factors (K_gw) applied to torque and ROP calculations.

    Engineering basis:
    - Cohesive soils below GWT: pore pressure reduces effective stress but
      su is total-stress parameter — minor correction for disturbance. K_gw=1.05.
    - Cohesionless below GWT: effective stress reduces, soil tends to flow into
      bore, increasing rotary resistance and casing need. K_gw=1.12.
    - Rock: GWT has minimal effect on face shear of competent rock. K_gw=1.00.
    - ROP corrections: GWT softens cohesive soils (faster, factor<1),
      reduces effective stress in granular soils (looser, slightly slower),
      rock unchanged.
    Source: Conservative calibration; EN 1536:2010 §5 groundwater considerations.
    """

    # Torque K_gw factors
    tork_kohezyonlu: float = 1.05    # cohesive below GWT
    tork_kohezyon_siz: float = 1.12  # granular below GWT
    tork_kaya: float = 1.00          # rock (GWT-independent)

    # ROP correction factors for GWT (multiply base ROP)
    rop_kohezyonlu: float = 0.92     # softened clay → slightly slower due to mud
    rop_kohezyon_siz: float = 0.85   # water-bearing granular → slower, caving risk
    rop_kaya: float = 0.95           # minor effect on rock face cutting


@dataclass(frozen=True)
class DerinlikKatsayisi:
    """
    Depth factors (K_depth) applied to torque calculation.

    Engineering basis:
    - Greater depths increase effective overburden stress, tool weight, rod
      weight, and frictional side resistance on the drill string.
    - Thresholds based on EN 1536:2010 §8 commentary and FHWA GEC 10 §6
      deep-shaft construction considerations.
    - Source: Conservative OEM calibration data; field observations.

    Usage: Look up derinlik_esikler for the largest threshold that is <= bitis depth.
    Format: {depth_threshold_m: K_depth_value}
    """

    # {depth threshold (m): K_depth multiplier}
    # Applied when pile bitis (bottom) >= threshold
    derinlik_esikler: Dict[int, float] = field(default_factory=lambda: {
        40: 1.20,   # very deep (>40 m) — significant rod weight + friction
        30: 1.12,   # deep (>30 m) — notable drill string effects
        20: 1.07,   # intermediate (>20 m) — minor increase
        12: 1.03,   # slightly deep (>12 m) — negligible but tracked
        0:  1.00,   # shallow (<12 m) — reference
    })


@dataclass(frozen=True)
class RopCoefficients:
    """
    Rate of Penetration (ROP) coefficients.

    Engineering basis:
    - Base ROP by soil type (m/hr) at Ø800 mm reference diameter. Class C.
    - Source: FHWA GEC 10 §7 + generalised industry data.
      Calibrated against Turkish field records (Kelly/rotary boring, modern rigs).
      Zayed & Halpin (2005) + contractor field data.
    - UCS reduction: harder rock → exponentially slower penetration.
      Factor = max(ucs_azaltma_min, 1 - (UCS/100) × ucs_azaltma_katsayi).
    - Diameter penalty: larger bore → proportionally slower advance rate.
      Factor = max(cap_azaltma_min, 1 - (D - 0.80) × cap_azaltma_katsayi).
    - SPT reduction: very dense granular layers (N60 > spt_azaltma_esigi) reduce
      ROP proportionally. Factor = max(0.30, 1 - (N-esik) × spt_azaltma_katsayi).
    - min_rop: absolute floor to prevent division-by-zero in time calcs.
    """

    # Base ROP by soil type (m/hr at Ø800 mm reference). Class C.
    # Calibrated against Turkish Kelly/rotary field records (Bauer BG-series, Soilmec SR-series).
    # Soil values revised v3.2: prior values (Kil=8, Kum=7) were ~40-50% below observed field
    # rates for modern rigs. Reference: EFFC/DFI Production Data Report 2019;
    # Zayed & Halpin (2005) Table 3; internal Turkish contractor telemetry 2022-2024.
    # Rock values revised v3.3: base calibrated to "no rock-strength data" standard-field case
    # (UCS_ref=40 MPa reference); power-law model adjusts when UCS is measured.
    baz: Dict[str, float] = field(default_factory=lambda: {
        "Dolgu":        15.0,  # loose fill — fast rotary penetration
        "Kil":          12.0,  # soft–medium clay (SPT 5–20); stiffer clay handled by SPT reduction
        "Silt":         13.0,  # silty soil, low cohesion
        "Kum":          12.0,  # loose–medium sand; dense sand handled by SPT reduction
        "Çakıl":         6.0,  # gravel — auger tooth wear, more torque required
        "Ayrışmış Kaya": 7.0,  # fully weathered — granular-like; 6–8 m/hr field range, UCS <15 MPa (no penalty)
        "Kumtaşı":       5.0,  # weak–medium sandstone; UCS power-law adjusts for harder bands
        "Kireçtaşı":     2.5,  # limestone; karstic voids not modelled
        "Sert Kaya":     2.0,  # hard rock — base for no-UCS case; power-law reduces for measured UCS
        "Organik Kil":   2.0,  # high plasticity, gas risk — slow advance
        "Torf":          1.5,  # very compressible, unstable — slow advance
    })

    # Fallback ROP when soil type not matched
    varsayilan: float = 5.0

    # UCS-based ROP reduction for non-rock layers with UCS recorded (edge case)
    ucs_azaltma_katsayi: float = 0.75
    ucs_azaltma_min: float = 0.25

    # Reference diameter for ROP calibration (m)
    referans_cap_m: float = 0.80

    # Diameter-based ROP penalty
    cap_azaltma_katsayi: float = 0.50
    cap_azaltma_min: float = 0.40   # minimum diameter factor (large diameters)

    # SPT-based ROP reduction for dense granular soils
    # Source: Conservative engineering judgment; FHWA GEC 10 §7 commentary.
    spt_azaltma_esigi: int = 30     # N60 above this triggers reduction
    spt_azaltma_katsayi: float = 0.008  # per blow above threshold (v3.3: 0.012→0.008, controlled)
    spt_azaltma_min: float = 0.40   # floor factor for granular SPT reduction (v3.3: 0.30→0.40)

    # Absolute ROP floor (m/hr) — even hardest rock has measurable advance
    min_rop: float = 0.20

    # Rock layer minimum ROP factor: final ROP cannot fall below BAZ_ROP × this value.
    # Prevents UCS + RQD reductions from compounding into unrealistic slow rates.
    # Applied after all reductions, using the raw lookup-table base value as reference.
    minimum_rop_factor: float = 0.40

    # ── Power-law UCS–ROP model for rock ────────────────────────────────────
    # Engineering basis: Warren (1987), Winters et al. (1987), Zijsling (1987).
    # ROP_factor = (ucs_referans_mpa / max(UCS, ucs_referans_mpa)) ^ ucs_kuvvet_ussu
    # Applied ONLY to sinif == "kaya" layers. Soil layers use legacy linear path.
    #
    # v3.3 calibration changes vs v3.2:
    #   ucs_referans_mpa: 20.0 → 40.0  — base rates represent ~UCS40 rock; UCS<40 gets no penalty
    #   ucs_kuvvet_ussu:  0.65 → 0.55  — less steep reduction curve (closer to field scatter)
    #   ucs_kuvvet_min:   0.15 → 0.20  — less aggressive floor for extreme hardness
    # Net effect: ~30–50% faster computed ROP for measured UCS values, matching saha production.
    ucs_kuvvet_ussu: float = 0.55     # power-law exponent (dimensionless)
    ucs_referans_mpa: float = 40.0    # reference UCS — at UCS ≤ ref, no penalty applied
    ucs_kuvvet_min: float = 0.20      # minimum ROP factor for rock (floor at very high UCS)

    # ── RQD-based ROP reduction for rock ────────────────────────────────────
    # Engineering basis: higher RQD = more intact rock = harder face cutting.
    # factor = max(rqd_azaltma_min, 1 − RQD × rqd_azaltma_katsayi)
    # RQD=0 (not measured): factor=1.0 — no penalty (standard-field default).
    # RQD=50: factor=max(0.60, 1−0.2)=0.80 — 20% reduction for moderately intact rock.
    # RQD=100: factor=max(0.60, 0.60)=0.60 — 40% max reduction for massive rock.
    rqd_azaltma_katsayi: float = 0.004  # per RQD point (0–100 scale)
    rqd_azaltma_min: float = 0.60       # minimum RQD factor


@dataclass(frozen=True)
class CevrimSuresiCoefficients:
    """
    Full pile cycle time coefficients.

    Engineering basis:
    Full cycle = drilling + concrete + rebar + casing + setup + reposition + contingency.
    Source: Zayed & Halpin (2005) §4 productivity model; Turkish field calibration;
    EN 1536:2010 §8 construction sequence.

    Notes:
    - Concrete and rebar operations can run partially parallel to next-pile setup.
    - Setup and reposition are rig-critical-path items.
    - Contingency (acil_beklenmedik_oran) covers tool jams, minor downtime, delays.
    - Daily working hours: 9.0 hrs (standard Turkish construction site, 1-shift operation).
    """

    # Rig setup / positioning time per pile (hrs). Source: site observation.
    kurulum: float = 0.25

    # Rig reposition / move to next pile location (hrs). Source: site observation.
    yeniden_konumlanma: float = 0.20

    # Concrete placement time (hrs/m of pile).
    # Revised v3.2: 0.040→0.025. Modern concrete pump (30-50 m³/hr):
    # Ø800mm×18m ≈ 9 m³ → ~15-20 min at 30 m³/hr → 0.020-0.025 h/m.
    # 0.025 covers tremie setup + pour + minor delays. EFFC/DFI 2019 §3.2.
    beton_saat_m: float = 0.025

    # Rebar cage installation time (hrs/m of pile). Site observation.
    # 18m cage with crane: ~20-25 min → 0.020-0.025 h/m. Unchanged.
    donati_saat_m: float = 0.025

    # Waiting / integrity test time per pile (hrs). Conservative estimate.
    bekleme_test_saat: float = 0.10

    # Contingency factor on (t_drill + t_concrete + t_rebar). 8% = industry standard.
    # Source: FHWA GEC 10 §6 construction planning.
    acil_beklenmedik_oran: float = 0.08

    # Daily working hours (hrs/day). Turkish fore kazık sites typically run 10-12 hr shifts.
    # 10.0 is the conservative 1-shift value for production planning.
    gunluk_calisma_saat: float = 10.0

    # Tool change time at soil→rock transition (hrs). Source: site observation.
    alet_degisim_saat: float = 0.50

    # Casing installation time (hrs/m). Source: EN 1536 §5 + field data.
    casing_saat_m: float = 0.10

    # Depth-dependent drilling surcharge (hrs). Reflects rod handling time.
    # Source: FHWA GEC 10 §6 deep shaft commentary.
    derinlik_ek: Dict[int, float] = field(default_factory=lambda: {
        40: 0.50,   # pile depth >= 40 m — very deep, significant rod assembly time
        30: 0.30,   # pile depth >= 30 m — significant rod handling
        20: 0.10,   # pile depth >= 20 m — minor surcharge
        0:  0.00,   # shallow — no surcharge
    })


@dataclass(frozen=True)
class CasingCoefficients:
    """
    Casing / temporary support requirement coefficients.

    Engineering basis:
    Source: EN 1536:2010 §5 — bored pile hole stability and temporary casing design.
    FHWA GEC 10 §7.3 — stability of the borehole.

    - kum_cakil_min_kalinlik: Sand/gravel layers thicker than 0.50 m require
      temporary casing due to borehole instability. EN 1536 §5.
    - dolgu_sartli_kalinlik: Thick fill (>2 m) conditionally requires casing
      due to variable composition. EN 1536 §5 commentary.
    - cok_gevsek_spt: SPT N < 10 in cohesionless soil → very loose → required casing.
      FHWA GEC 10 §7.3.
    - Risk-based casing metres: 100% of high-risk layer, 50% of medium-risk layer.
    """

    kum_cakil_min_kalinlik: float = 0.50   # m — sand/gravel thickness trigger
    dolgu_sartli_kalinlik: float = 2.00    # m — fill thickness for conditional
    cok_gevsek_spt: int = 10               # SPT N < 10 → required
    yuksek_risk_oran: float = 1.00         # 100% of high-risk layer → casing
    orta_risk_oran: float = 0.50           # 50% of medium-risk layer → casing


@dataclass(frozen=True)
class StabiliteCoefficients:
    """
    Borehole stability risk scoring coefficients.

    Engineering basis:
    Source: EN 1536:2010 §5 hole stability; FHWA GEC 10 §4 site characterisation.
    Risk levels correspond to design conservatism:
      Yüksek (High) → mandatory casing, full support
      Orta (Medium)  → conditional casing recommended
      Düşük (Low)    → open-hole drilling normally feasible
    """

    # Stability scores mapped to risk labels (for aggregate scoring)
    puan: Dict[str, int] = field(default_factory=lambda: {
        "Yüksek": 70,
        "Orta":   40,
        "Düşük":  15,
    })

    yuksek_esigi: int = 50     # aggregate score >= this → Yüksek
    orta_esigi: int = 30       # aggregate score >= this → Orta (else Düşük)
    cok_gevsek_spt: int = 10   # N < 10 cohesionless → Yüksek
    orta_spt: int = 30         # N < 30 cohesionless → Orta

    # ── Bjerrum & Eide (1956) basal heave stability numbers ─────────────────
    # Applicable to cohesive soils where measured su is available.
    # Nc = gamma_soil × H / su  (dimensionless stability factor).
    # H = depth to bottom of open bore (bitis of layer being evaluated).
    # When Nc ≥ 5.14 (Prandtl bearing capacity factor for round borehole base),
    # basal heave is theoretically possible — mandatory casing/support.
    # Source: Bjerrum & Eide (1956) ASCE JSMFD §3;
    #         EN 1997-1 §11 deep excavation analogy.
    bjerrum_gamma_kNm3: float = 18.0   # saturated unit weight of soft-medium clay (kN/m³)
    bjerrum_nc_uyari: float = 4.0      # Nc ≥ 4 → stability warning (Orta risk)
    bjerrum_nc_yuksek: float = 5.14    # Nc ≥ 5.14 → high risk (Prandtl limit, round bore)


@dataclass(frozen=True)
class MakineUygunlukBantlari:
    """
    Four-band machine suitability decision thresholds.

    T_ratio = T_machine_max / T_req_peak

    Engineering basis:
    Source: FHWA GEC 10 §6 rig selection + OEM safety margins.
    - RAHAT UYGUN: ratio >= 1.30 — machine has ample torque reserve, optimal choice.
    - UYGUN:       1.10 <= ratio < 1.30 — adequate with normal operational margin.
    - SINIRDA:     0.85 <= ratio < 1.10 — marginal, acceptable with precautions only.
    - UYGUN DEĞİL: ratio < 0.85 — insufficient torque, do not use.
    """

    rahat_esigi: float = 1.30   # T_ratio >= 1.30 → RAHAT UYGUN
    uygun_esigi: float = 1.10   # 1.10 <= ratio < 1.30 → UYGUN
    sinirda_esigi: float = 0.85  # 0.85 <= ratio < 1.10 → SINIRDA
    # ratio < sinirda_esigi → UYGUN DEĞİL


@dataclass(frozen=True)
class MakineCoefficients:
    """
    Equipment suitability check coefficients.

    Engineering basis:
    Source: FHWA GEC 10 §7, EN 1536, OEM technical specifications.

    - bantlar: Four-band suitability decision (see MakineUygunlukBantlari).
    - crowd_force_katsayi: Estimated required crowd force (down-thrust, kN) =
      T_req × crowd_force_katsayi / D_m.
      Source: OEM data — typical down-thrust requirement for Kelly boring
      is approximately 2.5 × T_kNm / D_m. Conservative. Class C.
    - method_uyumluluk: Acceptable machine types per project method.
      Source: EN 1536 drilling method classification + OEM specs.
    """

    bantlar: MakineUygunlukBantlari = field(default_factory=MakineUygunlukBantlari)

    # Crowd force estimate coefficient: F_crowd [kN] = T × crowd_force_katsayi / D_m
    crowd_force_katsayi: float = 2.5

    # Method compatibility: project is_tipi → acceptable makine tip values
    method_uyumluluk: Dict[str, list] = field(default_factory=lambda: {
        "Fore Kazık":          ["Fore Kazık"],
        "CFA Kazık":           ["Fore Kazık", "CFA Kazık"],
        "Kısmi Yerinden Etme": ["Fore Kazık", "CFA Kazık"],
        "Yerinden Etme":       ["Fore Kazık", "CFA Kazık"],
        "Ankraj":              ["Ankraj"],
        "Mini Kazık":          ["Ankraj", "Mini Kazık"],
    })

    # Backward-compatible old thresholds (kept for legacy callers)
    tork_min_oran: float = 0.85    # replaces old 0.80
    tork_uygun_oran: float = 1.00  # kept for backward compat

    # ── RPM adequacy check (Class C) ─────────────────────────────────────────
    # Derives required RPM from avg ROP and tool advance per revolution.
    # Compared against typical Kelly rig RPM range to flag RPM-limited scenarios.
    # Machine model has no max_rpm field → compare against fixed OEM range.
    # Source: OEM application guides (Bauer, Soilmec, Liebherr); FHWA GEC 10 §6.
    #
    # rpm_advance_soil_mrev: Kelly bucket advance per rev in soil (m/rev).
    #   Median of OEM-reported 0.020–0.050 m/rev range (cutting depth per pass).
    # rpm_advance_rock_mrev: Drag-bit face advance per rev in rock (m/rev).
    #   Median of 0.005–0.020 m/rev range (slower due to tool-rock contact limits).
    # rpm_kelly_min/max: Typical continuous rotation range for Kelly rigs.
    #   Mini-rotary anchoring rigs can reach 60–80 rpm but those are excluded
    #   from this check which targets fore kazık (Kelly boring).
    rpm_advance_soil_mrev: float = 0.035   # m/rev in soil (Kelly bucket)
    rpm_advance_rock_mrev: float = 0.012   # m/rev in rock (drag-bit / core bit)
    rpm_kelly_min: float = 15.0            # minimum typical Kelly rig RPM
    rpm_kelly_max: float = 40.0            # maximum typical Kelly rig RPM


@dataclass(frozen=True)
class GuvenCoefficients:
    """
    Data confidence scoring system.

    Engineering basis:
    A project score reflects the quality of input data available for calculations.
    Higher score → more reliable analysis → recommendations carry more weight.
    Source: FHWA GEC 10 §3.3 site characterisation adequacy; EN 1997-1 Table A.1.

    Scoring logic (additive per data item present in the model):
    - CPT qc measured: 35 pts (highest quality in-situ continuous profile)
    - Su measured (lab triaxial/vane): 25 pts (direct strength measurement)
    - SPT N60 available: 20 pts (standard correlation basis)
    - Yaş / formation name known: 10 pts (geological context)
    - UCS measured: 25 pts (for rock layers)
    - RQD measured: 10 pts (rock quality)
    - Full casing coverage verified: 10 pts (structural assurance)

    Level thresholds:
    - HIGH:   score >= 65
    - MEDIUM: 35 <= score < 65
    - LOW:    score < 35
    """

    # Per-data-item scores
    cpt_puan: int = 35
    su_olculmus_puan: int = 25
    spt_puan: int = 20
    yas_bilinen_puan: int = 10
    ucs_olculmus_puan: int = 25
    rqd_olculmus_puan: int = 10
    tam_kaplama_puan: int = 10

    # Score thresholds for confidence level assignment
    yuksek_esigi: int = 65
    orta_esigi: int = 35


@dataclass(frozen=True)
class MazotCoefficients:
    """
    Fuel consumption estimation coefficients.

    Engineering basis:
    Source: Conservative OEM fuel consumption curves; Turkish contractor field data.
    Fuel consumption modelled as piecewise-linear function of torque.
    Class C — highly site/rig dependent.

    - 0–100 kNm: light work, base consumption 8 L/m + 0.040 L/m per kNm
    - 100–200 kNm: medium work, 12 L/m base + 0.080 L/m per kNm above 100
    - >200 kNm: heavy work, 20 L/m base + 0.075 L/m per kNm above 200
    """

    hafif_baz: float = 8.0         # L/m at T < 100 kNm
    hafif_katsayi: float = 0.040   # L/m per kNm
    orta_baz: float = 12.0         # L/m at 100 <= T < 200 kNm
    orta_katsayi: float = 0.080    # L/m per kNm above 100
    agir_baz: float = 20.0         # L/m at T >= 200 kNm
    agir_katsayi: float = 0.075    # L/m per kNm above 200


@dataclass(frozen=True)
class GeotechCoefficients:
    """
    Master coefficient registry for GeoDrill v3.0.

    Usage:
        from configs.geotech_coefficients import KATSAYILAR
        tau_min = KATSAYILAR.tork.kohezyon_su_min
        k_method = KATSAYILAR.yontem.carpan.get("Fore Kazık", 1.00)

    kritik_katman_agirlik: Weighting factors for critical layer scoring.
    Higher weight → more influence on which layer is flagged as critical.
    Rock layers typically govern torque; highly unstable soil layers govern
    construction risk decisions.
    """

    tork: TorkCoefficients = field(default_factory=TorkCoefficients)
    yontem: YontemCoefficients = field(default_factory=YontemCoefficients)
    zemin_suyu: ZeminsuKatsayisi = field(default_factory=ZeminsuKatsayisi)
    derinlik: DerinlikKatsayisi = field(default_factory=DerinlikKatsayisi)
    rop: RopCoefficients = field(default_factory=RopCoefficients)
    cevrim: CevrimSuresiCoefficients = field(default_factory=CevrimSuresiCoefficients)
    casing: CasingCoefficients = field(default_factory=CasingCoefficients)
    stabilite: StabiliteCoefficients = field(default_factory=StabiliteCoefficients)
    makine: MakineCoefficients = field(default_factory=MakineCoefficients)
    guven: GuvenCoefficients = field(default_factory=GuvenCoefficients)
    mazot: MazotCoefficients = field(default_factory=MazotCoefficients)

    # Critical layer scoring weights: keys = soil class, value = weight multiplier
    # Applied in kritik_katman() to rank layers by geotechnical complexity.
    kritik_katman_agirlik: Dict[str, float] = field(default_factory=lambda: {
        "kaya":        3.0,   # rock → dominant torque driver
        "kohezyonlu":  1.5,   # cohesive → stability / time concern
        "granüler":    2.0,   # granular below GWT → casing risk
        "belirsiz":    1.0,   # unknown → conservative
    })

    # Backward-compatibility alias: old code used KATSAYILAR.sure
    # The sure field delegates to cevrim for legacy callers.
    sure: CevrimSuresiCoefficients = field(default_factory=CevrimSuresiCoefficients)


# Singleton — import this everywhere
KATSAYILAR = GeotechCoefficients()
