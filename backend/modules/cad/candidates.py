"""Shared candidate shape produced by every StructuralElementDetector."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class StructuralCandidate:
    id: str
    element_type: str          # "pile" | "anchor" (future: "diaphragm_wall", "strut", ...)
    x: float
    y: float
    z: float = 0.0
    layer: str = ""
    block_name: Optional[str] = None
    entity_type: str = ""
    source_handles: list[str] = field(default_factory=list)
    source_path: tuple = ()     # block-nesting breadcrumb, for future CAD-viewer overlay
    detected_by: list[str] = field(default_factory=list)   # e.g. ["block", "layer", "text"]
    confidence: float = 0.0
    confidence_band: str = "LOW"
    diameter: Optional[float] = None
    text_hint: Optional[str] = None
    merged_from: int = 1        # how many raw candidates the DuplicateResolver folded into this one

    def to_api_dict(self) -> dict:
        return {
            "id": self.id,
            "x": round(self.x, 4),
            "y": round(self.y, 4),
            "z": round(self.z, 4),
            "layer": self.layer,
            "blockName": self.block_name,
            "entityType": self.entity_type,
            "confidence": round(self.confidence, 3),
            "confidenceBand": self.confidence_band,
            "detectedBy": "+".join(self.detected_by) if self.detected_by else "unknown",
            "diameter": self.diameter,
            "textHint": self.text_hint,
            "sourceHandles": self.source_handles,
        }
