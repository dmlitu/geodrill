# CAD Forensic Report — Pile/Anchor Detection on Real Production DWGs

**Scope:** why the CAD analyzer returned `Kazık: 0, Ankraj: 0` on a real İKSA
(shoring) project, what the drawings actually contain, and what was changed
in the detectors as a result. Investigated forensically against ezdxf
before any detector code was touched, per the standing rule: **never fix a
zero result by lowering a threshold — find the real CAD semantics first.**

Two real production fixtures were used throughout (both gitignored, never
committed — real client project files):

- **dosya1**: `BESIKTAS-2KISIM-BALMUMCU ADA 1755 PARSEL 219-IKSA-UYG-14-05-2024-1.dwg`
- **dosya2**: `BESIKTAS-BALMUMCU ADA 1660 PARSEL 220-IKSA-UYG-21-01-2024_.dwg`

---

## 1. Why the old detector returned 0 piles

Two independent causes, both confirmed by direct ezdxf inspection of the
converted DXF (not guessed):

1. **`"CEPHE"` was in `pile.excludeLayerKeywords`.** dosya1's *only*
   representation of its 274 piles is an elevation ("cephe") view on layer
   `KAZIKCEPHE` — there is no plan-view pile block or circle anywhere in
   the file. The exclude rule was written on the assumption that an
   elevation view only ever shows a detail/example, never a real repeated
   row — that assumption is false for this office's drafting convention.

2. **No geometry fallback for anonymous/array-generated block names.**
   Even without the CEPHE exclusion, AutoCAD's associative ARRAY feature
   generates nested INSERTs with meaningless names (`*U78`, `*U92`, ...).
   The old `_walk_container` only classified a nested child by exact
   block-name keyword match (`keyword_hit`) — an anonymous name can never
   match a keyword, so these were silently dropped regardless of the
   CEPHE exclusion.

A third, more subtle bug compounded (2): **ezdxf's `virtual_entities()`
loses the authored `layer` attribute on most items of a large AutoCAD
array.** Direct inspection of container `*U91`'s 78 nested `*U92` copies
showed only indices 0–5 kept `layer='KAZIKCEPHE'`; indices 6–77 all
reported the generic default `layer='0'`. Fixed by threading the real
top-level container's own layer down through the recursion as a fallback
whenever a nested child reports `layer == "0"`.

## 2. What a pile actually looks like in these drawings

**Elevation ("cephe") view — the sole representation in dosya1, and 29
additional piles in dosya2:** a pile is drawn as a pair of parallel
vertical lines (the drilled-shaft outline), spaced at a real-world
plausible shaft width (0.15 m – 2.5 m after unit conversion), repeated
along the wall via AutoCAD arrays. New geometry signature
`_is_shaft_symbol()` in `detectors/pile.py` recognizes this shape
directly — position/rotation-independent, gated on a **required**
layer-keyword match (`KAZIK`/`FORE KAZIK`/etc. — never geometry alone).

**Plan view — dosya2's primary representation (510 of 656 piles):** the
existing `KAZIK_D65`-style named block on layer `65K`, already handled by
the pre-existing keyword+block path — no change needed there.

**Mini-pile — 106 piles in dosya2:** block containing 1 CIRCLE
(r=12.5 cm) + 1 HATCH on layer `MEVCUT MINIKAZIK`, an anonymous nested
block caught by the same new geometry-signature fallback (a plausible
circular pile cross-section on a keyword-matched layer, not a name match).

**Existing/reference piles — 11 in dosya2:** bare circles on layer
`mevcut kazıklar` ("existing piles" — literally named in Turkish), caught
by the pre-existing bare-geometry keyword path.

## 3. Cross-validation and a self-caught regression

My first fix gated the "no name/geometry match → recurse anyway" fallback
on the child being a "pure" (INSERT-only) container, differing from the
detector's original unconditional-recursion behavior. Testing against
dosya2 (not just dosya1) surfaced this immediately: FK65 pile count jumped
from a previously-validated 510 to 922. Root cause: a second top-level
container, `"YENI HATLARS"` ("New Lines"), with byte-identical Y-extents
and overlapping X-extents to the real wall (`"YENI HAT2024"`) — a leftover
CAD revision layer, not real additional piles. **Fix:** removed the purity
gate, reverting to the original unconditional-recursion behavior (the new
geometry signature still runs, it's the recursion decision that was
reverted). Count returned to exactly 510. This is the exact class of
mistake the "cross-validate on the second file" instruction exists to
catch — recorded here so it isn't repeated.

