"""CadAnalyzer — orchestrates the full pipeline: parse -> detect -> resolve
duplicates -> split into confirmed vs. uncertain -> build the API response
shape documented in the CAD feature spec.
"""
from __future__ import annotations

from .detectors.anchor import AnchorDetector
from .detectors.pile import PileDetector
from .duplicate_resolver import resolve_duplicates
from .parser import CadParser
from .rules import DetectionRules, load_rules
from .text_analyzer import TextIndex

_ELEMENT_KEY = {"pile": "piles", "anchor": "anchors"}


class CadAnalyzer:
    def __init__(self, detectors=None, rules: DetectionRules | None = None):
        self.rules = rules or load_rules()
        self.detectors = detectors if detectors is not None else [PileDetector(), AnchorDetector()]

    @property
    def confirmed_min_confidence(self) -> float:
        # Single source of truth: the MEDIUM confidence band's lower bound.
        # A candidate below it never gets folded into a confident count —
        # per the "don't guess when uncertain" requirement.
        return self.rules.confidence_bands.get("MEDIUM", [0.6, 0.85])[0]

    def analyze(self, data: bytes, filename: str) -> dict:
        doc = CadParser().parse(data, filename)  # CadParseError -> router maps to HTTP 400
        text_index = TextIndex(doc)
        tolerance = self.rules.tolerance_for_unit(doc.units)

        response: dict = {
            "diagnostics": self._diagnostics(doc),
            "warnings": list(doc.warnings),
        }
        uncertain: list[dict] = []
        min_conf = self.confirmed_min_confidence

        for detector in self.detectors:
            etype = detector.element_type
            raw = detector.detect(doc, self.rules, text_index)
            resolved = resolve_duplicates(raw, tolerance)

            confirmed = sorted(
                (c for c in resolved if c.confidence >= min_conf),
                key=lambda c: (c.layer, round(c.x, 1), round(c.y, 1)),
            )
            weak = [c for c in resolved if c.confidence < min_conf]

            for i, c in enumerate(confirmed, start=1):
                c.id = f"{etype}_{i:03d}"
            for i, c in enumerate(weak, start=1):
                c.id = f"{etype}_uncertain_{i:03d}"

            response[_ELEMENT_KEY[etype]] = {
                "count": len(confirmed),
                "items": [c.to_api_dict() for c in confirmed],
            }
            uncertain.extend({**c.to_api_dict(), "elementType": etype} for c in weak)

        response["summary"] = {
            "pileCount": response.get("piles", {}).get("count", 0),
            "anchorCount": response.get("anchors", {}).get("count", 0),
        }
        response["uncertainCandidates"] = uncertain
        response["needsReview"] = bool(uncertain) or bool(doc.warnings)
        return response

    @staticmethod
    def _diagnostics(doc) -> dict:
        return {
            "units": doc.units,
            "unitSource": doc.unit_source,
            "dxfVersion": doc.dxf_version,
            "layersAnalyzed": len(doc.layers),
            "blocksAnalyzed": len(doc.blocks),
            "modelSpaceEntityCount": len(doc.model_space_entities),
            "paperSpaceLayoutCount": len(doc.paper_space_layouts),
            "xrefCount": len(doc.xref_blocks),
            "repairedEntitiesDropped": doc.repaired_entities_dropped,
        }


def inspect_document(data: bytes, filename: str) -> dict:
    """Backing implementation for POST /cad/inspect — the full raw
    layer/block/entity/text diagnostic dump, independent of pile/anchor
    detection. Kept as a free function (not a CadAnalyzer method) since it
    doesn't touch rules/detectors at all."""
    doc = CadParser().parse(data, filename)

    layers = [
        {"name": name, "entityCounts": info.entity_type_counts, "total": info.total}
        for name, info in sorted(doc.layers.items(), key=lambda kv: -kv[1].total)
    ]
    blocks = [
        {
            "name": name,
            "entityCounts": info.entity_type_counts,
            "insertCount": info.insert_count,
            "isXref": info.is_xref,
            "isAnonymous": info.is_anonymous,
        }
        for name, info in sorted(doc.blocks.items(), key=lambda kv: -kv[1].insert_count)
    ]
    entity_totals: dict[str, int] = {}
    for ce in doc.model_space_entities:
        entity_totals[ce.entity_type] = entity_totals.get(ce.entity_type, 0) + 1

    text_samples = []
    seen = set()
    for t in doc.texts:
        key = (t.text or "").strip()[:80]
        if not key or key in seen:
            continue
        seen.add(key)
        text_samples.append({"layer": t.layer, "text": key})
        if len(text_samples) >= 200:
            break

    return {
        "file": {"filename": doc.filename, "dxfVersion": doc.dxf_version},
        "units": doc.units,
        "unitSource": doc.unit_source,
        "layers": layers,
        "blocks": blocks,
        "entityStats": entity_totals,
        "texts": text_samples,
        "modelSpaceStats": {"totalEntities": len(doc.model_space_entities)},
        "paperSpaceStats": [
            {"layout": p.name, "entityCounts": p.entity_type_counts, "total": p.total}
            for p in doc.paper_space_layouts
        ],
        "xrefBlocks": doc.xref_blocks,
        "extents": (
            {"min": doc.extents[0].as_tuple(), "max": doc.extents[1].as_tuple()}
            if doc.extents else None
        ),
        "repairedEntitiesDropped": doc.repaired_entities_dropped,
        "warnings": doc.warnings,
    }
