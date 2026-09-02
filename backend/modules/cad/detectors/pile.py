"""Pile candidate detection.

Signal priority, per the design brief: layer name -> block name -> block
internal geometry -> bare repeated geometry, with TEXT used only to
corroborate (raise confidence / fill in a diameter), never as the primary
count. See module docstring in ``modules/cad/__init__.py`` for the full
pipeline.

Double-count guard: a block only becomes a pile candidate source once (via
``_from_blocks``); its member entities are never independently re-examined
by ``_from_bare_geometry`` because that pass only looks at *modelspace*
entities (CIRCLE/closed-LWPOLYLINE placed directly in modelspace), never at
entities living inside a block definition — so a pile drawn as a block
INSERT is never also counted as a bare circle.
"""
from __future__ import annotations

import statistics
from collections import defaultdict

from ..candidates import StructuralCandidate
from ..document import CadBlockInfo, CadDocument, CadEntity
from ..rules import DetectionRules, keyword_hit, normalize_token
from ..text_analyzer import TextIndex, extract_diameter_mm
from .base import StructuralElementDetector


def _safe(fn, default=None):
    try:
        return fn()
    except Exception:
        return default


def _layer_signal(layer: str, rules: DetectionRules) -> tuple[bool, bool]:
    """Returns (keyword_hit, excluded)."""
    if keyword_hit(layer, rules.pile_exclude_layer_keywords):
        return False, True
    return bool(keyword_hit(layer, rules.pile_layer_keywords)), False


def _is_symbol_block(block: CadBlockInfo) -> bool:
    """A block that reads as a point symbol: a handful of entities anchored
    by at least one circle — the common drafting convention for a pile-head
    marker. Blocks with many entities are detail sheets / legends, not
    per-pile symbols."""
    total = block.entity_total
    if total == 0 or total > 8:
        return False
    return block.entity_type_counts.get("CIRCLE", 0) >= 1


