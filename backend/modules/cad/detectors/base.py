"""Generic detector interface.

Every structural-element type (pile, anchor, and later diaphragm wall,
shoring wall, wale beam, strut, soil nail, mini-pile, jet-grout column,
column...) implements this same shape, so ``CadAnalyzer`` can run an
arbitrary list of detectors without knowing their specifics.
"""
from __future__ import annotations

from abc import ABC, abstractmethod

from ..candidates import StructuralCandidate
from ..document import CadDocument
from ..rules import DetectionRules
from ..text_analyzer import TextIndex


class StructuralElementDetector(ABC):
    element_type: str

    @abstractmethod
    def detect(self, doc: CadDocument, rules: DetectionRules, text_index: TextIndex) -> list[StructuralCandidate]:
        """Return raw candidates (not yet duplicate-resolved) for this
        element type. Must never raise for a merely-empty/ambiguous
        document — return an empty list instead."""
        raise NotImplementedError