Final pile counts (all reproducible via `pytest tests/test_cad_detectors.py`
plus a direct `CadAnalyzer().analyze()` run against both fixtures):

| File | Count | Breakdown |
|---|---|---|
| dosya1 | **274** | 274× elevation shaft-symbol (`KAZIKCEPHE`, 8 array groups: 16+59+24+37+8+24+28+78) |
| dosya2 | **656** | 510× plan block (`65K`) + 106× mini-pile geometry (`MEVCUT MINIKAZIK`) + 29× elevation shaft-symbol (`KAZIKCEPHE`) + 11× bare circle (`mevcut kazıklar`) |

An analyzer-level warning is emitted whenever any shaft-symbol piles are
present, telling the reviewer to manually confirm they aren't also counted
separately in a plan view elsewhere in the same file — coordinate-proximity
dedup can't catch this because an elevation view lives at its own sheet
location, nowhere near the plan-view coordinates.

## 4. Anchors — what the drawings contain, and what was NOT promoted

`"ANKRAJ"` appears as literal drawing **text** 342 times in dosya1 and 575
times in dosya2 — the file is unambiguously an anchored shoring project.
But almost none of that text sits next to a distinctive, unambiguous
anchor *symbol* the way piles do. Concretely:

- **Layer `TENDON`** — real LINE/LWPOLYLINE geometry, consistent
  repeated length (750 units in dosya1, all but one at a single
  orientation) drawn as the anchor tendon/strand in elevation. This is
  the one clean, geometry-first signal found. Added `"TENDON"` to the
  anchor layer/block/text keyword lists (all bare-geometry matches — no
  new code needed, `_from_bare_geometry` already handles it).
  → **9 candidates in dosya1, 5 in dosya2** (HIGH/MEDIUM confidence).

- **`ILAAVEANK`** ("ilave ankraj" = additional anchor) on layer
  `KARSIILAVEANK`, and **`CEPANK`** ("cephe ankraj") on layer `25` —
  real, periodically-array-placed blocks that are unmistakably anchor
  markers *by name and by regular spacing*, but neither name contains the
  literal substring `"ANKRAJ"` or `"ANCHOR"`, so no keyword rule catches
  them. This is exactly the "meaningless/abbreviated name" problem the
  brief anticipated. A generalizable fallback,
  `_from_repeated_blocks()` in `detectors/anchor.py`, was added: any
  block repeating ≥5× with a majority of its instances having
  anchor-keyword text nearby is promoted (MEDIUM confidence — repetition
  + text corroboration is real evidence, but weaker than an explicit
  keyword hit, so it's capped below HIGH and always left for human
  review). **In practice, neither `ILAAVEANK` nor `CEPANK` cleared this
  bar** — 0% of their instances had matching text within the unit-scaled
  proximity radius in either file, so they are correctly *not* promoted.
  This is reported honestly rather than forced: their true structural
  meaning could not be confirmed from geometry+text alone in these two
  files, and forcing a match would have repeated the over-counting
  mistake from §3 in a new form.

### A false positive this same fallback produced, and the fix

