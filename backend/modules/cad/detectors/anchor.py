"""Anchor (ground anchor / tieback) candidate detection.

Scope for this version: block INSERT (primary — "one INSERT = one anchor",
per the design brief) plus a layer-keyword fallback for anchors drawn as
loose primitives (LINE/LWPOLYLINE/CIRCLE/ARC) rather than a block. The
fallback path clusters same-layer primitives by proximity *before* turning
them into candidates specifically so a multi-primitive anchor symbol
(LINE + LINE + CIRCLE, a common way to draw a tieback head) collapses into
one AnchorCandidate instead of being counted once per primitive.

Also handles a real-world naming gap found via forensic analysis of
production DWGs (see CAD_FORENSIC_REPORT.md): Turkish CAD offices routinely
abbreviate "ankraj" unpredictably in block/layer names — e.g. "CEPANK"
("cephe ankraj"), "ILAAVEANK" ("ilave ankraj") on layer "KARSIILAVEANK",
"KARSI ANKK" — none of which contain the literal substring "ANKRAJ" or
"ANCHOR" our keyword lists match on. Rather than hard-code those specific
names (which would only work for this one office's convention), a block is
also promoted when it (a) repeats at least `anchor_min_repeat_count` times
in modelspace — a single stray INSERT proves nothing, but a repeated
pattern along a wall is what an anchor row actually looks like — AND
(b) a majority of its instances have anchor-keyword text nearby (the
drawing's own annotations, e.g. "1.SIRA ANKRAJ KOTU", corroborate what an
unfamiliar block name alone can't). Repetition or text alone never
promotes anything; both together is required. See `_from_repeated_blocks`.
"""
from __future__ import annotations

from collections import defaultdict

from ..candidates import StructuralCandidate
from ..document import CadDocument, CadEntity
from ..geometry import SpatialGrid
from ..rules import DetectionRules, keyword_hit, normalize_token
from ..text_analyzer import TextIndex
from .base import StructuralElementDetector

_GEOMETRY_TYPES = ("LINE", "LWPOLYLINE", "CIRCLE", "ARC")


