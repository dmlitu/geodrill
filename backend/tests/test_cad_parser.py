"""CadParser tests: security/validation, corrupted-file recovery, model vs.
paper space, unknown entity handling."""
import io

import ezdxf
import pytest

from modules.cad.parser import CadParseError, CadParser
from modules.cad.security import CadUploadError, validate_upload


def _dxf_bytes(build_fn=None) -> bytes:
    doc = ezdxf.new("R2018")
    if build_fn:
        build_fn(doc)
    buf = io.StringIO()
    doc.write(buf)
    return buf.getvalue().encode("utf-8")


# ── security.validate_upload ────────────────────────────────────────────

def test_validate_upload_rejects_bad_extension():
    with pytest.raises(CadUploadError):
        validate_upload("drawing.pdf", b"whatever")


def test_validate_upload_rejects_dwg_without_magic_bytes():
    with pytest.raises(CadUploadError):
        validate_upload("drawing.dwg", b"not a real dwg file" * 10)


def test_validate_upload_accepts_real_dwg_signature():
    fake_dwg = b"AC1032" + b"\x00" * 100
    assert validate_upload("drawing.dwg", fake_dwg) == "dwg"


def test_validate_upload_rejects_oversized_file(monkeypatch):
    import modules.cad.security as sec
    monkeypatch.setattr(sec, "MAX_UPLOAD_BYTES", 100)
    with pytest.raises(CadUploadError):
        validate_upload("drawing.dxf", b"0\nSECTION\n" + b"x" * 200)


# ── CadParser: empty / minimal CAD ──────────────────────────────────────

def test_parse_empty_cad_document():
    data = _dxf_bytes()
    doc = CadParser().parse(data, "empty.dxf")
    assert doc.model_space_entities == []
    assert doc.units in ("mm", "cm", "m", "unknown", "in", "ft")


def test_parse_rejects_non_cad_content():
    with pytest.raises(CadParseError):
        CadParser().parse(b"hello, this is not a CAD file at all", "notes.dxf")


# ── ModelSpace vs PaperSpace ─────────────────────────────────────────────

def test_modelspace_and_paperspace_are_kept_separate():
    def build(doc):
        msp = doc.modelspace()
        for _ in range(3):
            msp.add_circle((0, 0), radius=1.0, dxfattribs={"layer": "KAZIK"})
        psp = doc.layout("Layout1")
        psp.add_circle((0, 0), radius=1.0, dxfattribs={"layer": "KAZIK"})  # a legend/viewport symbol, not a pile

    doc = CadParser().parse(_dxf_bytes(build), "layouts.dxf")
    assert len(doc.model_space_entities) == 3
    assert any(p.total >= 1 for p in doc.paper_space_layouts)


# ── Unknown / unsupported entity handling ───────────────────────────────

def test_unknown_entity_type_does_not_crash_parser():
    def build(doc):
        msp = doc.modelspace()
        msp.add_circle((0, 0), radius=1.0, dxfattribs={"layer": "KAZIK"})
        msp.add_spline([(0, 0), (1, 1), (2, 0)], dxfattribs={"layer": "MISC"})  # not specially handled
        msp.add_point((5, 5), dxfattribs={"layer": "MISC"})

    doc = CadParser().parse(_dxf_bytes(build), "mixed.dxf")
    types = {e.entity_type for e in doc.model_space_entities}
    assert "CIRCLE" in types
    assert "SPLINE" in types  # counted, even though we don't geometrically analyze it
    assert "POINT" in types


# ── Corrupted-file recovery ──────────────────────────────────────────────

def test_corrupted_entity_is_dropped_and_warned_not_crashed():
    def build(doc):
        msp = doc.modelspace()
        for _ in range(3):
            msp.add_circle((0, 0), radius=1.0, dxfattribs={"layer": "KAZIK"})

    text = _dxf_bytes(build).decode("utf-8")
    # Corrupt one CIRCLE's radius (group code 40) to an unparseable value,
    # simulating a converter that garbled one entity but left the rest intact.
    # Must target a CIRCLE inside ENTITIES specifically — group code 40 is
    # reused by several unrelated $-prefixed HEADER variables too.
    lines = text.splitlines()
    circle_idx = next(i for i, line in enumerate(lines) if line.strip() == "CIRCLE")
    for i in range(circle_idx, len(lines) - 1):
        if lines[i].strip() == "40":
            lines[i + 1] = ""  # blank out the radius value
            break
    corrupted = ("\n".join(lines) + "\n").encode("utf-8")

    doc = CadParser().parse(corrupted, "corrupted.dxf")
    assert doc.warnings, "expected a warning about the repaired entity"
    assert len(doc.model_space_entities) < 3  # the corrupted CIRCLE was dropped, not crashed on


def test_completely_unparseable_file_raises_clean_error_not_crash():
    garbage = b"\x00\x01\x02\x03" * 500
    with pytest.raises(CadParseError):
        CadParser().parse(garbage, "garbage.dxf")
