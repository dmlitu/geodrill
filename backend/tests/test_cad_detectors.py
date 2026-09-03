"""PileDetector / AnchorDetector unit tests, built against hand-constructed
CadDocument instances (no ezdxf I/O needed for these) plus a real ezdxf
document for the nested-block cases, which need genuine INSERT/virtual_entities
transform support."""
import io

import ezdxf
import pytest

from modules.cad.detectors.anchor import AnchorDetector
from modules.cad.detectors.pile import PileDetector
from modules.cad.document import CadBlockInfo, CadDocument, CadEntity, CadPoint
from modules.cad.rules import load_rules
from modules.cad.text_analyzer import TextIndex


def _doc(entities, blocks=None, units="cm") -> CadDocument:
    d = CadDocument(filename="t.dxf", dxf_version="AC1032", units=units, unit_source="header")
    d.model_space_entities = entities
    if blocks:
        d.blocks = blocks
    return d


def _circle(layer, x, y, r, handle="h1"):
    return CadEntity(handle=handle, entity_type="CIRCLE", layer=layer, point=CadPoint(x, y), radius=r)


def _insert(layer, block_name, x, y, handle="h1"):
    return CadEntity(handle=handle, entity_type="INSERT", layer=layer, point=CadPoint(x, y), block_name=block_name)


# ── Circle candidate classification ─────────────────────────────────────

def test_bare_circles_on_keyword_layer_are_high_confidence_piles():
    rules = load_rules()
    entities = [_circle("FORE_KAZIK", i * 10, 0, 40.0, handle=f"h{i}") for i in range(6)]
    doc = _doc(entities)
    cands = PileDetector().detect(doc, rules, TextIndex(doc))
    assert len(cands) == 6
    assert all(c.confidence_band == "HIGH" for c in cands)
    assert all("layer" in c.detected_by and "geometry" in c.detected_by for c in cands)


def test_bare_circles_on_unrelated_layer_below_threshold_are_not_candidates():
    rules = load_rules()
    entities = [_circle("SU KANALIZASYON", i * 10, 0, 40.0, handle=f"h{i}") for i in range(3)]
    doc = _doc(entities)
    cands = PileDetector().detect(doc, rules, TextIndex(doc))
    assert cands == []  # below pile_min_repeat_count and no keyword signal


def test_bare_circles_on_unrelated_layer_above_threshold_are_low_confidence_only():
    rules = load_rules()
    entities = [_circle("SU KANALIZASYON", i * 10, 0, 40.0, handle=f"h{i}") for i in range(8)]
    doc = _doc(entities)
    cands = PileDetector().detect(doc, rules, TextIndex(doc))
    assert len(cands) == 8
    assert all(c.confidence_band == "LOW" for c in cands)  # geometry-only fallback, no keyword


def test_closed_polyline_alone_never_triggers_geometry_only_fallback():
    """A closed LWPOLYLINE is too generic a shape (logos, hatch boundaries,
    title-block symbols) to mean anything with zero keyword signal."""
    rules = load_rules()
    entities = [
        CadEntity(handle=f"h{i}", entity_type="LWPOLYLINE", layer="DNY_LOGO",
                   point=CadPoint(i, 0), closed=True)
        for i in range(10)
    ]
    doc = _doc(entities)
    cands = PileDetector().detect(doc, rules, TextIndex(doc))
    assert cands == []


def test_numeric_layer_diameter_heuristic_is_low_confidence():
    rules = load_rules()
    entities = [_circle("65", i * 100, 0, 32.5, handle=f"h{i}") for i in range(6)]
    doc = _doc(entities)
    cands = PileDetector().detect(doc, rules, TextIndex(doc))
    assert len(cands) == 6
    assert all(c.confidence_band == "LOW" for c in cands)
    assert all("numeric-layer" in c.detected_by for c in cands)


