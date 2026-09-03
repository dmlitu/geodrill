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