Before the gate described below, `_from_repeated_blocks` promoted
**709 candidates** in dosya2 from block `KOTKESITICIN` on layer
`XYZTABLO` — a coordinate/setting-out **table**, not a drawing of
anchors. `KOTKESITICIN` is a literally empty block definition (zero
internal geometry — a bare leader/attribute point) reused for *every* row
type in the table; 54% of its instances happened to sit next to
`"...SIRA ANKRAJ KOTU"` text because many (not all) of the table's rows
are anchor-elevation rows. Promoting it violated this codebase's own
stated design principle (`text_analyzer.py`: *"text is only ever used to
corroborate an already-geometry-based candidate — never as the sole
basis for a count"*) — an empty block has no geometry to corroborate.
**Fix:** `_from_repeated_blocks` now requires the block to contain real
internal geometry (`entity_total > 0`) before text corroboration is even
considered, and `"TABLO"/"TABLE"/"LISTE"/"CETVEL"/"KOORDINAT"` were added
to `anchor.excludeLayerKeywords` as a generalizable "this layer is a data
table, not a drawing" signal. Re-verified: dosya2 anchor count dropped
709 → 0 from this path (TENDON's 5 candidates are unaffected, different
code path).

A second near-miss: block **`"TIE ROD"`** (already one of our own anchor
keywords!) appears 262 times in dosya1 — but every instance sits on layer
`"ARASTIRMA KUYUSU"` ("investigation borehole"), a soil-investigation
grid marker with 0% anchor-text corroboration and zero internal geometry.
The same empty-block + corroboration gate correctly excludes it despite
the enticing name — a concrete demonstration of why name matching alone
(even on a real anchor keyword) is not sufficient.

**Anchor totals: dosya1 = 9, dosya2 = 5 — both entirely from the `TENDON`
layer, both false-positive-checked against the table/borehole traps
above.** This is materially lower than the pile counts.

### Text-only fallback: surfacing the rest as uncertain, not as a count

Direct inspection of the label `"1.SIRA ANKRAJ KOTU"` / `"2.SIRA ANKRAJ
KOTU"` ("row N anchor level") text pattern showed something important: 222
(dosya1) / 365 (dosya2) occurrences, **every single one at a spatially
distinct (x, y)** — not a repeated static note — spread across almost the
*entire drawing width* (X span 108,854 / 214,211 units) in a narrow Y band,
exactly matching the elevation-view convention already trusted for piles.
Checking the geometry actually next to each label showed most have **no
drawn symbol beside them at all** — this office marks a large share of its
anchor positions with text alone.

That is real, well-corroborated-by-its-own-repetition evidence — but text
alone is explicitly never sufficient for a confirmed count in this
codebase's design (`text_analyzer.py`). Rather than either ignore it
(losing real signal) or promote it (repeating the KOTKESITICIN mistake in
a new form), `_from_text_only()` in `detectors/anchor.py` surfaces each
distinct-position, anchor-keyword-matching label as a **hard-capped LOW
confidence** candidate (`text_only_wide_pattern` = 0.50, always below the
confirmed floor) — visible in `uncertainCandidates`, never folded into
`anchorCount`. A length cap (>80 chars) excludes general project-note
paragraphs that happen to mention "ankraj" (found via this exact
investigation: a 1,916-character "UYARILAR" warnings note, repeated 7
times, was initially caught before this filter). A candidate already
covered by a geometry-based hit (within the unit's duplicate tolerance) is
skipped so it doesn't duplicate real evidence.

Result: dosya1 surfaces 337 additional uncertain anchor positions, dosya2
569 — a much more honest picture of this project's true anchor scale than
"9" or "5" alone, without the algorithm ever claiming certainty it
doesn't have. Recommendation: treat `anchorCount` as a confirmed floor,
and have an engineer review `uncertainCandidates` (or `GET /cad/inspect`'s
raw dump) for the real count on anchor-heavy projects until a stronger,
still-generalizable geometry signal is found in a future drawing sample.

## 5. Test coverage added

`backend/tests/test_cad_detectors.py`:
- `test_cephe_layer_is_not_excluded` — locks in §1's CEPHE fix.
- `test_shaft_symbol_detected_via_layer_and_geometry_no_name_match`,
  `test_shaft_symbol_ignored_without_layer_corroboration` — the new pile
  geometry signature, positive and negative case.
- `test_nested_leaf_layer_fallback_to_root_container_layer` — the
  `virtual_entities()` layer-loss fix.
- `test_recursion_reaches_pile_block_through_mixed_non_pure_container` —
  locks in the §3 regression revert.
- `test_repeated_unnamed_anchor_block_promoted_via_text_corroboration`,
  `test_repeated_unnamed_block_below_corroboration_majority_not_promoted`,
  `test_empty_marker_block_never_promoted_by_text_alone` — the new anchor
  fallback, its majority-threshold guard, and the §4 false-positive
  regression, respectively.

Full suite: **200/200 passing.** Both real fixtures re-verified end to end
through `CadAnalyzer().analyze()` after every change in this investigation
(not just unit tests) — final state: dosya1 274 piles / 9 anchors,
dosya2 656 piles / 5 anchors, zero regressions in either count from the
pre-existing, already-validated pile baseline.

## 6. What deliberately was not done

- No block/layer/text name was hard-coded into the detector (`"*U84"`,
  `"CEPANK"`, `"KOTKESITICIN"`, etc. appear only in comments/tests as
  *evidence*, never as `if name == "..."` logic).
- No confidence threshold was lowered to force a non-zero count.
- `ILAAVEANK`/`CEPANK` were not force-promoted despite looking anchor-like
  by name, because the evidence bar (repetition + majority text
  corroboration) they were held to is the same bar every other candidate
  in the system is held to.
- Geotechnical calculation logic (`hesaplamalar.js`/`reports.py`) was not
  touched — this entire investigation is CAD structural-element detection,
  upstream of and separate from the engineering calculations.

## 7. Addendum — verifying the reported "Kazık: 521, Ankraj: 0" result

A later production run reported: 521 piles, 0 anchors, unit CM, 16,526
Model Space entities, 141 layers, 459 blocks, 2 Paper Space layouts, 0
XREF, 54 uncertain candidates — with the bulk of piles attributed to
block `FK65` on layer `65K`, `block+nested`, MEDIUM confidence. This
addendum verifies that number against the real fixtures rather than
accepting it, per the standing rule, using the `block_inventory.py`
tooling added alongside this addendum (see `CAD_RESEARCH.md`).

### 7.1 This is the same file already in this report

Re-running `CadAnalyzer().analyze()` (current `main`) against
`BESIKTAS-BALMUMCU ADA 1660 PARSEL 220-IKSA-UYG-21-01-2024_.dwg` produces
diagnostics that match the reported production numbers **exactly, on
every independent field**:

| Field | Reported | This fixture, this session |
|---|---|---|
| Unit | CM | `cm` |
| Model Space entities | 16,526 | 16,526 |
| Layers | 141 | 141 |
| Blocks | 459 | 459 |
| Paper Space layouts | 2 | 2 |
| XREF | 0 | 0 |

Five independent diagnostic fields matching exactly is not a coincidence —
this is the same file (or a byte-identical copy). That makes the pile/
anchor *counts* directly comparable, and they are **not** the same:

| | Reported (production) | This session (current `main`) |
|---|---|---|
| Piles | 521 | 656 |
| Anchors | 0 | 5 |
| Uncertain candidates | 54 | 623 |

### 7.2 Where 521 and 0 actually came from: stale detector code, not a detection failure

The gap is fully explained by commits already on `main` (this repo) that
the production deployment evidently predates:

- **521 = exactly the pre-fix pile total.** This session's own detector
  run against this file breaks the 656 down as `503 + 7` (FK65/`65K`,
  `block+nested`) `+ 106` (`MİNİ`/`MEVCUT MINIKAZIK`, the mini-pile
  geometry fallback) `+ 29` (`*U82`/`KAZIKCEPHE`, the elevation shaft-symbol
  fallback) `+ 11` (bare circle, `mevcut kazıklar`). The mini-pile and
  shaft-symbol geometry fallbacks were both added in commit
  `4e8da8a` ("generalize pile/anchor detection for anonymous blocks and
  text-corroborated fallbacks"). Remove exactly those two fallbacks'
  contributions (106 + 29 = 135) and 656 − 135 = **521**, matching the
  reported number to the piece.
- **0 = exactly the pre-fix anchor total.** All 5 of this session's anchor
  detections come from the `TENDON` layer keyword, which §4 of this same
  report records as **added during this investigation** (commit
  `4e8da8a`/`0c6dd20`). Before that keyword existed, this file's only clean
  geometry-based anchor signal wasn't recognized at all — 0 is exactly
  what the pre-fix detector would report.
- The much lower uncertain-candidate count (54 vs. 623) is consistent with
  the same explanation: the bulk of the 623 (569 of them, per §4) comes
  from `_from_text_only`, added in commit `0c6dd20` ("surface text-only
  anchor labels as uncertain candidates") — also not yet in the production
  run.

**Conclusion: the 521/0 result is not evidence of a live detection gap in
the current codebase — it is a stale-deployment artifact.** `main`
(commit `225f541` at the time of this session) already contains the fix;
what's needed is a redeploy of the backend to Render, not new detector
code, to take production from 521/0 to 656/5 on this exact file. This was
confirmed by direct comparison, not inferred.

### 7.3 FK65 forensic deep-dive (block_inventory.py + direct ezdxf inspection)

Direct extraction, this session, against the live parsed document:

- **Top-level Model Space INSERT count for `FK65`: 0.** `FK65` never
  appears directly in Model Space — it is a **nested-only** block. This is
  exactly the "does the 521/510/656 count include phantom top-level
  inserts" question raised in the brief, and the direct answer is: no top-
  level inserts exist for this block at all; every count is nested.
- **Nested INSERT count reaching `FK65`: 510**, all from a single top-level
  container, confirmed via a direct instrumented re-run of the detector's
  own walk (traced per top-level Model Space INSERT, this session):
  `YENI HAT2024` (inserted once in Model Space) alone contributes all 510
  — 151 direct literal `INSERT name==FK65` records authored straight
  inside it, plus 359 more reached through 7 nested two-level anonymous
  ARRAY chains inside it. No other top-level container contributes any
  FK65 candidate in the current live run — see §7.3.1 for why that's true,
  and why it can't be taken for granted in general.
- **Unique physical insertion count: 510, confirmed distinct.** All 510
  resulting `(x, y)` coordinates are pairwise distinct (`len(coords) ==
  len(set(coords)) == 510`), and running `duplicate_resolver.py`'s own
  merge pass against the FK65-only candidate subset produces **510
  survivors — zero merges**. This directly answers the brief's central
  question: **521 (now 510+11=521, or 656 on current `main`) is not double
  counting a smaller number of physical piles** — see also §3 of this
  report, which independently caught and fixed a real over-count bug
  (922) earlier in this same investigation and confirmed the corrected
  510 the same way.
- **Block definition content:** exactly one `CIRCLE` (radius **32.5**), one
  `LINE`, one `LWPOLYLINE`, one `HATCH` — the standard plan-view pile
  symbol (circle outline, hatch fill, a leader/callout line).
- **Diameter — real geometry evidence, not a text guess:** the block's own
  `CIRCLE` radius is 32.5 in the document's own unit (`cm`, confirmed via
  `$INSUNITS`), i.e. a **65 cm diameter** — matching the "65" in the block
  name itself. This is drawn geometry, not inferred from a text label:
  **diameter can be extracted, and is corroborated (not guessed) here.**
- **ATTRIB / ATTDEF:** `FK65` has neither. Across the *entire* file, only
  2 of 459 blocks carry an ATTDEF at all (an axis/grid "AKS" balloon
  block, unrelated to piles or anchors), and not a single INSERT anywhere
  in the file has a populated ATTRIB. This office's drafting convention
  does not use block attributes for pile/anchor semantics — confirmed
  directly, not assumed.
- **Rotation / scale:** not meaningfully applicable at the top level (0
  top-level inserts); the 510 nested placements inherit rotation/scale
  from their composed parent-container transforms via `virtual_entities()`,
  which is exactly the primitive ezdxf's own docs recommend for this (see
  `CAD_RESEARCH.md` §1, source #1).
- **Dynamic block info:** none recoverable — `FK65` is a plain named block
  (not `*U...`), so there is no dynamic-block ambiguity for this specific
  block; the surrounding array *containers* it lives inside (`*U1883`,
  `*U1885`, ... — 16 of them) are anonymous, consistent with AutoCAD's own
  ARRAY-generated naming (see `CAD_RESEARCH.md` §2/§6).
- **Parent/container structure:** 151 direct `FK65` children live straight
  inside `YENI HAT2024`'s own block definition; the remaining 359 are
  reached through 7 independent two-level anonymous ARRAY chains nested
  inside it (an outer wrapper block instanced once inside `YENI HAT2024`,
  containing one inner "path" block that holds N literal `FK65` INSERT
  copies) — chain sizes 4, 26, 76, 74, 58, 66, 55, summing with the 151 to
  exactly 510.
- **Surrounding TEXT/MTEXT/layer relationship:** layer `65K` — a numeric-
  suffix layer name the existing `pile_layer_keywords`/`FK` short-code rule
  already matches (see `rules.py`'s ≤3-char canonical-code handling);
  no text corroboration was needed or used for this candidate, consistent
  with `block+nested` (no `text` tag) in the reported `detectedBy` field.

#### 7.3.1 A second, previously-undiscovered risk found while verifying 510: the nested-walk budget is shared and can be silently exhausted

Verifying "is 510 real" surfaced something not caught by the original
investigation: `PileDetector._NESTED_MAX_VIRTUAL_ENTITIES` (20,000) is a
**budget shared across every top-level container in the whole document's
walk**, not a per-container allowance. This file has 1,553 top-level
Model Space INSERTs. Instrumenting the walk directly (this session) shows
the shared budget goes negative partway through processing them — around
container #1,321 of 1,553, well before the end — after which **every**
remaining top-level container silently produces zero candidates,
regardless of what it actually contains.

This matters here specifically because one of the containers that falls
after that cutoff is `YENI HATLARS` — §3's own already-identified leftover
duplicate revision layer (byte-identical Y-extents, overlapping X-extents
with the real `YENI HAT2024` wall). Direct inspection confirms
`YENI HATLARS` structurally *does* reach `FK65` too, through 8 of its own
independent anonymous ARRAY chains (verified: each terminates in exactly
one `FK65` INSERT, same shape as `YENI HAT2024`'s chains) — meaning it
would contribute several hundred additional (bogus, duplicate) FK65
candidates if the walk ever reached it. **It currently doesn't, but by
accident of Model Space iteration order and budget arithmetic, not by any
designed exclusion.** Because it's spatially overlapping with the real
wall, `duplicate_resolver.py` would very likely have merged those back
down to the same 510 unique positions even if the budget had reached
it — but that is exactly the kind of thing that must be verified, not
assumed, per this report's own standing rule, and on a *different* file
where a late-processed container holds real, non-overlapping piles, the
same exhaustion would silently **undercount** with zero indication.

**Fixed this session:** the walk now checks the shared budget explicitly
per top-level container (rather than only inside the recursive helper,
which already no-opped silently) and — the first time it's found
exhausted — appends a warning to the response naming the first
skipped container, pointing the reviewer at `GET /cad/inspect`'s new
`blockInventory` for cross-checking. **Confirmed this changes no counts**:
both real fixtures re-verified before/after — 656/5 and 274/9, unchanged
— this is a pure observability fix, not a detection change.

**Left as a follow-up, not fixed blind:** whether the budget should
instead be scoped per top-level container (so one large legitimate array
can't starve every container processed after it) is a real design
question with its own performance/DoS-protection trade-offs — the current
20,000 ceiling exists specifically to bound worst-case cost against an
adversarial file, and changing its semantics deserves its own dedicated
test matrix rather than a reactive tweak here.

**Direct answers to the brief's specific questions:**

| Question | Answer |
|---|---|
| FK65 nedir? | A named (not anonymous) plan-view pile symbol block: circle + hatch + outline, radius 32.5 cm |
| 521 nereden geliyor? | Stale pre-fix production code (§7.2) — the current codebase gives 656/5 on the identical file |
| 510 (FK65's own contribution) unique physical object mı? | Yes — 510 distinct coordinates, 0 duplicate-resolver merges |
| FK65 neden pile olarak sınıflandırıldı? | Layer `65K` matches the `FK`/pile layer-keyword rule; block content is a circle-based pile symbol (`_is_symbol_block`) |
| Confidence neden MEDIUM (reported) / current `block_keyword_match×0.95`? | Nested-anonymous-container path scores slightly below a top-level block+layer+geometry match — see `detectors/pile.py`'s `_walk_container` scoring comment |
| Diameter çıkarılabiliyor mu? | Yes — 65 cm, from the block's own `CIRCLE` radius (32.5), not text-inferred |

### 7.4 Anchor representation — why "0" was wrong and what fixed it

Already fully documented in §4 above (`TENDON` layer geometry, the
`ILAAVEANK`/`CEPANK` non-promotion, the `KOTKESITICIN` false-positive catch,
and the text-only uncertain surfacing). Restated against the brief's
specific failure-mode checklist: the cause was **detector limitation**
(no keyword covered `TENDON`, and no fallback existed yet for
repetition+text-corroborated unnamed blocks), not primitive-geometry
unsupported-entity, dynamic-block metadata loss, missing XREF, or DWG→DXF
conversion loss — all of which were checked directly and ruled out (see
`CAD_RESEARCH.md` §3).