class AnchorDetector(StructuralElementDetector):
    element_type = "anchor"

    def detect(self, doc: CadDocument, rules: DetectionRules, text_index: TextIndex) -> list[StructuralCandidate]:
        proximity = rules.text_proximity_for_unit(doc.units)
        out = self._from_blocks(doc, rules, text_index, proximity)
        out += self._from_bare_geometry(doc, rules, text_index, proximity)
        out += self._from_repeated_blocks(doc, rules, text_index, proximity)
        out += self._from_text_only(doc, rules, out)
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

    # ── Repeated-block + text-corroboration fallback (unnamed blocks) ──
    def _from_repeated_blocks(self, doc, rules, text_index, proximity):
        """See module docstring. Skips any block name already handled by
        `_from_blocks` (block-keyword match) so nothing is double-counted."""
        out: list[StructuralCandidate] = []
        inserts_by_block: dict[str, list[CadEntity]] = defaultdict(list)
        for ce in doc.model_space_entities:
            if ce.entity_type == "INSERT" and ce.block_name:
                inserts_by_block[ce.block_name].append(ce)

        for name, entities in inserts_by_block.items():
            if len(entities) < rules.anchor_min_repeat_count:
                continue
            if keyword_hit(name, rules.anchor_block_keywords):
                continue  # already handled by _from_blocks
            block = doc.blocks.get(name)
            if block is None or block.is_xref:
                continue
            if block.entity_total == 0:
                # An empty block definition (no LINE/CIRCLE/LWPOLYLINE/etc.
                # inside it) is a generic leader/attribute anchor point —
                # the same glyph a coordinate table reuses for every row
                # type (piles, boundary points, anchors, ...). Nearby text
                # alone can't tell those apart; per this module's own
                # architecture (see text_analyzer.py), text corroborates
                # geometry, it never substitutes for it. Confirmed via a
                # real production file where this exact pattern (block
                # "KOTKESITICIN" on layer "XYZTABLO", a coordinate table)
                # produced ~700 false-positive candidates before this gate.
                continue
            layers = {ce.layer for ce in entities}
            if any(keyword_hit(l, rules.anchor_exclude_layer_keywords) for l in layers):
                continue

            corroborated = 0
            for ce in entities:
                if ce.point and text_index.any_matching_keyword_nearby(
                    ce.point.x, ce.point.y, proximity, rules.anchor_text_keywords
                ):
                    corroborated += 1
            if corroborated == 0 or corroborated < len(entities) / 2:
                continue  # a couple of coincidental hits isn't enough — require a majority

            base_score = rules.confidence["block_repetition_text_match"]
            for ce in entities:
                out.append(self._make_candidate(ce, doc, rules, text_index, proximity, base_score, ["block", "repetition"]))
        return out

    # ── Text-only fallback, always uncertain (never a confirmed count) ─
    def _from_text_only(self, doc, rules, existing: list[StructuralCandidate]):
        """Last-resort signal for a real drafting convention found via
        forensic analysis (see CAD_FORENSIC_REPORT.md §4): this office
        labels many individual anchor positions with a distinctive,
        spatially-unique annotation ('1.SIRA ANKRAJ KOTU', '2.SIRA ANKRAJ
        KOTU', ... — each occurrence at a different (x, y), confirmed by
        direct inspection, not a repeated static note) and draws no
        accompanying symbol next to most of them at all.

        Per this module's own design (text_analyzer.py: text corroborates
        geometry, it never substitutes for it), this can never justify a
        confirmed count on its own — so every candidate here is hard-capped
        at LOW confidence (`text_only_wide_pattern`, below the MEDIUM floor
        analyzer.py uses for the confirmed count) and always surfaces only
        in `uncertainCandidates`. This makes real evidence visible to a
        human reviewer instead of silently dropping it on the floor, without
        the algorithm ever claiming certainty it doesn't have.
        """
        tol = rules.tolerance_for_unit(doc.units)
        existing_pts = [(c.x, c.y) for c in existing]
        seen: set[tuple[float, float]] = set()
        matches: list[CadEntity] = []
        for t in doc.texts:
            if not t.text or not t.point:
                continue
            if len(t.text) > 80:
                # A real per-position label is short ('1.SIRA ANKRAJ KOTU',
                # median 18 chars across both real fixtures) — a general
                # project note/warnings paragraph that happens to mention
                # an anchor keyword is not one, and must not be surfaced as
                # if it marked a single anchor's location.
                continue
            if keyword_hit(t.layer, rules.anchor_exclude_layer_keywords):
                continue
            nt = normalize_token(t.text)
            if not any(normalize_token(kw) in nt for kw in rules.anchor_text_keywords):
                continue
            key = (round(t.point.x, 1), round(t.point.y, 1))
            if key in seen:
                continue  # the same label pasted twice at one spot, not two positions
            seen.add(key)
            matches.append(t)

        if len(matches) < rules.anchor_min_repeat_count:
            return []  # a couple of stray mentions is not a repeated pattern

        score = rules.confidence["text_only_wide_pattern"]
        out: list[StructuralCandidate] = []
        for t in matches:
            if any(abs(t.point.x - ex) <= tol and abs(t.point.y - ey) <= tol for ex, ey in existing_pts):
                continue  # already represented by a geometry-based candidate nearby
            out.append(StructuralCandidate(
                id="", element_type="anchor",
                x=t.point.x, y=t.point.y, z=t.point.z,
                layer=t.layer, block_name=None, entity_type="TEXT",
                source_handles=[t.handle] if t.handle else [],
                detected_by=["text-only"],
                confidence=round(score, 4),
                confidence_band=rules.confidence_band(score),
                diameter=None, text_hint=t.text,
            ))
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