def test_numeric_layer_with_inconsistent_radii_is_rejected():
    rules = load_rules()
    entities = [_circle("65", i * 100, 0, 10.0 + i * 5, handle=f"h{i}") for i in range(6)]
    doc = _doc(entities)
    cands = PileDetector().detect(doc, rules, TextIndex(doc))
    assert cands == []  # radii too inconsistent to read as one diameter class


def test_excluded_layer_never_produces_pile_candidates():
    rules = load_rules()
    # 'KESIT' (cross-section detail) is genuinely excluded — a detail view
    # is a single zoomed-in example, not a repeated row of real positions.
    entities = [_circle("KAZIKKESIT", i * 10, 0, 40.0, handle=f"h{i}") for i in range(10)]
    doc = _doc(entities)
    cands = PileDetector().detect(doc, rules, TextIndex(doc))
    assert cands == []


def test_cephe_layer_is_not_excluded():
    """'CEPHE' (elevation/facade view) was excluded in an earlier version
    on the theory that an elevation view can't show real plan positions —
    but real production drawings (see backend/tests/fixtures/cad/) turned
    out to use a pile-elevation view (layer 'KAZIKCEPHE') as the *only*
    representation of an entire pile row, each pile shown at its own X
    position along the wall. Confirmed via forensic analysis of both real
    fixtures before this test was written — see git history for
    detectors/pile.py's shaft-symbol detection."""
    rules = load_rules()
    entities = [_circle("KAZIKCEPHE", i * 10, 0, 40.0, handle=f"h{i}") for i in range(10)]
    doc = _doc(entities)
    cands = PileDetector().detect(doc, rules, TextIndex(doc))
    assert len(cands) == 10
    assert all(c.confidence_band == "HIGH" for c in cands)


# ── Block classification ────────────────────────────────────────────────

def test_pile_block_insert_is_classified_with_high_confidence():
    rules = load_rules()
    block = CadBlockInfo(name="KAZIK_D80", entity_type_counts={"CIRCLE": 1, "LINE": 1}, insert_count=3)
    entities = [_insert("FORE_KAZIK", "KAZIK_D80", i * 5, 0, handle=f"h{i}") for i in range(3)]
    doc = _doc(entities, blocks={"KAZIK_D80": block})
    cands = PileDetector().detect(doc, rules, TextIndex(doc))
    assert len(cands) == 3
    assert all(c.confidence_band == "HIGH" for c in cands)
    assert all(c.block_name == "KAZIK_D80" for c in cands)


def test_non_pile_block_is_never_a_candidate():
    rules = load_rules()
    block = CadBlockInfo(name="AGACLANDIRMA", entity_type_counts={"CIRCLE": 1}, insert_count=20)
    entities = [_insert("PEYZAJ", "AGACLANDIRMA", i, 0, handle=f"h{i}") for i in range(20)]
    doc = _doc(entities, blocks={"AGACLANDIRMA": block})
    cands = PileDetector().detect(doc, rules, TextIndex(doc))
    assert cands == []


def test_block_and_internal_geometry_never_double_counted():
    """A pile block's own INSERTs must be the only source of candidates —
    its member CIRCLE must never also surface via bare-geometry scanning,
    because block-definition geometry is never part of model_space_entities."""
    rules = load_rules()
    block = CadBlockInfo(name="KAZIK_D80", entity_type_counts={"CIRCLE": 1}, insert_count=5)
    entities = [_insert("0", "KAZIK_D80", i * 5, 0, handle=f"h{i}") for i in range(5)]
    doc = _doc(entities, blocks={"KAZIK_D80": block})
    cands = PileDetector().detect(doc, rules, TextIndex(doc))
    assert len(cands) == 5
    assert all(c.entity_type == "INSERT" for c in cands)


# ── Anchor block classification ─────────────────────────────────────────

