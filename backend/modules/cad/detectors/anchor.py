"""Anchor (ground anchor / tieback) candidate detection.

Scope for this version: block INSERT (primary — "one INSERT = one anchor",
per the design brief) plus a layer-keyword fallback for anchors drawn as
loose primitives (LINE/LWPOLYLINE/CIRCLE/ARC) rather than a block. The
fallback path clusters same-layer primitives by proximity *before* turning
them into candidates specifically so a multi-primitive anchor symbol
(LINE + LINE + CIRCLE, a common way to draw a tieback head) collapses into
one AnchorCandidate instead of being counted once per primitive.

Not implemented in this version (documented, not silently approximated):
general geometric pattern recognition for anchor symbols that share neither
a block nor a keyword-matched layer. Those show up only as low-confidence
geometry noise, if at all — they are not silently promoted to a count.
"""
from __future__ import annotations

from collections import defaultdict

from ..candidates import StructuralCandidate
from ..document import CadDocument, CadEntity
from ..geometry import SpatialGrid
from ..rules import DetectionRules, keyword_hit
from ..text_analyzer import TextIndex
from .base import StructuralElementDetector

_GEOMETRY_TYPES = ("LINE", "LWPOLYLINE", "CIRCLE", "ARC")


class AnchorDetector(StructuralElementDetector):
    element_type = "anchor"

    def detect(self, doc: CadDocument, rules: DetectionRules, text_index: TextIndex) -> list[StructuralCandidate]:
        proximity = rules.text_proximity_for_unit(doc.units)
        out = self._from_blocks(doc, rules, text_index, proximity)
        out += self._from_bare_geometry(doc, rules, text_index, proximity)
        return out

    # ── Block / INSERT based candidates ────────────────────────────────
    def _from_blocks(self, doc, rules, text_index, proximity):
        out: list[StructuralCandidate] = []
        insert_layers: dict[str, set[str]] = defaultdict(set)
        inserts_by_block: dict[str, list[CadEntity]] = defaultdict(list)
        for ce in doc.model_space_entities:
            if ce.entity_type == "INSERT" and ce.block_name:
                insert_layers[ce.block_name].add(ce.layer)
                inserts_by_block[ce.block_name].append(ce)

        for name, block in doc.blocks.items():
            if block.is_xref or block.insert_count == 0:
                continue
            if not keyword_hit(name, rules.anchor_block_keywords):
                continue
            layers = insert_layers.get(name, set())
            if layers and all(keyword_hit(l, rules.anchor_exclude_layer_keywords) for l in layers):
                continue
            layer_hit = any(
                keyword_hit(l, rules.anchor_layer_keywords) and not keyword_hit(l, rules.anchor_exclude_layer_keywords)
                for l in layers
            )
            base_score = rules.confidence["block_layer_geometry_match"] if layer_hit else rules.confidence["block_keyword_match"]
            detected_by = ["block", "layer"] if layer_hit else ["block"]

            for ce in inserts_by_block.get(name, []):
                out.append(self._make_candidate(ce, doc, rules, text_index, proximity, base_score, list(detected_by)))
        return out

    # ── Bare-geometry fallback, pre-clustered by proximity ─────────────
    def _from_bare_geometry(self, doc, rules, text_index, proximity):
        out: list[StructuralCandidate] = []
        per_layer: dict[str, list[CadEntity]] = defaultdict(list)
        for ce in doc.model_space_entities:
            if ce.entity_type in _GEOMETRY_TYPES and ce.point:
                per_layer[ce.layer].append(ce)

        tol = rules.tolerance_for_unit(doc.units) * 3  # an anchor head symbol spans a few pile-tolerances

        for layer, entities in per_layer.items():
            if keyword_hit(layer, rules.anchor_exclude_layer_keywords):
                continue
            if not keyword_hit(layer, rules.anchor_layer_keywords):
                continue
            for cluster in self._cluster_by_proximity(entities, tol):
                rep = cluster[0]
                multi = len(cluster) > 1
                base_score = rules.confidence["layer_keyword_geometry_match"] if multi else rules.confidence["layer_keyword_only"]
                detected_by = ["layer", "geometry"] if multi else ["layer"]
                extra_handles = [c.handle for c in cluster if c.handle]
                out.append(self._make_candidate(rep, doc, rules, text_index, proximity, base_score, detected_by, extra_handles))
        return out

    @staticmethod
    def _cluster_by_proximity(entities: list[CadEntity], tol: float) -> list[list[CadEntity]]:
        grid: SpatialGrid[CadEntity] = SpatialGrid(cell_size=max(tol, 1e-6))
        for e in entities:
            grid.add(e.point.x, e.point.y, e)
        visited: set[int] = set()
        clusters: list[list[CadEntity]] = []
        for e in entities:
            if id(e) in visited:
                continue
            visited.add(id(e))
            group = [e]
            frontier = [e]
            while frontier:
                cur = frontier.pop()
                for _px, _py, other in grid.query_radius(cur.point.x, cur.point.y, tol):
                    if id(other) in visited:
                        continue
                    visited.add(id(other))
                    group.append(other)
                    frontier.append(other)
            clusters.append(group)
        return clusters

    def _make_candidate(self, ce, doc, rules, text_index, proximity, base_score, detected_by, extra_handles=None) -> StructuralCandidate:
        score = base_score
        text_hint = None
        if ce.point:
            nearby = text_index.any_matching_keyword_nearby(ce.point.x, ce.point.y, proximity, rules.anchor_text_keywords)
            if nearby:
                score = min(0.99, score + rules.confidence["text_corroboration_bonus"])
                detected_by = detected_by + ["text"]
                text_hint = nearby.text

        handles = [ce.handle] if ce.handle else []
        if extra_handles:
            handles = list(dict.fromkeys(handles + extra_handles))

        return StructuralCandidate(
            id="",
            element_type="anchor",
            x=ce.point.x if ce.point else 0.0,
            y=ce.point.y if ce.point else 0.0,
            z=ce.point.z if ce.point else 0.0,
            layer=ce.layer,
            block_name=ce.block_name,
            entity_type=ce.entity_type,
            source_handles=handles,
            detected_by=detected_by,
            confidence=round(score, 4),
            confidence_band=rules.confidence_band(score),
            diameter=None,
            text_hint=text_hint,
        )
