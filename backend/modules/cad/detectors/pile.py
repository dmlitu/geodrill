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
from ..rules import UNIT_TO_METERS, DetectionRules, keyword_hit, normalize_token
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


def _is_symbol_block_raw(raw_block) -> bool:
    """Same test as `_is_symbol_block`, but for a block that never appears
    at the top level of modelspace (only nested inside another block) —
    such blocks have no entry in CadDocument.blocks, so this works
    directly off the raw ezdxf block definition instead."""
    entities = list(raw_block)
    total = len(entities)
    if total == 0 or total > 8:
        return False
    return sum(1 for e in entities if e.dxftype() == "CIRCLE") >= 1


def _is_shaft_symbol(raw_block, unit: str, width_range_m: tuple[float, float]) -> tuple[bool, float | None]:
    """A pile/column/casing drawn in elevation or cross-section is
    conventionally a pair of parallel lines — its two edges, often broken
    into dashed segments to suggest concrete/rebar hatching — plus an
    outline polyline. This is the elevation-view counterpart of
    `_is_symbol_block`'s "circle = pile in plan view": generalizable
    geometry, not tied to any block name.

    Signature: the block's LINE entities cluster into exactly two
    positions along one axis (both vertical, sharing X, or both
    horizontal, sharing Y), and the perpendicular gap between the two
    falls in a plausible pile/shaft-diameter range. Returns
    (matched, gap_in_document_units)."""
    entities = list(raw_block)
    if not entities or len(entities) > 40:
        return False, None
    lines = [e for e in entities if e.dxftype() == "LINE"]
    if len(lines) < 2:
        return False, None

    def _is_vertical(l) -> bool:
        dx = abs(l.dxf.start.x - l.dxf.end.x)
        dy = abs(l.dxf.start.y - l.dxf.end.y)
        return dy > dx * 3

    def _is_horizontal(l) -> bool:
        dx = abs(l.dxf.start.x - l.dxf.end.x)
        dy = abs(l.dxf.start.y - l.dxf.end.y)
        return dx > dy * 3

    scale = UNIT_TO_METERS.get(unit)
    lo, hi = width_range_m

    for axis_lines, coord in (
        ([l for l in lines if _is_vertical(l)], lambda l: l.dxf.start.x),
        ([l for l in lines if _is_horizontal(l)], lambda l: l.dxf.start.y),
    ):
        if len(axis_lines) < 2:
            continue
        positions = sorted(set(round(coord(l), 1) for l in axis_lines))
        if len(positions) != 2:
            continue  # exactly two edges, not one (a single wall) or 3+ (something else)
        gap = abs(positions[1] - positions[0])
        if gap <= 0:
            continue
        if scale is None:
            return True, gap  # unit unknown — accept the shape alone, can't validate scale
        if lo <= gap * scale <= hi:
            return True, gap
    return False, None


def _raw_block(doc, name: str):
    """Fetch a block definition directly from the underlying ezdxf
    document — needed for blocks that never appear at modelspace top
    level (e.g. AutoCAD ARRAY-generated anonymous blocks nested only
    inside another block), which CadDocument.blocks doesn't catalog."""
    ezdxf_doc = getattr(doc, "ezdxf_doc", None)
    if ezdxf_doc is None:
        return None
    try:
        return ezdxf_doc.blocks.get(name)
    except Exception:
        return None


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
            root_layer = _safe(lambda: top_insert.dxf.layer, "0") or "0"
            self._walk_container(top_insert, doc, rules, text_index, proximity, out, budget, {name}, 0, root_layer)
        return out

    def _walk_container(self, insert_entity, doc, rules, text_index, proximity, out, budget, visited, depth, root_layer):
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
                # ezdxf's virtual_entities() doesn't reliably carry a
                # per-item layer override through a large AutoCAD
                # associative ARRAY — verified on a real production file
                # where only the first few of 78 array copies kept their
                # own layer, the rest defaulted to "0". The array's own
                # top-level container layer (root_layer) is the one
                # attribute guaranteed to be real, so it's used as a
                # fallback whenever the item's own layer looks like a
                # generic default rather than a real, different layer.
                own_layer = _safe(lambda: child.dxf.layer, "0") or "0"
                own_hit, own_excluded = _layer_signal(own_layer, rules)
                if own_layer == "0" and not own_hit:
                    layer, layer_hit, excluded = root_layer, *_layer_signal(root_layer, rules)
                else:
                    layer, layer_hit, excluded = own_layer, own_hit, own_excluded

                if keyword_hit(child_name, rules.pile_block_keywords):
                    if excluded:
                        continue
                    block_info = doc.blocks.get(child_name)
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
                    continue  # claimed — its own internals are not walked further

                # The block's own name means nothing (AutoCAD ARRAY features
                # generate anonymous names like "*U78") — try pure geometry,
                # corroborated by a matching layer name (e.g. a
                # "...KAZIK..." layer), before falling through to recursing
                # into it like any other unnamed container. Geometry alone,
                # on an anonymous block, on an unrelated layer, is too weak
                # a basis to trust.
                raw_child = _raw_block(doc, child_name)
                if layer_hit and not excluded and raw_child is not None:
                    circle_ok = _is_symbol_block_raw(raw_child)
                    shaft_ok, shaft_gap = _is_shaft_symbol(raw_child, doc.units, rules.pile_shaft_width_range_m)
                    if circle_ok or shaft_ok:
                        base_score = rules.confidence["nested_anonymous_geometry_layer_match"]
                        tags = ["layer", "geometry", "nested", "anonymous"]
                        if shaft_ok:
                            tags.append("shaft-symbol")
                        p = child.dxf.insert
                        out.append(self._finalize(
                            p.x, p.y, getattr(p, "z", 0.0) or 0.0, layer, child_name, "INSERT",
                            base_score, tags, doc, rules, text_index, proximity,
                            diameter=shaft_gap if shaft_ok else None,
                        ))
                        continue  # claimed as a leaf symbol

                # No name match, no geometry match — recurse unconditionally,
                # regardless of whether this child is a "pure" INSERT-only
                # container. (Gating recursion on purity was tried and
                # reverted: on a real production file it silently stopped
                # short of a second, independent pile array nested a few
                # levels beneath a mixed INSERT+TEXT+DIMENSION container,
                # undercounting real piles. A block with no nested INSERTs
                # of its own just yields no further candidates here — same
                # as before, harmless.)
                self._walk_container(child, doc, rules, text_index, proximity, out, budget,
                                      visited | {child_name}, depth + 1, root_layer)
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