def test_anchor_block_insert_is_classified():
    rules = load_rules()
    block = CadBlockInfo(name="ANKRAJ_TIP1", entity_type_counts={"LINE": 2, "CIRCLE": 1}, insert_count=4)
    entities = [_insert("IKSA_ANKRAJI", "ANKRAJ_TIP1", i * 3, 0, handle=f"h{i}") for i in range(4)]
    doc = _doc(entities, blocks={"ANKRAJ_TIP1": block})
    cands = AnchorDetector().detect(doc, rules, TextIndex(doc))
    assert len(cands) == 4
    assert all(c.element_type == "anchor" for c in cands)
    assert all(c.confidence_band == "HIGH" for c in cands)  # block + layer both hit


def test_ambiguous_generic_block_name_alone_is_not_promoted_to_high_confidence():
    """A block that only vaguely matches ('TIE ROD' as a layer-only signal,
    not a block keyword) must not silently become a confident anchor count —
    see detectors/anchor.py module docstring."""
    rules = load_rules()
    assert "TIE ROD" not in rules.anchor_block_keywords


def test_anchor_multi_primitive_symbol_collapses_to_one_candidate():
    """LINE + LINE + CIRCLE anchor head symbol, drawn as loose primitives on
    a keyword-matched layer, must produce exactly one AnchorCandidate."""
    rules = load_rules()
    entities = [
        CadEntity(handle="l1", entity_type="LINE", layer="ANKRAJ", point=CadPoint(0, 0)),
        CadEntity(handle="l2", entity_type="LINE", layer="ANKRAJ", point=CadPoint(0.02, 0.01)),
        CadEntity(handle="c1", entity_type="CIRCLE", layer="ANKRAJ", point=CadPoint(0.01, 0.0), radius=5.0),
    ]
    doc = _doc(entities, units="cm")
    cands = AnchorDetector().detect(doc, rules, TextIndex(doc))
    assert len(cands) == 1
    assert set(cands[0].source_handles) == {"l1", "l2", "c1"}


# ── Repeated-block + text-corroboration fallback (unnamed anchor blocks) ─
# Forensic finding (see CAD_FORENSIC_REPORT.md): real production drawings
# abbreviate 'ankraj' unpredictably ('CEPANK', 'ILAAVEANK', 'KARSI ANKK')
# with no keyword-matching name or layer — but the block still repeats
# along the wall and the drawing's own text annotations ('1.SIRA ANKRAJ
# KOTU') corroborate it. See detectors/anchor.py's `_from_repeated_blocks`.

def _text(layer, x, y, text, handle="t1"):
    return CadEntity(handle=handle, entity_type="TEXT", layer=layer, point=CadPoint(x, y), text=text)


def test_repeated_unnamed_anchor_block_promoted_via_text_corroboration():
    rules = load_rules()
    block = CadBlockInfo(name="GRUP7", entity_type_counts={"LINE": 2, "HATCH": 1}, insert_count=6)
    entities = [_insert("MISC", "GRUP7", i * 300, 0, handle=f"h{i}") for i in range(6)]
    # 4/6 (a majority) have 'ANKRAJ'-family text nearby; the other 2 don't.
    texts = [_text("MISC", i * 300 + 5, 0, "1.SIRA ANKRAJ KOTU", handle=f"tx{i}") for i in range(4)]
    doc = _doc(entities, blocks={"GRUP7": block})
    doc.texts = texts
    cands = AnchorDetector().detect(doc, rules, TextIndex(doc))
    assert len(cands) == 6
    assert all(c.element_type == "anchor" for c in cands)
    assert all("block" in c.detected_by and "repetition" in c.detected_by for c in cands)
    assert all(c.confidence_band == "MEDIUM" for c in cands)  # never HIGH off text alone


