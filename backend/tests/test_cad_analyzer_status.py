"""Zero vs Unknown (CAD_RESEARCH.md #23/#24): a confirmed 0 and "found
evidence but couldn't confirm it" must never collapse into the same
API shape. Exercised against CadAnalyzer directly with stub detectors so
each of the three outcomes is isolated from real detector logic."""
from modules.cad.analyzer import CadAnalyzer
from modules.cad.candidates import StructuralCandidate
from modules.cad.document import CadDocument
from modules.cad.rules import load_rules

_EMPTY_DXF = """0
SECTION
2
ENTITIES
0
ENDSEC
0
EOF
"""


class _StubDetector:
    def __init__(self, element_type, candidates):
        self.element_type = element_type
        self._candidates = candidates

    def detect(self, doc, rules, text_index):
        return self._candidates


def _candidate(element_type, confidence, x=0.0, y=0.0) -> StructuralCandidate:
    rules = load_rules()
    return StructuralCandidate(
        id="", element_type=element_type, x=x, y=y, layer="L",
        confidence=confidence, confidence_band=rules.confidence_band(confidence),
        detected_by=["layer"],
    )


def _analyze_with(pile_candidates, anchor_candidates) -> dict:
    analyzer = CadAnalyzer(detectors=[
        _StubDetector("pile", pile_candidates),
        _StubDetector("anchor", anchor_candidates),
    ])
    return analyzer.analyze(_EMPTY_DXF.encode("utf-8"), "empty.dxf")


def test_confirmed_evidence_yields_a_real_count():
    result = _analyze_with([_candidate("pile", 0.95)], [])
    assert result["piles"]["status"] == "confirmed"
    assert result["piles"]["count"] == 1
    assert result["summary"]["pileCount"] == 1
    assert result["summary"]["pileStatus"] == "confirmed"


def test_no_evidence_at_all_is_a_genuine_zero_not_unknown():
    result = _analyze_with([], [])
    assert result["anchors"]["status"] == "none_detected"
    assert result["anchors"]["count"] == 0
    assert result["summary"]["anchorCount"] == 0
    assert result["summary"]["anchorStatus"] == "none_detected"


def test_weak_evidence_below_confirmed_floor_is_unknown_not_zero():
    """A LOW-confidence candidate exists (the analyzer saw *something*) but
    never clears the MEDIUM floor — this must surface as null/"uncertain",
    never as a confirmed "0 ankraj"."""
    weak = _candidate("anchor", 0.3)
    result = _analyze_with([], [weak])
    assert result["anchors"]["status"] == "uncertain"
    assert result["anchors"]["count"] is None
    assert result["summary"]["anchorCount"] is None
    assert result["summary"]["anchorStatus"] == "uncertain"
    # still visible to a human reviewer, just not folded into the count
    assert len(result["uncertainCandidates"]) == 1


def test_warnings_appended_during_detection_reach_the_response():
    """Regression test: `response["warnings"]` used to be snapshotted from
    doc.warnings BEFORE the detector loop ran, so a warning a detector adds
    mid-detection (e.g. detectors/pile.py's nested-walk budget-exhaustion
    warning) was silently dropped from the API response. Assert a detector
    that appends to doc.warnings during detect() is reflected in the final
    response, not just in the CadDocument object."""
    class _WarningDetector(_StubDetector):
        def detect(self, doc, rules, text_index):
            doc.warnings.append("test warning appended during detection")
            return self._candidates

    analyzer = CadAnalyzer(detectors=[
        _WarningDetector("pile", []),
        _StubDetector("anchor", []),
    ])
    result = analyzer.analyze(_EMPTY_DXF.encode("utf-8"), "empty.dxf")
    assert "test warning appended during detection" in result["warnings"]


def test_candidate_evidence_is_human_readable_not_a_bare_number():
    c = _candidate("pile", 0.95)
    c.detected_by = ["block", "layer", "text"]
    c.merged_from = 2
    d = c.to_api_dict()
    assert len(d["evidence"]) >= 3
    assert all(isinstance(s, str) and s for s in d["evidence"])
