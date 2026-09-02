"""Configurable keyword rules + token normalization for the detectors.

CAD drafting conventions vary wildly between firms, so the keyword lists
that drive layer/block/text matching are external, editable JSON — not
hard-coded Python — per ``cadDetectionRules.json`` next to this file. An
operator can override the whole file via the ``GEODRILL_CAD_RULES_PATH`` env
var (following the same "no hard-coded local paths" convention as the DWG
converter) without touching code.
"""
from __future__ import annotations

import json
import os
import re
import unicodedata
from dataclasses import dataclass, field
from functools import lru_cache

_DEFAULT_RULES_PATH = os.path.join(os.path.dirname(__file__), "cadDetectionRules.json")

_TURKISH_MAP = str.maketrans({
    "ı": "i", "İ": "I", "ş": "s", "Ş": "S", "ğ": "g", "Ğ": "G",
    "ü": "u", "Ü": "U", "ö": "o", "Ö": "O", "ç": "c", "Ç": "C",
})


def normalize_token(s: str) -> str:
    """Collapse Turkish/ASCII case, diacritics, spaces, '-' and '_' so that
    'Fore Kazık', 'FORE_KAZIK' and 'fore-kazik' all reduce to the same
    'FOREKAZIK' token. Used for every layer/block/text keyword comparison."""
    if not s:
        return ""
    s = s.translate(_TURKISH_MAP)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    s = s.upper()
    s = re.sub(r"[\s\-_]+", "", s)
    s = re.sub(r"[^A-Z0-9]", "", s)
    return s


def keyword_hit(name: str, keywords: list[str]) -> str | None:
    """Returns the matched keyword (normalized) if `name` contains it.

    A long keyword ('KAZIK', 'ANKRAJ', ...) matches anywhere as a plain
    substring. A short canonical code (<=3 chars, e.g. 'FK') is too easy to
    hit by coincidence as a bare substring (e.g. inside an unrelated
    'FKAYIT' layer), so it only counts when it IS the whole name, or is a
    prefix/suffix and the rest of the name is purely numeric — the common
    Turkish CAD convention of encoding a diameter right after the code
    ('FK65', 'FK80')."""
    n = normalize_token(name)
    if not n:
        return None
    for kw in keywords:
        nk = normalize_token(kw)
        if not nk:
            continue
        if len(nk) <= 3:
            if n == nk:
                return kw
            if n.startswith(nk) and n[len(nk):].isdigit():
                return kw
            if n.endswith(nk) and n[:-len(nk)].isdigit():
                return kw
            continue
        if nk in n:
            return kw
    return None


@dataclass
class DetectionRules:
    pile_layer_keywords: list[str] = field(default_factory=list)
    pile_block_keywords: list[str] = field(default_factory=list)
    pile_text_keywords: list[str] = field(default_factory=list)
    pile_exclude_layer_keywords: list[str] = field(default_factory=list)
    pile_min_repeat_count: int = 5
    pile_numeric_layer_diameter_heuristic: bool = True

    anchor_layer_keywords: list[str] = field(default_factory=list)
    anchor_block_keywords: list[str] = field(default_factory=list)
    anchor_text_keywords: list[str] = field(default_factory=list)
    anchor_exclude_layer_keywords: list[str] = field(default_factory=list)

    confidence: dict[str, float] = field(default_factory=dict)
    confidence_bands: dict[str, list[float]] = field(default_factory=dict)  # HIGH/MEDIUM/LOW -> [min,max)
    duplicate_tolerance_by_unit: dict[str, float] = field(default_factory=dict)
    text_proximity_by_unit: dict[str, float] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, d: dict) -> "DetectionRules":
        pile = d.get("pile", {})
        anchor = d.get("anchor", {})
        return cls(
            pile_layer_keywords=pile.get("layerKeywords", []),
            pile_block_keywords=pile.get("blockKeywords", []),
            pile_text_keywords=pile.get("textKeywords", []),
            pile_exclude_layer_keywords=pile.get("excludeLayerKeywords", []),
            pile_min_repeat_count=pile.get("minRepeatCount", 5),
            pile_numeric_layer_diameter_heuristic=pile.get("numericLayerDiameterHeuristic", True),
            anchor_layer_keywords=anchor.get("layerKeywords", []),
            anchor_block_keywords=anchor.get("blockKeywords", []),
            anchor_text_keywords=anchor.get("textKeywords", []),
            anchor_exclude_layer_keywords=anchor.get("excludeLayerKeywords", []),
            confidence=d.get("confidence", {}),
            confidence_bands=d.get("confidenceBands", {}),
            duplicate_tolerance_by_unit=d.get("duplicateToleranceByUnit", {}),
            text_proximity_by_unit=d.get("textProximityByUnit", {}),
        )

    def confidence_band(self, score: float) -> str:
        for band, (lo, hi) in self.confidence_bands.items():
            if lo <= score < hi:
                return band
        return "LOW"

    def tolerance_for_unit(self, unit: str) -> float:
        return self.duplicate_tolerance_by_unit.get(unit, self.duplicate_tolerance_by_unit.get("unknown", 0.15))

    def text_proximity_for_unit(self, unit: str) -> float:
        return self.text_proximity_by_unit.get(unit, self.text_proximity_by_unit.get("unknown", 1.0))


@lru_cache(maxsize=4)
def _load_rules_from_path(path: str) -> DetectionRules:
    with open(path, "r", encoding="utf-8") as f:
        return DetectionRules.from_dict(json.load(f))


def load_rules() -> DetectionRules:
    path = os.environ.get("GEODRILL_CAD_RULES_PATH", _DEFAULT_RULES_PATH)
    return _load_rules_from_path(path)
