# GeoDrill — Engineering Assumptions

This document records every engineering assumption embedded in the calculation
engine. It is intended to be readable by a geotechnical engineer reviewing
the platform's outputs.

---

## Torque / Drilling Resistance

### Model Type
Simplified face-cutting shear torque for Kelly/rotary bored pile drilling.

`T = τ_mob × (π d³/8) × f_app`

where:
- `τ_mob` = mobilised shear resistance at the cutting face (kPa)
- `d` = pile diameter (m)
- `f_app` = application factor (default 1.25)

This is a conservative proxy for the minimum face-cutting component only.
Shaft/transport drag and tool-specific contributions are not separately
resolved; they are subsumed into `f_app`.

### Cohesive Soil (Clay, Silt)
`su ≈ N₆₀ × 4 kPa` (minimum 20 kPa)

**Source:** FHWA GEC 5 Table 3-1 / Terzaghi & Peck (1967)
**Class:** B — SPT correlation. Literature range k = 4–6; k = 4 is conservative.
**Upgrade path:** Use lab undrained shear strength (unconsolidated-undrained
triaxial or vane shear) to achieve Class A confidence.

### Cohesionless Soil (Sand, Gravel)
`τ_mob ≈ N₆₀ × 2 kPa` (minimum 15 kPa)

**Source:** Internal engineering proxy. Class C.
**Note:** Cohesionless soil resistance is fundamentally dependent on effective
stress, drainage conditions, and dilatancy — not directly on undrained shear
strength. This proxy is a conservative lower-bound stand-in for SPT-only input.
**Upgrade path:** CPT qc → effective friction angle → effective-stress
shear resistance. Requires CPT data.

### Rock (Weathered Rock, Sandstone, Limestone, Hard Rock)
`τ_face ≈ UCS [MPa] × 100 kPa`  (i.e. UCS/10 in consistent units)

**Source:** FHWA GEC 10 §7.4 — rock socket interface shear
**Class:** B — UCS-based.
**Note:** Actual rock socket interface shear strength ranges from UCS/20 to
UCS/5 depending on roughness, RQD, weathering. UCS/10 is a conservative
central estimate.

### RQD Variability Factors

| RQD (%) | Factor |
|---------|--------|
| ≥ 75    | 1.00   |
| 50–74   | 1.10   |
| 25–49   | 1.20   |
| < 25    | 1.35   |

**Source:** FHWA GEC 10 §7.4 rock quality + conservative engineering judgment.
**Purpose:** Lower RQD = more fractured / variable rock = higher uncertainty
in predicted resistance. Factor provides a conservative upward margin.
Not equivalent to an RQD-based strength degradation factor; its purpose is
uncertainty buffering.

### Application Factor (1.25)
Accounts for: tool geometry, cutting bit efficiency, non-homogeneous loading,
and deviation from idealised circular cutting geometry.
**Calibration:** Should be updated with drilling telemetry data (measured tork
vs depth logs) when available. Editable in `KATSAYILAR.tork.uygulama_faktoru`.

### Output Band
- Lower bound = nominal × 0.80 (favourable conditions)
- Upper bound = nominal × 1.30 (peak-risk conditions)

These are not statistically derived confidence intervals; they are engineering
judgment bounds reflecting the expected variability in field execution.

---

## Rate of Penetration (ROP)

Base values (m/hr at Ø800 mm):

| Soil Type      | Base ROP | Comment |
|----------------|----------|---------|
| Fill           | 8.0      | Unknown compaction |
| Clay           | 6.0      | Soft to stiff |
| Silt           | 6.5      | |
| Sand           | 5.0      | |
| Gravel         | 3.5      | Cobble/boulder risk not captured |
| Weathered Rock | 2.0      | High variability |
| Sandstone      | 1.2      | |
| Limestone      | 0.9      | Karst/cavity risk not captured |
| Hard Rock      | 0.5      | |

**Source:** Generalised from FHWA GEC 10 §7 plus industry practice.
**Class:** C — midpoints of typical ranges. Actual ROP varies significantly
with: tool type, rotation speed, crowd force, mud/water system, equipment
condition.

