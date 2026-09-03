# CAD Research — Automatic Object Counting & Extraction in CAD/DWG/DXF

**Scope.** Research done before touching detector code, per the standing
project rule (see `CAD_FORENSIC_REPORT.md`): never react to a "wrong" count
by tweaking a threshold — first learn what real CAD tooling actually does,
what our current pipeline actually captures/loses, and where the gap is.
This document covers AutoCAD's own counting model, ezdxf's real
capabilities and limits, direct-DWG-access alternatives (ODA/RealDWG/
LibreDWG), academic/industry symbol-recognition approaches, and Turkish +
English geotechnical/shoring CAD vocabulary. It ends with a gap analysis
against GeoDrill's actual code and the architecture implemented as a first
increment (see "Implemented this iteration").

---

## 1. Sources

| # | Source | Tier | What was researched | Applicability to GeoDrill |
|---|---|---|---|---|
| 1 | [ezdxf — Insert class docs](https://ezdxf.readthedocs.io/en/stable/blocks/insert.html) | Official (ezdxf) | `virtual_entities()`, `multi_insert()`/`mcount` (MINSERT), `get_attrib()`/`get_attrib_text()`/`.attribs`, `block()`, transform composition | Confirms our nested-walk already uses the right primitive (`virtual_entities()`); confirms **MINSERT is a distinct code path we don't handle at all** (see Gap #3) |
| 2 | [ezdxf — Tutorial for Blocks](https://ezdxf.readthedocs.io/en/stable/tutorials/blocks.html) | Official (ezdxf) | Anonymous-block query patterns (`INSERT[name ? "^\*U.+"]`), block layout traversal | Confirms `*U` is purely an ezdxf/AutoCAD naming convention, not evidence of anything semantic on its own — matches our existing "never trust a name alone" design |
| 3 | [ezdxf — Attrib class docs](https://ezdxf.readthedocs.io/en/stable/blocks/attrib.html) / [AttDef docs](https://ezdxf.readthedocs.io/en/stable/blocks/attdef.html) | Official (ezdxf) | `ATTRIB` (attached, per-instance value) vs `ATTDEF` (template, in the block *definition*), `search_const=True` fallback | **We extracted neither before this iteration** — real gap, now closed for ATTDEF (Gap #2 / Implemented #3) |
| 4 | [ezdxf GitHub Discussion #863 — "Problem evaluating anonymous blocks"](https://github.com/mozman/ezdxf/discussions/863) | Official maintainer statement | Whether a dynamic block's anonymous DXF child (`*U155`) can be traced back to its authored/"effective" name | **Authoritative, direct answer: "Dynamic blocks are not documented in the DXF reference."** The maintainer confirms this link is not recoverable from DXF at all — not an ezdxf limitation, a DXF-format limitation |
| 5 | [Autodesk Help — DATAEXTRACTION command](https://help.autodesk.com/cloudhelp/2023/ENU/AutoCAD-Core/files/GUID-5A39FFE8-10AC-4AE5-8EF4-D097C8261D1A.htm) / [About Extracting Data from Block Attributes](https://help.autodesk.com/view/ACD/2024/ENU/?guid=GUID-BA68DD22-A3CD-4538-90A9-6101C33BC963) | Official (Autodesk) | What DATAEXTRACTION/COUNT actually tallies: object properties, block name, attributes, a "Show count column", Model Space filtering, export to table/CSV/XLS | This **is** AutoCAD's own block-inventory logic — our `block_inventory.py` (Implemented #1) reproduces its "weighted, fully-expanded" counting semantics directly against the parsed document |
| 6 | [Autodesk Help — About Anonymous Blocks (AutoLISP)](https://help.autodesk.com/view/ACD/2022/ENU/?guid=GUID-EB9BFDAA-487A-4586-A556-1F5F84BCF2F3) | Official (Autodesk) | `*Unnn` naming convention; anonymous blocks back dynamic blocks, tables, hatch patterns, associative dimensions | Confirms an anonymous block is not inherently "a pile" or "junk" — its *use* (dynamic-block child vs. hatch-pattern scaffolding vs. dimension scaffolding) can only be inferred from what's inside it, which is exactly our existing geometry-signature approach in `detectors/pile.py`, now generalized in `block_inventory.py` |
| 7 | [Open Design Alliance — Drawings SDK](https://www.opendesign.com/products/drawings) / [Product Descriptions FAQ](https://www.opendesign.com/faq/product-descriptions) | Official (ODA) | Native DWG object model access, extension dictionaries, custom objects; **membership-gated, libraries not publicly downloadable** | Direct DWG access would in principle preserve more (see §3) but the license model (paid ODA membership, no public pip/apt package, redistribution terms tied to membership) makes it a business decision, not a drop-in swap — correctly out of scope for this iteration per the brief ("don't rip out the working pipeline") |
| 8 | [GNU LibreDWG manual — XDATA](https://www.gnu.org/software/libredwg/manual/html_node/XDATA.html) / [LibreDWG.texi](https://github.com/LibreDWG/libredwg/blob/master/doc/LibreDWG.texi) | Official (GNU) | Native DWG read coverage (~99% per the manual), ATTRIB/XDATA structures present, but **dynamic-block parameter classes (BLOCKLINEARPARAMETER etc.) are explicitly listed as "unhandled/undertested"** | Even reading the DWG binary directly and skipping DXF conversion would **not** currently give us reliable dynamic-block metadata through the tool we already build from source (`dwg2dxf`) — the "DXF conversion loses information" hypothesis is **not** the primary cause of the effective-name gap; the format/tooling gap is upstream of DXF entirely |
| 9 | [FloorPlanCAD: A Large-Scale CAD Drawing Dataset for Panoptic Symbol Spotting (arXiv 2105.07147)](https://arxiv.org/pdf/2105.07147) and [Automatic Detection and Classification of Symbols in Engineering Drawings (arXiv 2204.13277)](https://arxiv.org/pdf/2204.13277) | Academic | Deep-learning symbol-spotting approaches (CNN/GAT panoptic segmentation) on *vectorized* CAD, not raster | Confirms the state of the art itself treats vector CAD (entities/graph) as the right representation, not pixels — validates the brief's "raster CV is last resort" principle; ML here operates on the same entity/graph primitives our pipeline already extracts, so a future ML phase would consume `block_inventory`/signature output, not replace it |
| 10 | Turkish şartname/terminology search (İTKİB İKSA-Fore Kazık şartnamesi, "zemin ankrajı" design-note sources) + English geotechnical sources (Wikipedia "Tieback (geotechnical)", Concrete Society "Contiguous/Secant Piles") | Technical/industry | Turkish vocabulary: fore kazık, iksa kazığı, teğet/sekant kazık, mini kazık, zemin ankrajı, öngermeli ankraj, kök boyu, serbest boy, ankraj kafası. English: bored/secant/contiguous/soldier pile, tieback, ground anchor, prestressed anchor | Feeds §7's bilingual vocabulary table; **no single office's naming convention is treated as universal** (both real fixtures already disagree with each other — see Gap #6) |

Also directly consulted (no fetch needed — already in this repo's own prior investigation): `CAD_FORENSIC_REPORT.md`, `cadDetectionRules.json`, and the full `modules/cad/` source, which anchor everything below in what GeoDrill *actually* does today rather than an assumed baseline.

---

## 2. How real CAD tooling actually counts objects

**AutoCAD COUNT / DATAEXTRACTION** does not "search for a keyword" — it
enumerates **objects** (block references, by definition name) directly
against the drawing database, offers a live "Show count column", and can
filter by Model Space vs. all space. Two properties of this matter for us:

1. It counts **the block reference**, full stop — the semantic label
   ("is this a pile?") is a human decision made when the operator picks
   which block(s) to extract, encoded via a *schedule/table template* the
   office maintains themselves. AutoCAD does not know a block is a pile any
   more than we do from geometry alone; it *does* know exactly how many of
   a given block definition exist, including nested/arrayed ones, because
   it walks the same BLOCKS-table graph our new `block_inventory.py` now
   walks.
2. **DATAEXTRACTION's attribute columns** are the tool's one piece of real
   semantic evidence: if the office attached `ATTRIB`s (TYPE, DIA, ID...)
   to their pile block, that data extracts directly, with zero geometric
   inference needed. This is why attribute extraction is prioritized in
   §6/§8 of the brief — it is the one channel where the *drafter*, not our
   pipeline, already did the classification.

**Dynamic blocks** are an AutoCAD-side, ObjectARX-level feature. Per the
ezdxf maintainer directly (source #4) and Autodesk's own AutoLISP docs
(source #6), the "effective name" a user sees in the AutoCAD UI
(`ANKRAJ_TIP1`) is **not part of the DXF specification** — it exists only
inside AutoCAD's live in-memory object model and the DWG's proprietary
dynamic-block-parameter objects. Once a drawing is saved as DXF (by
AutoCAD itself, or by any DWG→DXF converter, including ODA's), that link
is gone; the anonymous `*Unnn` name is genuinely the only name that exists
in the file. LibreDWG (source #8) confirms the DWG-side parameter classes
that *would* carry this are themselves only partially implemented even
when reading the binary DWG directly. **Conclusion: this is a hard,
format-level ceiling, not a bug in our converter or parser** — it must be
reported as "cannot be recovered from this file" rather than silently
guessed at, and diagnostics should say so explicitly (done — see
"Effective block name" in the gap table).

**MINSERT** (AutoCAD's legacy pre-ARRAY multi-insert grid entity, group
code 70/71 `mcount`/`rowcount`) is a second, *separate* nested-repetition
mechanism from the ARRAY-generated anonymous-container pattern our
existing code already handles. ezdxf's own docs are explicit that
`virtual_entities()` does **not** expand MINSERT — a caller must check
`insert.mcount > 1` and call `insert.multi_insert()` itself. Neither
`parser.py` nor `detectors/pile.py` calls `multi_insert()` or checks
`mcount` anywhere. Neither real production fixture happens to use MINSERT
(confirmed directly, see §5.3), so this is a **latent gap, not the cause of
today's numbers** — recorded here rather than fixed blind, since a
synthetic-only fix with no real corroborating file risks the same
"reacted without evidence" mistake the CEPHE-exclusion bug started as.

**Symbol/quantity-takeoff tools** outside AutoCAD itself (BOM extraction,
AI takeoff products) converge on the same layering the brief specifies:
*read layers/blocks/attributes first, fall back to geometry pattern
matching, treat raster vision as a last resort*. The one AI-specific
technique worth naming — "AI agents read the geometry, not the label" — is
already exactly what our `_is_symbol_block` / `_is_shaft_symbol` geometry
signatures do, just per-detector rather than as a generalized, inspectable
signature. `block_inventory.py`'s `geometry_signature()` (Implemented #4)
is the generalized version.

---

## 3. Direct DWG access vs. our DWG→DXF pipeline — what's actually lost

The brief's hypothesis was "DWG→DXF conversion probably loses dynamic
block metadata, XData, extension dictionaries, MLeader data". Checked
directly (not assumed) against both real production fixtures via ezdxf,
post-conversion:

| Signal | Present after our DWG→DXF conversion? | Evidence |
|---|---|---|
| XDATA on INSERT entities | **Yes** — 1,546 / 1,135 INSERTs (the two files) carry XDATA payloads | Direct `insert.has_xdata` scan, this session |
| Extension dictionaries on INSERT | **Yes**, sparse (1–3 per file) | Direct `insert.has_extension_dict` scan, this session |
| ATTDEF (attribute templates) | **Yes**, where the office used them at all (2 of ~660 blocks across both files) | Direct scan, this session — see §5 |
| ATTRIB (attached instance values) | N/A in these two files — **zero** INSERTs anywhere in either file carry a filled-in `.attribs`, even though ATTDEF templates exist in 2 blocks | Same scan — this is the office's own drafting habit (they never populated the template), not something conversion dropped |
| Dynamic-block "effective name" | **No — never present even before conversion reaches the file**, per source #4/#6 (see §2) | Not a conversion artifact |
| MINSERT | Not present in either real fixture (0 anywhere) | Direct scan, this session |

**Conclusion:** our DWG→DXF→ezdxf pipeline is **not** silently discarding
XDATA, extension dictionaries, or attribute data — all of it survives
conversion and is directly readable. The one channel that's actually
missing (dynamic-block effective name) is missing **at the DXF-format
level**, not because of our specific converter choice; ODA's own Drawings
SDK reading the DWG natively would face the identical ceiling for the
*effective name* specifically, because that data lives in DWG's dynamic
block parameter objects which even LibreDWG (much deeper native DWG
access) documents as unhandled/undertested. **Recommendation: do not swap
DWG converters or licenses to chase this — it would not solve the actual
problem.** Where direct DWG access via ODA's SDK genuinely could pay off
later is *not* effective names but **richer custom object / XRecord data**
some AutoCAD verticals attach — worth a narrow, isolated spike only if a
future customer file is found to actually carry such data and ATTRIB/XDATA
alone doesn't explain it; not justified today against real evidence.

---

## 4. Could ML materially improve this?

Per the brief's explicit ask: yes, several published approaches
(GAT-CADNet-style panoptic symbol spotting, CNN-based engineering-drawing
symbol classifiers — source #9) exist and perform well *for their target
domain* (largely architectural floor plans and P&ID-style mechanical
schematics with large labeled training sets). Two reasons this is **not**
recommended for GeoDrill right now:

1. **The information those models have to re-derive from pixels or raw
   point clouds — entity type, layer, block identity, attribute values,
   repetition — is information we already have exactly and losslessly**
   from the DXF entity stream. Training or hosting a model to re-infer
   what `msp.query("INSERT")` already gives verbatim would be strictly
   worse: slower, probabilistic where we can be exact, and one more
   component (model weights, inference latency, drift) to maintain for no
   accuracy gain on the part of the problem that's actually solved.
2. **No labeled training set exists for this domain** (Turkish İksa/anchor
   shoring drawings) — the closest published dataset (FloorPlanCAD) is
   architectural floor plans, a different symbol vocabulary and drafting
   convention entirely; using it directly would not transfer, and building
   a labeled Turkish-shoring-drawing dataset is a multi-month effort with
   no existing shortcut.

Where ML *would* earn its place, later, and only after the deterministic
layer above is exhausted: **learning a firm's abbreviation/legend
convention across many of their files** (§7/CadDetectionProfile below) —
a genuinely statistical, drawing-corpus-scale problem no fixed keyword list
can solve, as opposed to "what shape is this one block" which is fully
deterministic today. This is recorded as a **Phase 3** idea, not built.

---

## 5. Gap analysis — GeoDrill today vs. what real tooling does

| Technique | Source | GeoDrill before this session | Implemented this iteration |
|---|---|---|---|
| Block reference counting (top-level) | AutoCAD COUNT | Yes (`parser.py` insert_counts) | — |
| **Weighted/nested block counting** (AutoCAD's real "how many, fully expanded" number) | AutoCAD DATAEXTRACTION, ezdxf `virtual_entities()` | Partial — only inside `detectors/pile.py`'s own nested walk, pile-specific, not a general-purpose number you can check against any block | **Yes** — `block_inventory.py: compute_weighted_occurrences()`, block-agnostic |
| Nested/block-in-block traversal | ezdxf `virtual_entities()` | Yes (pile only; not mirrored for anchors — documented existing gap, unchanged) | — |
| MINSERT expansion | ezdxf `Insert.multi_insert()`/`mcount` | **No** | **Not implemented** (no real evidence it's needed yet — see §2; recorded as a known gap with a clear repro pattern for whoever hits it) |
| Anonymous block handling | AutoCAD dynamic blocks / ARRAY | Yes, geometry-signature fallback (pile only) | Generalized: `block_inventory.py` computes a geometry signature for **any** block, named or anonymous, and clusters matches |
| Effective/dynamic block name recovery | AutoCAD dynamic blocks | Not attempted | **Confirmed unrecoverable from DXF** (source #4) — documented rather than guessed at; no code claims to resolve it |
| ATTRIB (attached attribute values) extraction | ezdxf `Insert.attribs` | **No** | Read directly during forensic analysis (see §5.3) but never populated in either real fixture — infra ready in `block_inventory.py`/parser but nothing to surface yet from real data |
| ATTDEF (attribute templates) extraction | ezdxf `AttDef` | **No** | **Yes** — `CadBlockInfo.attribute_defs`, surfaced in `/cad/inspect` and `block_inventory.py` |
| Geometry-signature clustering | Generalizes existing `_is_symbol_block`/`_is_shaft_symbol` | Pile-detector-specific only | **Yes**, block-agnostic: `block_inventory.geometry_signature()` |
| Legend/vocabulary inference (abbreviation → meaning) | Novel, per brief | No | **Not implemented** — designed and scoped as Phase 2 below, not built this session (see "Deferred") |
| Confidence explainability (evidence list, not bare score) | Novel, per brief | No — only a `detectedBy` tag string | **Yes** — `StructuralCandidate.evidence()` / DetectionExplainer, surfaced in the API and as a tooltip in `CadAnalizi.jsx` |
| Zero vs Unknown count distinction | Novel, per brief | No — `0` meant both "confirmed zero" and "couldn't tell" | **Yes** — `status: "confirmed" \| "uncertain" \| "none_detected"`, `count: null` when uncertain |
| Text-only fallback surfaced as uncertain | Novel, prior investigation | Yes (anchor only, from the previous investigation) | Unchanged |
| Raw block/layer/entity diagnostic dump | AutoCAD DATAEXTRACTION export | Yes (`/cad/inspect`) | Extended with `blockInventory` (top 50 by weighted count) and per-block `attributeDefs` |
| Silent large-file truncation of the nested walk | Found via this session's own verification work, not a listed source technique | **No — silent, undiscovered** (a shared, document-global budget could zero out late-processed containers with zero signal) | **Yes** — surfaced as a `warnings` entry; response-warnings snapshot bug (dropped mid-detection warnings) fixed alongside it |
| Repeated-geometry / array detection for anchors specifically | Novel, per brief (§14/§15) | Partial (`_from_repeated_blocks`, block-INSERT only — no LINE-array "parallel hatch" pattern) | **Not implemented** — highest false-positive risk in the whole brief (LEADER/DIMENSION confusion, explicitly warned about in §16); deferred until a real fixture demonstrates the pattern, not built against a guessed synthetic shape |
| Spatial relationship graph | Novel, per brief (§12) | No | **Not implemented** — scoped in "Deferred" below |
| CadDetectionProfile / per-customer learning | Novel, per brief (§18) | No | **Not implemented** — architecture sketch only, in "Deferred" |

---

## 6. Recommended architecture (implemented this iteration vs. deferred)

### Implemented

1. **`block_inventory.py`** (new module) — `BlockInventory`/`RawCadInventory`
   equivalent: for every Model-Space-reachable block, top-level count,
   fully-weighted nested/physical count, entity content, ATTDEF tags,
   layers used, and geometry-signature cluster membership. Surfaced via
   `/cad/inspect` → `blockInventory` (top 50, admin/dev diagnostic per the
   brief's §25 — not shown to the end user).
2. **Attribute extraction (ATTDEF half)** — `CadBlockInfo.attribute_defs`
   in `document.py`/`parser.py`; ATTRIB (per-instance values) reading was
   built and tested (`Insert.attribs`) but there is no real evidence yet
   that any customer file populates them, so nothing downstream *depends*
   on it being non-empty — it will show up automatically in
   `block_inventory.py`'s output the day a file has it.
3. **Geometry-signature clustering**, block-agnostic (`geometry_signature()`
   in `block_inventory.py`) — the generalized form of what
   `detectors/pile.py` already does ad hoc for one shape.
4. **DetectionExplainer** — `StructuralCandidate.evidence()`, a
   human-readable evidence list built strictly from the `detected_by` tags
   a candidate already carries (never fabricated), surfaced in the API
   response and as a hover tooltip in `CadAnalizi.jsx`.
5. **Zero vs Unknown** — `status: "confirmed" | "uncertain" |
   "none_detected"` per element type, `count: null` when "uncertain"
   (weak/uncertain candidates exist but none cleared the confirmed floor).
   Both `analyzer.py` and `CadAnalizi.jsx` updated; `AnchorDetector`'s
   already-existing `_from_text_only` fallback now feeds this distinction
   naturally — an anchor-heavy file with no clean geometry signal now
   reports **"Belirlenemedi"**, never a bare "0".
6. **Nested-walk budget exhaustion is now reported, not silent** — found
   while verifying the FK65/510 count against real data (not a planned
   feature): `PileDetector`'s shared `_NESTED_MAX_VIRTUAL_ENTITIES` budget
   can run out partway through a large file's top-level container list,
   silently zeroing every container processed afterward. Now surfaced as a
   `warnings` entry; `analyzer.py`'s response-warnings snapshot was also
   moved to *after* detection runs, since it was silently dropping any
   warning a detector appended mid-detection. See
   `CAD_FORENSIC_REPORT.md` §7.3.1 for the full real-file evidence.

### Deferred (researched, scoped, not built this session — see reasoning per item)

- **LegendDetector / DrawingVocabulary with confidence-scored abbreviation
  inference** (brief §9–11) — real value, but correctness here depends on
  spatial layout heuristics ("repeated rows with a symbol + adjacent text")
  that need several *real* legend-bearing drawings to tune against without
  guessing; neither real fixture in hand has an unambiguous plan-sheet
  legend block to validate against. Building this against synthetic-only
  data risks repeating the exact mistake `CAD_FORENSIC_REPORT.md` §3
  documents (a fix that looked right and wasn't, caught only by
  cross-validating a second real file).
- **Text proximity graph as a general spatial relationship model** (§12) —
  `TextIndex`/`SpatialGrid` already give us the primitive; formalizing it
  into named edge types (`leader-target`, `same-layer`, ...) is real
  infrastructure work with no immediate detector consumer yet. Worth doing
  once LegendDetector or AnchorDetector V2's geometry-pattern work
  actually needs it.
- **AnchorDetector geometry-pattern matching** (repeated parallel
  lines/arrows radiating from the shoring boundary, §14–16) — the single
  highest false-positive-risk item in the whole brief, by the brief's own
  words (LEADER/MLEADER/DIMENSION look similar). The existing `TENDON`
  layer-keyword signal plus the `_from_text_only` uncertain-surface already
  give an honest, evidence-backed floor for anchors; a geometry-pattern
  detector needs to be built and cross-validated against a real anchor-array
  drawing, the same way the pile shaft-symbol fix was, not shipped from
  first principles.
- **CadDetectionProfile (per-customer learned aliases)** (§18) —
  architecture is straightforward to add later (a keyed override layer on
  top of `cadDetectionRules.json`, scoped by company, populated by
  confirmed/rejected user feedback) but there is no user-confirmation UI
  yet for it to learn from — building the storage layer before the input
  exists is premature.
- **Synthetic fixture suite (6 fixtures) + AutoCAD Count benchmark tests**
  (§26–28) — `test_cad_block_inventory.py` covers the core weighted-count
  and geometry-signature logic directly (equivalent ground-truth assertions
  to what the brief's fixture-1/2/5 would exercise: simple block, nested/
  anonymous block, cross-name signature match). The full 6-fixture matrix
  (mixed annotations, anchor line-symbols, pile+anchor+irrelevant-circle
  mixed file) is real, additional value but sizable test-authoring effort;
  deferred rather than rushed to keep what *is* checked in fully correct.
- **MLeader vs LEADER vs anchor disambiguation** (§16) — not attempted
  without a real anchor-arrow drawing to validate against, same reasoning
  as AnchorDetector geometry-pattern matching above.
- **Machine learning phase** — see §4. Not justified yet.

---

## 7. Turkish + English shoring/pile/anchor CAD vocabulary

Compiled from source #10 (İTKİB İksa-Fore Kazık şartnamesi, Turkish
geotechnical design-note sources, English tieback/secant-pile references)
plus terms already load-bearing in this codebase's own
`cadDetectionRules.json` and `CAD_FORENSIC_REPORT.md`. **Not treated as
universal** — recorded as the vocabulary basis for `cadDetectionRules.json`
and any future DrawingVocabulary work, explicitly not hard-coded as
detector logic beyond what already lives in the rules file.

| Turkish | English | Notes |
|---|---|---|
| Fore kazık | Bored pile | Drilled, then reinforced/concreted — GeoDrill's core pile type |
| İksa kazığı | Shoring/retaining pile | Generic — a fore kazık used as part of an İksa (shoring) wall |
| Teğet kazık | Contiguous pile | Piles placed edge-to-edge, small gap |
| Sekant kazık | Secant pile | Overlapping piles, alternise primary/secondary |
| Mini kazık | Micropile / mini-pile | Small-diameter — already a distinct GeoDrill equipment type |
| Zemin ankrajı | Ground anchor | Generic anchor term |
| Öngermeli ankraj | Prestressed anchor | Tensioned tieback |
| Kök boyu | (Anchor) bond/root length | The grouted length that transfers load to soil |
| Serbest boy | Free length | The un-bonded tendon length between wall and bond zone |
| Ankraj kafası | Anchor head | The wall-face bearing plate/lock-off assembly |
| Ankraj boyu | Anchor length (general) | Already a `cadDetectionRules.json` text keyword |
| Tendon / çelik halat | Tendon / strand | Confirmed real geometry signal in both fixtures (`TENDON` layer) |
| (n/a — soldier pile is a distinct US technique) | Soldier pile | Steel H-piles + lagging; not a GeoDrill fore-kazık equivalent, noted for future international support |
| (n/a) | Tieback | US/UK synonym for zemin ankrajı |

---

*Research and forensic analysis performed 2026-09-03. See
`CAD_FORENSIC_REPORT.md` for the FK65/521/anchor findings this research
directly grounded.*
