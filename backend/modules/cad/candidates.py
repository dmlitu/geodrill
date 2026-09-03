"""Shared candidate shape produced by every StructuralElementDetector."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

# DetectionExplainer: turns the terse `detected_by` tag list every detector
# already produces into a plain-language evidence trail, so a candidate never
# surfaces as a bare "confidence=0.83" — see cadDetectionRules.json for the
# scores these tags are attached at. Order here is display order (strongest/
# most concrete evidence first), not detection order.
_EVIDENCE_LABELS: dict[str, str] = {
    "block": "Block adı anahtar kelimeyle eşleşti",
    "layer": "Layer adı anahtar kelimeyle eşleşti",
    "geometry": "Geometri (daire / kapalı polyline) sembolle eşleşti",
    "shaft-symbol": "Kesit/cephe görünümünde tekrarlanan gövde (iki paralel çizgi) sembolü tanındı",
    "nested": "İç içe (nested) block içinde, block-in-block yürüyüşüyle bulundu",
    "anonymous": "İsimsiz/otomatik üretilen (anonymous, '*U...') block üzerinden bulundu — isme değil geometri+layer eşleşmesine dayanıyor",
    "repetition": "Aynı isimsiz block ≥5 kez tekrarlanan bir dizi (array) olarak bulundu",
    "numeric-layer": "Sayısal layer adı olası çap göstergesi olarak yorumlandı",
    "text": "Yakındaki TEXT/MTEXT anahtar kelimeyi doğruladı",
    "text-only": "Yalnızca metin etiketi bulundu — geometri doğrulaması yok, bu yüzden düşük güven",
}


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

    def evidence(self) -> list[str]:
        """DetectionExplainer: plain-language reasons behind this candidate's
        confidence score, in place of a bare number. Never fabricates a
        reason not backed by an actual `detected_by` tag."""
        out = [_EVIDENCE_LABELS[tag] for tag in self.detected_by if tag in _EVIDENCE_LABELS]
        if self.merged_from > 1:
            out.append(f"{self.merged_from} farklı tespit yöntemi aynı noktada birleşti (çapraz doğrulama)")
        if self.diameter:
            out.append(f"Çap bilgisi bulundu: {self.diameter:g}")
        return out

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
            "evidence": self.evidence(),
            "diameter": self.diameter,
            "textHint": self.text_hint,
            "sourceHandles": self.source_handles,
        }
