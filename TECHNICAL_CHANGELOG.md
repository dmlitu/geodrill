# GeoDrill — Technical Engineering Changelog

## v2.0 — Calculation Engine Refactor (Reference-Driven)

### Summary

The calculation core has been refactored from a heuristic estimator into a
method-aware, reference-driven, confidence-scored engineering decision engine.

---

### Changes

#### 1. Coefficient Registry (NEW)

**Files:** `frontend/src/hesaplamalar.js` (export `KATSAYILAR`),
`backend/configs/geotech_coefficients.py`

All engineering constants are now centralised in a single registry object.
Every coefficient carries:
- Name and purpose
- Source class (A / B / C)
- Assumption note
- Editable default

**Why:** Scattered magic numbers prevented auditability and calibration.

---

#### 2. Torque — Range Output Instead of Single Value

**Files:** `frontend/src/hesaplamalar.js` (`gerekliTorkAralik`),
`backend/modules/calculations/engine.py` (`gerekli_tork_aralik`)

**Old behaviour:** `gerekliTork()` returned one exact number (e.g. 187.4 kNm).

**New behaviour:** `gerekliTorkAralik()` returns:
```
{
  nominal: kNm   — reference for equipment selection
  min:     kNm   — lower band (favourable conditions, × 0.80)
  max:     kNm   — upper band (peak-risk conditions, × 1.30)
  guven:   A|B|C — data confidence class
  aciklama: []   — trace of the controlling layer calculation
  uyarilar: []   — method compatibility warnings
}
```
Backward-compatible wrapper `gerekliTork()` still returns `nominal` for
existing callers.

**Why:** Literature does not support a single universal torque formula.
Presenting one number falsely implies precision that the input data does not
support. A range with a stated confidence class is more defensible.

**Reference:** FHWA GEC 10 §7, EN 1536:2010 §8

---

#### 3. Soil Classification Added

**Function:** `zeminSinifi(zemTipi)`, `guvenSinifi(row)`

Soil types are now explicitly classified as:
- `kohezyonlu` — Clay, Silt
- `granüler` — Sand, Gravel, Fill
- `kaya` — Rock types
- `belirsiz` — Unknown

Each layer receives a confidence class (A/B/C) based on available measured data.
Qualitative-only layers (no SPT, no UCS) are Class C.

**Why:** The old code used `kohezyon === "Kohezyonlu"` as the only branch
point. This conflated the soil classification with the UI dropdown value and
did not distinguish measured from inferred parameters.

---

#### 4. Machine Suitability — Method Compatibility Added

**File:** `frontend/src/hesaplamalar.js` (`makinaUygunluk`),
`backend/modules/calculations/engine.py` (`makine_uygunluk`)

**Old behaviour:** Suitability checked only torque, depth, diameter, casing.

**New behaviour:** Method compatibility is checked first:
- `Fore Kazık` project → only `Fore Kazık` machines are compatible
- `Ankraj` project → only `Ankraj` machines
- `Mini Kazık` → `Ankraj` or `Mini Kazık`

A method-incompatible machine returns `Uygun Değil` with explicit reason,
regardless of torque or depth capability.

Also added: explicit `redSebepler` array listing all rejection reasons.

**Why:** An anchor drill cannot perform bored pile work. The old code had no
such check. A machine that passes torque but is the wrong type would
incorrectly appear as `Uygun`.

**Reference:** EN 1536:2010 method classification, OEM technical specs

---

#### 5. Casing Decision — Source-Referenced Rules

**Function:** `casingDurum()`

Rules are now:
1. Sand/Gravel > 0.5 m → Required (EN 1536 §5)
2. Cohesionless below GWT → Required (FHWA GEC 10 §7.3)
3. SPT < 10 cohesionless → Required (FHWA GEC 10 §4)
4. Fill > 2 m → Conditionally recommended (engineering judgment)

Each triggered rule adds a traceable justification string to `gerekce[]`.

**Why:** Old code had the same rules but without source labels or trace output.

---

#### 6. Cost Engine — Explicit Uncertainty Warning

**Function:** `fiyatAnalizi()`

Cost output now includes:
```
{
  ...existing fields...,
  uyari: "Yapılandırılmış tahmin — piyasa fiyatı değildir.",
  guvenSinifi: "C"
}
```

**Why:** Default unit prices are not market prices. Presenting them without
a disclaimer risks misuse in tendering.

---

#### 7. Backend Calculation Modules (NEW)

**Files:**
- `backend/configs/geotech_coefficients.py` — Python mirror of coefficient registry
- `backend/modules/calculations/engine.py` — Python mirror of hesaplamalar.js
- `backend/routers/reports.py` — Updated to use engine module

Old reports.py had duplicate inline calculation functions that could drift
from the frontend. Now reports.py imports from `engine.py`.

**Why:** Calculation parity between frontend and backend was previously
maintained manually (error-prone). The engine module is the single source
of truth for the backend.

---

#### 8. Test Suite Expanded

**File:** `frontend/src/hesaplamalar.test.js`

Added 8 gold-standard engineering scenarios with qualitative outcome assertions:
1. Soft cohesive, no GWT
2. Granular below GWT (casing required)
3. Dense granular (higher demand)
4. Rock socketing (bit selection, transition)
5. Qualitative-only input (Class C confidence)
6. Machine at torque limit
7. Undersized / method-incompatible machine
8. Output sensitivity (diameter, fuel, time)

Also added: coefficient registry tests, soil classification tests, method warning tests.

---

### What Changed vs Did Not Change

| Item | Status | Note |
|------|--------|------|
| Torque formula core (`τ × πd³/8 × f`) | Kept, documented | Conservative lower bound; reference class B |
| SPT→su correlation (k=4) | Kept, documented | FHWA GEC 5; conservative vs k=6 |
| RQD upward variability factors | Kept, documented | Conservative uncertainty margin |
| Base ROP values | Kept, documented | Class C; calibrate with field data |
| Drilling time model | Kept, documented | Class C; calibrate with field records |
| Fuel model | Kept, documented | Class C proxy |
| Machine method check | NEW | EN 1536 method compatibility |
| Torque range output | NEW | Replaces single value |
| Confidence classes | NEW | A/B/C per output |
| Coefficient registry | NEW | Centralised, auditable |
| Backend engine module | NEW | Replaces duplicate inline functions |
| Cost warning | NEW | Explicit "not market price" notice |

---

### What Remains Uncertain / Configurable

1. **Torque application factor (1.25)** — Should be field-calibrated when
   drilling telemetry is available. Editable in `KATSAYILAR.tork.uygulama_faktoru`.

2. **Base ROP values** — Mid-range estimates. Actual ROP varies with tool type,
   rotation speed, crowd force, and fluid system. Calibrate with site records.

3. **Fuel model** — Proxy correlation. Replace with site meter data when available.

4. **SPT→su correlation (k=4)** — Conservative. Use lab undrained shear strength
   if available (upgrades confidence to Class A).

5. **CFA and Anchor torque models** — Not implemented. These methods require
   different calculation engines. Currently flagged with a warning when selected.

6. **Crowd/pull force** — Not in the current machine data model. Machine
   suitability does not yet check pull-out or crowd force capability.
   Add `max_crowd_kn` and `max_pull_kn` to machine schema and engine when available.
