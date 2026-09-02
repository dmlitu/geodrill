from modules.cad.candidates import StructuralCandidate
from modules.cad.duplicate_resolver import resolve_duplicates


def _c(x, y, confidence, detected_by, cid="c", handle="h"):
    return StructuralCandidate(
        id="", element_type="pile", x=x, y=y, layer="L", entity_type="CIRCLE",
        confidence=confidence, confidence_band="HIGH" if confidence >= 0.85 else "MEDIUM",
        detected_by=list(detected_by), source_handles=[handle],
    )


def test_identical_coordinates_merge_into_one():
    cands = [_c(0, 0, 0.95, ["layer", "geometry"], handle="a"), _c(0, 0, 0.85, ["block"], handle="b")]
    out = resolve_duplicates(cands, tolerance=0.15)
    assert len(out) == 1
    assert set(out[0].detected_by) == {"layer", "geometry", "block"}
    assert set(out[0].source_handles) == {"a", "b"}


def test_far_apart_coordinates_are_not_merged():
    cands = [_c(0, 0, 0.9, ["layer"]), _c(100, 100, 0.9, ["layer"])]
    out = resolve_duplicates(cands, tolerance=0.15)
    assert len(out) == 2


def test_merge_keeps_highest_confidence():
    cands = [_c(0, 0, 0.99, ["block", "layer", "geometry"]), _c(0.01, 0.01, 0.45, ["geometry"])]
    out = resolve_duplicates(cands, tolerance=0.15)
    assert len(out) == 1
    assert out[0].confidence == 0.99


def test_merge_within_tolerance_boundary():
    cands = [_c(0, 0, 0.9, ["layer"]), _c(0.1, 0, 0.9, ["layer"])]  # 0.1 < tolerance 0.15
    out = resolve_duplicates(cands, tolerance=0.15)
    assert len(out) == 1


def test_empty_input():
    assert resolve_duplicates([], tolerance=0.15) == []


def test_three_way_merge_unions_all_evidence():
    cands = [
        _c(0, 0, 0.99, ["block", "layer", "geometry"], handle="a"),
        _c(0.02, 0.0, 0.80, ["block"], handle="b"),
        _c(0.0, 0.03, 0.45, ["geometry"], handle="c"),
    ]
    out = resolve_duplicates(cands, tolerance=0.15)
    assert len(out) == 1
    assert out[0].merged_from == 3
    assert set(out[0].source_handles) == {"a", "b", "c"}
