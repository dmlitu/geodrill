"""TEXT/MTEXT/ATTRIB corroboration.

CAD geometry is the primary detection signal (per the analyzer design);
text is only ever used to *corroborate* an already-geometry-based candidate
(raise its confidence, or fill in a diameter) — never as the sole basis for
a count. See detectors/pile.py and detectors/anchor.py.
"""
from __future__ import annotations

import re

from .document import CadDocument, CadEntity
from .geometry import SpatialGrid
from .rules import normalize_token

_DIAMETER_RE = re.compile(
    r"(?:[ØøOoØ]\s*|CAP[I]?\s*[:=]?\s*)(\d{2,4})\b|(\d{2,4})\s*(?:MM|CM)?\s*(?:FORE\s*KAZIK|KAZIK|PILE)",
    re.IGNORECASE,
)


class TextIndex:
    """Spatial index over a document's TEXT/MTEXT/ATTRIB entities, for
    nearest-neighbor lookup around a candidate's coordinates."""

    def __init__(self, doc: CadDocument):
        cell = max(doc.extents_span(), 1.0)
        self.grid: SpatialGrid[CadEntity] = SpatialGrid(cell_size=cell)
        for t in doc.texts:
            if t.point is not None:
                self.grid.add(t.point.x, t.point.y, t)

    def nearest(self, x: float, y: float, max_dist: float) -> CadEntity | None:
        best = None
        best_d2 = max_dist * max_dist
        for px, py, item in self.grid.query_radius(x, y, max_dist):
            d2 = (px - x) ** 2 + (py - y) ** 2
            if d2 <= best_d2:
                best_d2 = d2
                best = item
        return best

    def any_matching_keyword_nearby(self, x: float, y: float, max_dist: float, keywords: list[str]) -> CadEntity | None:
        for px, py, item in self.grid.query_radius(x, y, max_dist):
            if not item.text:
                continue
            nt = normalize_token(item.text)
            if any(normalize_token(kw) in nt for kw in keywords):
                return item
        return None


def extract_diameter_mm(text: str, unit: str) -> float | None:
    """Best-effort diameter extraction from a label like 'FORE KAZIK Ø80' or
    '80 cm FORE KAZIK'. Returns the value in the document's own unit (not
    forced to mm) so callers can compare directly against geometry radii."""
    if not text:
        return None
    m = _DIAMETER_RE.search(text)
    if not m:
        return None
    raw = m.group(1) or m.group(2)
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None
