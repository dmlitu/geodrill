"""
CAD structural-element detection engine.

Turns an uploaded AutoCAD file (DWG, converted transparently to DXF; or a
native DXF) into a normalized ``CadDocument`` and runs a configurable,
generalizable rule engine over it to detect structural elements — piles and
ground anchors today, with the interfaces designed so diaphragm walls, shoring
walls, wale beams, struts, soil nails, mini-piles, jet-grout columns, etc. can
be added later without touching the parsing layer.

Layering (kept deliberately separate, per module):

    security.py         — upload validation, filename sanitization
    dwg_converter.py     — DWG -> DXF conversion via an external converter
    dxf_repair.py        — tolerant recovery for malformed/corrupted DXF
    document.py          — normalized CadDocument / CadEntity data model
    parser.py             — CadParser: bytes -> CadDocument
    rules.py               — token normalization + configurable keyword rules
    geometry.py            — circle/radius clustering, spatial grid index
    text_analyzer.py       — TEXT/MTEXT extraction + nearest-text lookup
    candidates.py           — StructuralCandidate shared shape
    detectors/              — StructuralElementDetector, PileDetector, AnchorDetector
    duplicate_resolver.py   — cross-method double-count elimination
    analyzer.py             — CadAnalyzer: orchestrates the whole pipeline
"""
import logging as _logging

# ezdxf logs a benign WARNING whenever virtual_entities() (used for nested
# block walking) has to skip copying a reactor/dictionary link it doesn't
# need for geometry — harmless, but noisy in server logs at scale.
_logging.getLogger("ezdxf").setLevel(_logging.ERROR)