class PileDetector(StructuralElementDetector):
    element_type = "pile"

    def detect(self, doc: CadDocument, rules: DetectionRules, text_index: TextIndex) -> list[StructuralCandidate]:
        proximity = rules.text_proximity_for_unit(doc.units)
        claimed_blocks: set[str] = set()

        out = self._from_blocks(doc, rules, text_index, proximity, claimed_blocks)
        out += self._from_bare_geometry(doc, rules, text_index, proximity, claimed_blocks)
        out += self._from_nested_containers(doc, rules, text_index, proximity, claimed_blocks)
        return out

    # ── Block / INSERT based candidates ────────────────────────────────
    def _from_blocks(self, doc, rules, text_index, proximity, claimed_blocks):
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
            if not keyword_hit(name, rules.pile_block_keywords):
                continue

            layers = insert_layers.get(name, set())
            layer_signals = [_layer_signal(l, rules) for l in layers]
            if layers and all(excluded for _, excluded in layer_signals):
                continue  # every layer this block is placed on is explicitly excluded (e.g. elevation views)
            layer_hit = any(hit for hit, _ in layer_signals)
            geom_ok = _is_symbol_block(block)

            if layer_hit and geom_ok:
                base_score = rules.confidence["block_layer_geometry_match"]
                detected_by = ["block", "layer", "geometry"]
            elif layer_hit or geom_ok:
                base_score = rules.confidence["block_keyword_match"]
                detected_by = ["block", "layer"] if layer_hit else ["block", "geometry"]
            else:
                base_score = rules.confidence["block_keyword_match"] * 0.9
                detected_by = ["block"]

            claimed_blocks.add(name)
            for ce in inserts_by_block.get(name, []):
                out.append(self._make_candidate(ce, doc, rules, text_index, proximity, base_score, list(detected_by)))
        return out

    # ── Bare CIRCLE / closed-LWPOLYLINE candidates ─────────────────────
    def _from_bare_geometry(self, doc, rules, text_index, proximity, claimed_blocks):
        out: list[StructuralCandidate] = []
        per_layer: dict[str, list[CadEntity]] = defaultdict(list)
        for ce in doc.model_space_entities:
            if ce.entity_type == "CIRCLE" and ce.radius:
                per_layer[ce.layer].append(ce)
            elif ce.entity_type == "LWPOLYLINE" and ce.closed:
                per_layer[ce.layer].append(ce)

        for layer, entities in per_layer.items():
            layer_hit, excluded = _layer_signal(layer, rules)
            if excluded:
                continue

            is_numeric_layer = rules.pile_numeric_layer_diameter_heuristic and normalize_token(layer).isdigit()

            if layer_hit:
                base_score = rules.confidence["layer_keyword_geometry_match"]
                detected_by = ["layer", "geometry"]
            elif is_numeric_layer and len(entities) >= rules.pile_min_repeat_count:
                radii = [e.radius for e in entities if e.radius]
                if not radii:
                    continue
                mean_r = statistics.mean(radii)
                if mean_r <= 0 or (max(radii) - min(radii)) / mean_r > 0.15:
                    continue  # too inconsistent to read as "one diameter class" — skip rather than guess
                base_score = rules.confidence["geometry_numeric_layer_diameter"]
                detected_by = ["geometry", "numeric-layer"]
            else:
                # No layer/keyword signal at all — the weakest, most generic
                # fallback. A closed LWPOLYLINE alone is far too common a
                # shape (hatch boundaries, logos, title-block symbols) to
                # mean anything on its own, so this last-resort tier only
                # fires on repeated CIRCLE geometry, never bare polylines.
                circles = [e for e in entities if e.entity_type == "CIRCLE"]
                if len(circles) < rules.pile_min_repeat_count:
                    continue
                base_score = rules.confidence["geometry_only"]
                detected_by = ["geometry"]
                entities = circles

            for ce in entities:
                out.append(self._make_candidate(ce, doc, rules, text_index, proximity, base_score, list(detected_by)))
        return out

    def _make_candidate(self, ce: CadEntity, doc, rules, text_index, proximity, base_score, detected_by) -> StructuralCandidate:
        score = base_score
        text_hint = None
        diameter = ce.radius * 2 if ce.radius else None
        if ce.point:
            nearby = text_index.any_matching_keyword_nearby(ce.point.x, ce.point.y, proximity, rules.pile_text_keywords)
            if nearby:
                score = min(0.99, score + rules.confidence["text_corroboration_bonus"])
                detected_by = detected_by + ["text"]
                text_hint = nearby.text
                extracted = extract_diameter_mm(nearby.text, doc.units)
                if extracted:
                    diameter = extracted

        return StructuralCandidate(
            id="",
            element_type="pile",
            x=ce.point.x if ce.point else 0.0,
            y=ce.point.y if ce.point else 0.0,
            z=ce.point.z if ce.point else 0.0,
            layer=ce.layer,
            block_name=ce.block_name,
            entity_type=ce.entity_type,
            source_handles=[ce.handle] if ce.handle else [],
            detected_by=detected_by,
            confidence=round(score, 4),
            confidence_band=rules.confidence_band(score),
            diameter=diameter,
            text_hint=text_hint,
        )

    # ── Nested block-in-block candidates ───────────────────────────────
    # A pile block that never appears directly in modelspace — only inside
    # another ("container") block — would otherwise be invisible to
    # `_from_blocks`. This walk uses ezdxf's own `virtual_entities()` at
    # each level, so world coordinates come from ezdxf's own transform
    # composition (rotation/scale/translation), not a hand-rolled matrix.
    #
    # Double-count guard: a top-level INSERT whose block was already
    # claimed by `_from_blocks` is skipped entirely here (never walked into
    # again); inside a container, a nested INSERT that itself matches the
    # pile rules is recorded once and NOT recursed into any further.
    #
    # Cycle guard: `visited` carries the chain of block names on the
    # current branch; a block that would reference one of its own
    # ancestors is skipped rather than followed (protects against a
    # malformed/malicious circular block reference).
    _NESTED_MAX_DEPTH = 6
    _NESTED_MAX_VIRTUAL_ENTITIES = 20000

    def _from_nested_containers(self, doc, rules, text_index, proximity, claimed_blocks):
        out: list[StructuralCandidate] = []
        ezdxf_doc = doc.ezdxf_doc
        if ezdxf_doc is None:
            return out
        budget = {"n": self._NESTED_MAX_VIRTUAL_ENTITIES}
        for top_insert in ezdxf_doc.modelspace().query("INSERT"):
            name = _safe(lambda: top_insert.dxf.name)
            if not name or name in claimed_blocks:
                continue
            self._walk_container(top_insert, doc, rules, text_index, proximity, out, budget, {name}, 0)
        return out

    def _walk_container(self, insert_entity, doc, rules, text_index, proximity, out, budget, visited, depth):
        if depth >= self._NESTED_MAX_DEPTH or budget["n"] <= 0:
            return
        try:
            children = list(insert_entity.virtual_entities())
        except Exception:
            return
        budget["n"] -= len(children)

        circles_by_layer: dict[str, list] = defaultdict(list)
        for child in children:
            ctype = child.dxftype()
            if ctype == "INSERT":
                child_name = _safe(lambda: child.dxf.name)
                if not child_name or child_name in visited:
                    continue
                if keyword_hit(child_name, rules.pile_block_keywords):
                    layer = _safe(lambda: child.dxf.layer, "0") or "0"
                    block_info = doc.blocks.get(child_name)
                    layer_hit, excluded = _layer_signal(layer, rules)
                    if excluded:
                        continue
                    geom_ok = bool(block_info) and _is_symbol_block(block_info)
                    if layer_hit and geom_ok:
                        base_score = rules.confidence["block_layer_geometry_match"]
                        tags = ["block", "layer", "geometry", "nested"]
                    else:
                        # Discounted slightly: position depends on the
                        # composed ancestor transform, one more thing that
                        # can go subtly wrong than a top-level INSERT.
                        base_score = rules.confidence["block_keyword_match"] * 0.95
                        tags = ["block", "nested"]
                    p = child.dxf.insert
                    out.append(self._finalize(p.x, p.y, getattr(p, "z", 0.0) or 0.0, layer, child_name,
                                               "INSERT", base_score, tags, doc, rules, text_index, proximity))
                    # Claimed — its own internals are not walked further.
                else:
                    self._walk_container(child, doc, rules, text_index, proximity, out, budget,
                                          visited | {child_name}, depth + 1)
            elif ctype == "CIRCLE":
                layer = _safe(lambda: child.dxf.layer, "0") or "0"
                circles_by_layer[layer].append(child)

        for layer, circles in circles_by_layer.items():
            layer_hit, excluded = _layer_signal(layer, rules)
            # Nested, unnamed geometry only counts with an explicit layer
            # signal — one level removed from modelspace is already one
            # inference too many to trust bare geometric repetition alone.
            if excluded or not layer_hit or len(circles) < rules.pile_min_repeat_count:
                continue
            base_score = rules.confidence["layer_keyword_geometry_match"]
            for c in circles:
                ctr = c.dxf.center
                out.append(self._finalize(ctr.x, ctr.y, getattr(ctr, "z", 0.0) or 0.0, layer, None, "CIRCLE",
                                           base_score, ["layer", "geometry", "nested"], doc, rules, text_index,
                                           proximity, diameter=c.dxf.radius * 2))

    @staticmethod
    def _finalize(x, y, z, layer, block_name, entity_type, base_score, detected_by, doc, rules, text_index,
                  proximity, diameter=None) -> StructuralCandidate:
        score = base_score
        text_hint = None
        nearby = text_index.any_matching_keyword_nearby(x, y, proximity, rules.pile_text_keywords)
        if nearby:
            score = min(0.99, score + rules.confidence["text_corroboration_bonus"])
            detected_by = detected_by + ["text"]
            text_hint = nearby.text
            extracted = extract_diameter_mm(nearby.text, doc.units)
            if extracted:
                diameter = extracted
        return StructuralCandidate(
            id="", element_type="pile", x=x, y=y, z=z, layer=layer, block_name=block_name,
            entity_type=entity_type, source_handles=[], detected_by=detected_by,
            confidence=round(score, 4), confidence_band=rules.confidence_band(score), diameter=diameter,
            text_hint=text_hint,
        )
