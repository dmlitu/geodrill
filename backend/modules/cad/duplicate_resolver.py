"""Cross-method double-count elimination.

The same physical pile or anchor can legitimately be picked up more than
once — e.g. a bare CIRCLE candidate on a keyword-matched layer *and* a
nearby TEXT-corroborated candidate from a different pass, or two detectors
that both had a partial, weaker signal for the same object. This resolver
merges same-element-type candidates whose coordinates fall within a
unit-aware tolerance, keeping the highest-confidence one and union-ing the
evidence (`detectedBy`, source handles) rather than silently dropping it.

Block-vs-internal-geometry double counting is prevented earlier, structurally,
inside each detector (see detectors/pile.py) — a block's own INSERTs and its
internal member geometry are never both turned into candidates in the first
place, so there is nothing left for this resolver to reconcile there.
"""
from __future__ import annotations

from .candidates import StructuralCandidate
from .geometry import SpatialGrid


def resolve_duplicates(candidates: list[StructuralCandidate], tolerance: float) -> list[StructuralCandidate]:
    if not candidates:
        return []

    grid: SpatialGrid[StructuralCandidate] = SpatialGrid(cell_size=max(tolerance, 1e-6))
    for c in candidates:
        grid.add(c.x, c.y, c)

    # Process highest-confidence first so a strong candidate "claims" its
    # neighborhood before weaker duplicates get merged into it.
    ordered = sorted(candidates, key=lambda c: -c.confidence)
    merged_into: dict[int, StructuralCandidate] = {}  # id(candidate) -> surviving candidate
    survivors: list[StructuralCandidate] = []

    for c in ordered:
        if id(c) in merged_into:
            continue
        survivors.append(c)
        merged_into[id(c)] = c
        for _px, _py, other in grid.query_radius(c.x, c.y, tolerance):
            if other is c or id(other) in merged_into:
                continue
            merged_into[id(other)] = c
            c.merged_from += other.merged_from
            for tag in other.detected_by:
                if tag not in c.detected_by:
                    c.detected_by.append(tag)
            for h in other.source_handles:
                if h not in c.source_handles:
                    c.source_handles.append(h)
            if other.confidence > c.confidence:
                # a merged-in candidate can still carry a slightly higher
                # score once its own text corroboration is accounted for
                c.confidence = other.confidence
            if not c.text_hint and other.text_hint:
                c.text_hint = other.text_hint
            if not c.diameter and other.diameter:
                c.diameter = other.diameter

    return survivors