def test_empty_marker_block_never_promoted_by_text_alone():
    """Regression test: a purely empty block definition (no LINE/CIRCLE/
    HATCH inside it — a generic leader/attribute point, the same glyph a
    coordinate table reuses for every row type) must never be promoted
    just because text happens to sit nearby. Confirmed via a real
    production file where block 'KOTKESITICIN' on layer 'XYZTABLO' (a
    coordinate table, not a drawing of anchors) produced ~700
    false-positive candidates before this gate was added — see
    detectors/anchor.py's `_from_repeated_blocks`."""
    rules = load_rules()
    block = CadBlockInfo(name="KOTKESITICIN", entity_type_counts={}, insert_count=6)
    entities = [_insert("XYZTABLO", "KOTKESITICIN", i * 300, 0, handle=f"h{i}") for i in range(6)]
    texts = [_text("XYZTABLO", i * 300 + 5, 0, "1.SIRA ANKRAJ KOTU", handle=f"tx{i}") for i in range(6)]
    doc = _doc(entities, blocks={"KOTKESITICIN": block})
    doc.texts = texts
    cands = AnchorDetector().detect(doc, rules, TextIndex(doc))
    assert cands == []


def test_repeated_unnamed_block_below_corroboration_majority_not_promoted():
    """Real geometry and real repetition, but only a minority of instances
    have anchor text nearby — a couple of coincidental hits (e.g. a
    generic elevation-leader block that happens to sit near an anchor
    label once or twice) isn't enough to promote the whole group."""
    rules = load_rules()
    block = CadBlockInfo(name="KOTKESIT", entity_type_counts={"LINE": 1}, insert_count=6)
    entities = [_insert("MISC", "KOTKESIT", i * 300, 0, handle=f"h{i}") for i in range(6)]
    texts = [_text("MISC", i * 300 + 5, 0, "1.SIRA ANKRAJ KOTU", handle=f"tx{i}") for i in range(2)]
    doc = _doc(entities, blocks={"KOTKESIT": block})
    doc.texts = texts
    cands = AnchorDetector().detect(doc, rules, TextIndex(doc))
    assert cands == []


# ── Nested block (needs a real ezdxf document for virtual_entities) ─────

def _real_dxf_bytes(build_fn) -> bytes:
    doc = ezdxf.new("R2018")
    build_fn(doc)
    buf = io.StringIO()
    doc.write(buf)
    return buf.getvalue().encode("utf-8")


def _build_nested_pile_doc():
    """A pile block ('KAZIK_D65') that only ever appears *inside* a
    container block ('GRID_BLOK'), never directly in modelspace — this is
    only detectable via the nested-block walk."""
    from modules.cad.parser import CadParser

    def build(ez_doc):
        pile_block = ez_doc.blocks.new(name="KAZIK_D65")
        pile_block.add_circle((0, 0), radius=32.5, dxfattribs={"layer": "0"})

        container = ez_doc.blocks.new(name="GRID_BLOK")
        for i in range(4):
            container.add_blockref("KAZIK_D65", (i * 100, 0), dxfattribs={"layer": "65K"})

        msp = ez_doc.modelspace()
        msp.add_blockref("GRID_BLOK", (0, 0), dxfattribs={"layer": "0"})

    return CadParser().parse(_real_dxf_bytes(build), "nested.dxf")


def test_nested_pile_block_is_detected_through_container():
    rules = load_rules()
    doc = _build_nested_pile_doc()
    cands = PileDetector().detect(doc, rules, TextIndex(doc))
    nested = [c for c in cands if "nested" in c.detected_by]
    assert len(nested) == 4
    assert all(c.block_name == "KAZIK_D65" for c in nested)


def test_nested_pile_block_world_coordinates_follow_container_insertion():
    rules = load_rules()
    doc = _build_nested_pile_doc()
    cands = [c for c in PileDetector().detect(doc, rules, TextIndex(doc)) if "nested" in c.detected_by]
    xs = sorted(c.x for c in cands)
    assert xs == pytest.approx([0.0, 100.0, 200.0, 300.0])


