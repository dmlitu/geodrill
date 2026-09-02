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
    entities = [_circle("KAZIKCEPHE", i * 10, 0, 40.0, handle=f"h{i}") for i in range(10)]
    doc = _doc(entities)
    cands = PileDetector().detect(doc, rules, TextIndex(doc))
    assert cands == []  # 'CEPHE' (elevation view) is an exclude keyword despite containing 'KAZIK'


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
