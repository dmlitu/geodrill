"""BlockInventory: weighted physical-occurrence counting, ATTDEF attribute
extraction, and geometry-signature clustering, built against real ezdxf
documents (this module walks doc.ezdxf_doc directly, same as the nested-block
detector tests)."""
import io

import ezdxf
import pytest

from modules.cad.block_inventory import build_block_inventory, compute_weighted_occurrences, geometry_signature
from modules.cad.parser import CadParser


def _real_dxf_bytes(build_fn) -> bytes:
    doc = ezdxf.new("R2018")
    build_fn(doc)
    buf = io.StringIO()
    doc.write(buf)
    return buf.getvalue().encode("utf-8")


def test_weighted_occurrences_multiply_through_nesting_levels():
    """A leaf block nested inside a container that is itself placed 3 times
    in modelspace, where the container holds 4 copies of the leaf, must
    total 12 — not 4 (nested-only) and not 3 (container count alone)."""
    def build(ez_doc):
        leaf = ez_doc.blocks.new(name="LEAF")
        leaf.add_circle((0, 0), radius=10.0, dxfattribs={"layer": "0"})

        container = ez_doc.blocks.new(name="CONTAINER")
        for i in range(4):
            container.add_blockref("LEAF", (i * 10, 0), dxfattribs={"layer": "0"})

        msp = ez_doc.modelspace()
        for i in range(3):
            msp.add_blockref("CONTAINER", (i * 100, 0), dxfattribs={"layer": "0"})

    doc = CadParser().parse(_real_dxf_bytes(build), "weighted.dxf")
    totals = compute_weighted_occurrences(doc)
    assert totals["CONTAINER"] == 3
    assert totals["LEAF"] == 12


def test_block_inventory_splits_top_level_from_nested_only():
    """FK65-shaped case: a block with ZERO top-level modelspace INSERTs,
    reachable only through one nesting level, must still show up with the
    right total and an explicit nested_only_count — this is the exact
    "does the count include phantom top-level inserts" question the real
    production forensic investigation needed answered by hand."""
    def build(ez_doc):
        pile = ez_doc.blocks.new(name="FK65")
        pile.add_circle((0, 0), radius=32.5, dxfattribs={"layer": "0"})

        container = ez_doc.blocks.new(name="GRID_BLOK")
        for i in range(5):
            container.add_blockref("FK65", (i * 100, 0), dxfattribs={"layer": "65K"})

        msp = ez_doc.modelspace()
        msp.add_blockref("GRID_BLOK", (0, 0), dxfattribs={"layer": "0"})

    doc = CadParser().parse(_real_dxf_bytes(build), "inventory.dxf")
    entries = {e.name: e for e in build_block_inventory(doc)}
    fk65 = entries["FK65"]
    assert fk65.top_level_count == 0
    assert fk65.total_physical_count == 5
    assert fk65.nested_only_count == 5


def test_block_inventory_captures_attdef_attribute_template():
    def build(ez_doc):
        pile = ez_doc.blocks.new(name="FK65")
        pile.add_circle((0, 0), radius=32.5, dxfattribs={"layer": "0"})
        pile.add_attdef(tag="DIA", text="65", dxfattribs={"layer": "0"})

        msp = ez_doc.modelspace()
        msp.add_blockref("FK65", (0, 0), dxfattribs={"layer": "65K"})

    doc = CadParser().parse(_real_dxf_bytes(build), "attdef.dxf")
    entries = {e.name: e for e in build_block_inventory(doc)}
    assert entries["FK65"].attribute_defs == ["DIA"]
    # also surfaced on the plain CadBlockInfo catalog used by /cad/inspect
    assert doc.blocks["FK65"].attribute_defs == ["DIA"]


def test_geometry_signature_ignores_name_and_position_but_not_shape():
    """Two visually-identical blocks under different names (a named block
    and an anonymous/array-style name) must share a signature; a
    differently-shaped block must not."""
    def build(ez_doc):
        a = ez_doc.blocks.new(name="FK65")
        a.add_circle((0, 0), radius=32.5, dxfattribs={"layer": "0"})

        b = ez_doc.blocks.new(name="*U99")
        b.add_circle((500, 500), radius=32.5, dxfattribs={"layer": "0"})  # same shape, different position

        c = ez_doc.blocks.new(name="OTHER")
        c.add_circle((0, 0), radius=12.5, dxfattribs={"layer": "0"})  # different radius

        msp = ez_doc.modelspace()
        msp.add_blockref("FK65", (0, 0), dxfattribs={"layer": "0"})
        msp.add_blockref("*U99", (0, 0), dxfattribs={"layer": "0"})
        msp.add_blockref("OTHER", (0, 0), dxfattribs={"layer": "0"})

    doc = CadParser().parse(_real_dxf_bytes(build), "signature.dxf")
    sig_a = geometry_signature(doc.ezdxf_doc.blocks.get("FK65"))
    sig_b = geometry_signature(doc.ezdxf_doc.blocks.get("*U99"))
    sig_c = geometry_signature(doc.ezdxf_doc.blocks.get("OTHER"))
    assert sig_a == sig_b
    assert sig_a != sig_c

    entries = {e.name: e for e in build_block_inventory(doc)}
    assert entries["FK65"].signature_group is not None
    assert entries["FK65"].signature_group == entries["*U99"].signature_group
    assert entries["*U99"].name in entries["FK65"].signature_group_members
    assert entries["OTHER"].signature_group is None