def test_parent_container_claimed_block_not_double_walked():
    """If the CONTAINER itself is directly a pile-keyword block placed in
    modelspace, its own INSERT candidate must be produced once by
    `_from_blocks` and its internals must never also be walked by the
    nested pass (which explicitly skips any block already in
    `claimed_blocks`)."""
    from modules.cad.parser import CadParser

    def build(ez_doc):
        inner = ez_doc.blocks.new(name="SOME_SYMBOL")
        inner.add_circle((0, 0), radius=10.0, dxfattribs={"layer": "0"})

        pile_container = ez_doc.blocks.new(name="KAZIK_GRUBU")  # matches 'KAZIK' itself
        pile_container.add_blockref("SOME_SYMBOL", (0, 0), dxfattribs={"layer": "0"})

        msp = ez_doc.modelspace()
        msp.add_blockref("KAZIK_GRUBU", (500, 500), dxfattribs={"layer": "FORE_KAZIK"})

    doc = CadParser().parse(_real_dxf_bytes(build), "claimed.dxf")
    rules = load_rules()
    cands = PileDetector().detect(doc, rules, TextIndex(doc))
    # Exactly one candidate — the KAZIK_GRUBU insert itself — never a second
    # one manufactured from its SOME_SYMBOL child.
    assert len(cands) == 1
    assert cands[0].block_name == "KAZIK_GRUBU"


# ── Anonymous/array-generated leaf blocks (shaft-symbol geometry) ───────

def test_shaft_symbol_detected_via_layer_and_geometry_no_name_match():
    """A pile drawn in elevation/cross-section is conventionally a pair of
    parallel lines (its two edges) rather than a circle — and when it's an
    AutoCAD ARRAY-generated item, the leaf block name is meaningless
    ('*U78'). Classification must fall back to layer + geometry alone."""
    from modules.cad.parser import CadParser

    def build(ez_doc):
        ez_doc.header["$INSUNITS"] = 5  # centimeters — matches the coordinates below (65cm shaft width)
        # Anonymous-style name on purpose — mirrors what an ARRAY produces.
        shaft = ez_doc.blocks.new(name="*SHAFT1")
        shaft.add_line((32.5, -175), (32.5, -50), dxfattribs={"layer": "0"})
        shaft.add_line((32.5, 30), (32.5, 185), dxfattribs={"layer": "0"})
        shaft.add_line((-32.5, -175), (-32.5, -50), dxfattribs={"layer": "0"})
        shaft.add_line((-32.5, 30), (-32.5, 185), dxfattribs={"layer": "0"})

        container = ez_doc.blocks.new(name="*ARRAY1")
        for i in range(6):
            container.add_blockref("*SHAFT1", (i * 90, 0), dxfattribs={"layer": "KAZIKCEPHE"})

        msp = ez_doc.modelspace()
        msp.add_blockref("*ARRAY1", (0, 0), dxfattribs={"layer": "KAZIKCEPHE"})

    doc = CadParser().parse(_real_dxf_bytes(build), "shaft.dxf")
    rules = load_rules()
    cands = PileDetector().detect(doc, rules, TextIndex(doc))
    shaft_cands = [c for c in cands if "shaft-symbol" in c.detected_by]
    assert len(shaft_cands) == 6
    assert all(c.confidence_band in ("HIGH", "MEDIUM") for c in shaft_cands)
    xs = sorted(c.x for c in shaft_cands)
    assert xs == pytest.approx([0.0, 90.0, 180.0, 270.0, 360.0, 450.0])


def test_shaft_symbol_ignored_without_layer_corroboration():
    """The same geometry, on a layer with no pile-keyword signal, must NOT
    be promoted — geometry alone on an anonymous block is too weak."""
    from modules.cad.parser import CadParser

    def build(ez_doc):
        shaft = ez_doc.blocks.new(name="*SHAFT1")
        shaft.add_line((32.5, -175), (32.5, -50), dxfattribs={"layer": "0"})
        shaft.add_line((-32.5, -175), (-32.5, -50), dxfattribs={"layer": "0"})

        container = ez_doc.blocks.new(name="*ARRAY1")
        for i in range(6):
            container.add_blockref("*SHAFT1", (i * 90, 0), dxfattribs={"layer": "UNRELATED_LAYER"})

        msp = ez_doc.modelspace()
        msp.add_blockref("*ARRAY1", (0, 0), dxfattribs={"layer": "UNRELATED_LAYER"})

    doc = CadParser().parse(_real_dxf_bytes(build), "shaft2.dxf")
    rules = load_rules()
    cands = PileDetector().detect(doc, rules, TextIndex(doc))
    assert not any("shaft-symbol" in c.detected_by for c in cands)