**UCS reduction:** `ROP_adj = ROP_base × max(0.25, 1 − UCS/100 × 0.75)`
Applied when UCS > 0. At UCS=100 MPa → factor 0.25 (75% reduction).

**Diameter reduction:** `ROP_adj = ROP_base × max(0.45, 1 − (d − 0.8) × 0.5)`
Reference diameter 800 mm. Larger diameter → more energy per revolution → lower
unit advance rate.

**Minimum:** 0.25 m/hr absolute floor (hard rock boundary condition).

---

## Casing / Temporary Support

Rules (source: EN 1536:2010 §5, FHWA GEC 10 §7.3):

1. Sand or Gravel layer > 0.5 m thick → **Required**
2. Cohesionless layer below groundwater table → **Required**
3. Cohesionless layer with SPT N < 10 (very loose) → **Required**
4. Fill layer > 2.0 m thick → **Conditionally recommended** (engineering judgment)

Casing length calculation:
- High-risk layers → 100% of layer thickness
- Medium-risk layers → 50% of layer thickness
- Low-risk layers → 0%

---

## Stability Risk

| Condition | Risk | Reference |
|-----------|------|-----------|
| Sand/Gravel below GWT | Yüksek | EN 1536 §5 |
| Cohesionless SPT ≤ 10 | Yüksek | FHWA GEC 10 §4 |
| Cohesionless SPT 11–30 | Orta | |
| Fill (any) | Orta | Unknown compaction |
| Clay/Silt/Rock | Düşük | Assumed adequate stand-up time |

**Limitation:** This is a simple rule-based proxy. It does not model
pore pressure, creep, or time-dependent stand-up behaviour.

---

## Machine Suitability

Criteria (in rejection priority order):

1. **Method compatibility** — Machine type must match drilling method.
   Source: EN 1536 method classification, OEM technical specs.
2. **Depth** — Machine max rated depth ≥ pile length.
3. **Diameter** — Machine max rated diameter ≥ pile diameter.
4. **Torque** — Machine rated torque ≥ 80% of required nominal → pass.
   Machine rated torque ≥ 100% → Uygun. 80–100% → Şartlı Uygun.
5. **Casing** — If casing required and machine has no casing → Şartlı Uygun.

**Not checked (data model limitation):**
- Crowd / pull-down force
- Pull-out / extraction force
- Kelly bar length vs drill depth
- Rig footprint / access constraints
- Telemetry / QA capability

---

## Cost Model

All costs are **configured estimates**. They are not market prices.

Default unit prices are editable by the user in the Fiyat Analizi page.
The system labels all cost outputs with Class C confidence and an explicit
"yapılandırılmış tahmin" warning.

Cost components:
- Fuel: torque-based consumption estimate × unit price
- Machine amortisation: time-based × configured hourly rate
- Labour: time-based × configured hourly rate
- Consumables: depth-based × configured per-metre rate
- Contingency: percentage markup (configurable)

**Missing components (not modelled):**
- Concrete/grout cost
- Reinforcement cost
- Spoil disposal
- Mobilisation/demobilisation
- QA/testing
- Site-specific risk allowances

---

## Confidence Class Summary

| Output | Default Class | Upgrade Path |
|--------|--------------|--------------|
| Torque (cohesive, SPT) | B | Lab su or CPT → A |
| Torque (granular, SPT) | C | CPT qc → B |
| Torque (rock, UCS) | B | In-situ rock testing → A |
| ROP estimates | C | Field records → B |
| Fuel estimates | C | Site meter data → B |
| Drilling time | C | Production data → B |
| Cost | C | Contract unit prices → B |

---

## Methods NOT Supported

The following methods are flagged as unsupported in the torque engine.
Selecting them generates a warning. The `Fore Kazık` (Kelly/rotary) engine
still runs as a rough proxy, but results should not be used without review:

- **CFA (Continuous Flight Auger)** — requires different torque model;
  grout injection pressure and auger withdrawal rate are the controlling factors
- **Ankraj (Ground Anchor)** — installation geometry, tendon stressing,
  and grout pressure govern execution; rotary torque is secondary
- **Mini Kazık** — small-diameter high-pressure grouted piles; different
  execution methodology

**Reference:** FHWA GEC 8 (CFA), FHWA Anchor Manual, FHWA Micropile Manual
