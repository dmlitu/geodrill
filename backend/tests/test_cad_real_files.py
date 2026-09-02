"""Integration/diagnostic test against real production DWG fixtures.

These are real client project drawings and are intentionally NOT committed
to the repository. Drop the two Beşiktaş İksa DWGs (or any other real DWG)
into backend/tests/fixtures/cad/ to exercise this test locally; it's skipped
everywhere else (including CI) since the fixtures won't be present.

This test is deliberately not a strict pass/fail on exact pile/anchor
counts — see TECHNICAL_CHANGELOG / the CAD feature report for why a fixed
expected count would be dishonest for real, messy, inconsistently-labeled
drawings. It asserts the pipeline runs end-to-end without crashing and
produces a self-consistent, well-formed result.
"""
import glob
import os

import pytest

from modules.cad.analyzer import CadAnalyzer, inspect_document

FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "cad")
FIXTURES = sorted(glob.glob(os.path.join(FIXTURE_DIR, "*.dwg"))) + sorted(glob.glob(os.path.join(FIXTURE_DIR, "*.dxf")))


def _converter_available() -> bool:
    import shutil
    return shutil.which("dwg2dxf") is not None or shutil.which("ODAFileConverter") is not None or bool(
        os.environ.get("GEODRILL_DWG_CONVERTER")
    )


@pytest.mark.skipif(not FIXTURES, reason="no real DWG/DXF fixtures in backend/tests/fixtures/cad/")
@pytest.mark.parametrize("path", FIXTURES)
def test_real_file_analyze_end_to_end(path):
    if path.lower().endswith(".dwg") and not _converter_available():
        pytest.skip("no DWG converter (dwg2dxf/ODAFileConverter) available in this environment")

    with open(path, "rb") as f:
        data = f.read()
    filename = os.path.basename(path)

    result = CadAnalyzer().analyze(data, filename)

    assert result["summary"]["pileCount"] == result["piles"]["count"]
    assert result["summary"]["anchorCount"] == result["anchors"]["count"]
    assert result["summary"]["pileCount"] >= 0
    assert result["summary"]["anchorCount"] >= 0
    # Every confirmed item must actually meet the confirmed-confidence bar.
    min_conf = CadAnalyzer().confirmed_min_confidence
    for item in result["piles"]["items"] + result["anchors"]["items"]:
        assert item["confidence"] >= min_conf
    # No uncertain candidate should have snuck above the confirmed bar.
    for item in result["uncertainCandidates"]:
        assert item["confidence"] < min_conf

    diagnostics = inspect_document(data, filename)
    assert diagnostics["modelSpaceStats"]["totalEntities"] > 0

    print(f"\n--- {filename} ---")
    print("summary:", result["summary"])
    print("diagnostics:", result["diagnostics"])
    print("warnings:", result["warnings"])
    print("needsReview:", result["needsReview"], "uncertain:", len(result["uncertainCandidates"]))