def test_nested_leaf_layer_fallback_to_root_container_layer(monkeypatch):
    """Regression test for a real bug found via forensic analysis of a
    production file: ezdxf's virtual_entities() does not reliably carry a
    per-item layer override through a large AutoCAD associative ARRAY —
    only some array copies kept their own layer, the rest defaulted to
    '0'. Simulate that here by forcing every OTHER nested INSERT's layer
    attribute to '0' after the fact, and verify the top-level container's
    own layer is used as a fallback so none of them are silently dropped."""
    import modules.cad.detectors.pile as pile_mod

    real_layer_signal = pile_mod._layer_signal
    call_layers = []

    def spy(layer, rules):
        call_layers.append(layer)
        return real_layer_signal(layer, rules)

    monkeypatch.setattr(pile_mod, "_layer_signal", spy)

    from modules.cad.parser import CadParser

    def build(ez_doc):
        pile_block = ez_doc.blocks.new(name="KAZIK_D65")
        pile_block.add_circle((0, 0), radius=32.5, dxfattribs={"layer": "0"})

        container = ez_doc.blocks.new(name="GRID_BLOK")
        for i in range(6):
            # Half the array items keep the real layer, half default to
            # "0" — matching the observed real-world ezdxf behavior.
            layer = "KAZIKCEPHE" if i % 2 == 0 else "0"
            container.add_blockref("KAZIK_D65", (i * 100, 0), dxfattribs={"layer": layer})

        msp = ez_doc.modelspace()
        msp.add_blockref("GRID_BLOK", (0, 0), dxfattribs={"layer": "KAZIKCEPHE"})

    doc = CadParser().parse(_real_dxf_bytes(build), "fallback.dxf")
    rules = load_rules()
    cands = PileDetector().detect(doc, rules, TextIndex(doc))
    nested = [c for c in cands if "nested" in c.detected_by and c.block_name == "KAZIK_D65"]
    assert len(nested) == 6  # all 6, not just the 3 that kept their own layer
    assert all(c.confidence_band == "HIGH" for c in nested)  # layer+geometry both hit, thanks to the fallback


def test_recursion_reaches_pile_block_through_mixed_non_pure_container():
    """Regression test: an intermediate container that mixes real
    geometry (a LINE, standing in for stray annotation/dimension content)
    alongside a nested INSERT must not block recursion into that INSERT —
    on a real production file, gating recursion on "this container's
    children are 100% INSERT" silently missed a second, independent pile
    array reachable only through a mixed container, undercounting real
    piles by hundreds."""
    from modules.cad.parser import CadParser

    def build(ez_doc):
        pile_block = ez_doc.blocks.new(name="KAZIK_D65")
        pile_block.add_circle((0, 0), radius=32.5, dxfattribs={"layer": "0"})

        # A "mixed" intermediate container: some unrelated geometry PLUS
        # nested pile INSERTs — not a pure INSERT-only container.
        mixed = ez_doc.blocks.new(name="MIXED_GROUP")
        mixed.add_line((0, 0), (10, 10), dxfattribs={"layer": "0"})  # stray annotation-like geometry
        for i in range(5):
            mixed.add_blockref("KAZIK_D65", (i * 100, 0), dxfattribs={"layer": "65K"})

        msp = ez_doc.modelspace()
        msp.add_blockref("MIXED_GROUP", (0, 0), dxfattribs={"layer": "0"})

    doc = CadParser().parse(_real_dxf_bytes(build), "mixed.dxf")
    rules = load_rules()
    cands = PileDetector().detect(doc, rules, TextIndex(doc))
    nested = [c for c in cands if c.block_name == "KAZIK_D65"]
    assert len(nested) == 5
