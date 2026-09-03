"""BlockInventory — GeoDrill's own equivalent of AutoCAD's COUNT /
DATAEXTRACTION block-quantity logic, generalized past a single level of
INSERT.

AutoCAD's own Count/Data Extraction tooling answers "how many of this block
are really in the drawing" by (conceptually) fully expanding every nested
INSERT and array — a block nested inside a container that's itself placed
twice counts twice, three levels deep multiplies through every level. This
module reproduces that arithmetic directly against the parsed document,
independent of pile/anchor detection, so a raw "is 510 real?" question can
be answered from block topology alone before any detector-specific
keyword/geometry logic runs at all. See CAD_RESEARCH.md for the research
behind this (AutoCAD COUNT/DATAEXTRACTION, ezdxf virtual_entities()/mcount).

Two counts are kept distinct on purpose, per the "raw vs physical" ask:
  - `top_level_count`  — direct INSERTs of this block sitting right in
    Model Space (what a naive `msp.query("INSERT[name=='X']")` would give).
  - `total_physical_count` — top-level *plus* every instantiation reachable
    by walking nested INSERTs, each weighted by how many times its own
    container is itself placed. This is the number that matters for "is
    this a real physical count" — a block that only ever appears nested
    inside a once-placed array container has top_level_count == 0 but a
    nonzero total_physical_count, exactly the FK65 pattern found in the
    real production fixture (see CAD_FORENSIC_REPORT.md).

Also builds a lightweight, rotation/translation-independent geometry
signature per block (entity-type multiset + circle radii + line lengths,
all native-unit-rounded) so visually-identical blocks under different names
— including AutoCAD's own auto-generated anonymous names ("*U43", "*U81",
...) for the same array item — cluster together. This is the generalized,
diagnostic-surface version of the same idea `detectors/pile.py` already
hard-codes for one specific shape (`_is_symbol_block` / `_is_shaft_symbol`);
here it's exposed for *any* block, for human review, not fed into a
detector's confidence score directly (see CAD_RESEARCH.md "Recommended
architecture" for why that separation is deliberate for this iteration).

Deliberately NOT attempted here (see CAD_RESEARCH.md): a full canonical
transform-normalized positional signature, or resolving a dynamic block's
"effective name" — ezdxf's own maintainer confirms dynamic blocks are not
part of the DXF specification, so that link is unrecoverable from DXF
(https://github.com/mozman/ezdxf/discussions/863), DWG or not.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Optional

from .document import CadDocument

_SKIP_LAYOUT_BLOCKS = {"*model_space", "*paper_space"}


def _safe(fn, default=None):
    try:
        return fn()
    except Exception:
        return default


def _direct_child_block_counts(block_def) -> Counter:
    c: Counter = Counter()
    for e in block_def:
        if e.dxftype() == "INSERT":
            name = _safe(lambda e=e: e.dxf.name)
            if name:
                c[name] += 1
    return c


def compute_weighted_occurrences(doc: CadDocument, max_depth: int = 12) -> dict[str, int]:
    """Total physical instantiation count per block name, reachable from
    Model Space at any nesting depth, weighted through every level of
    container repetition. See module docstring."""
    ezdxf_doc = doc.ezdxf_doc
    if ezdxf_doc is None:
        return {}
    msp = ezdxf_doc.modelspace()

    top_counts: Counter = Counter()
    for e in msp.query("INSERT"):
        name = _safe(lambda e=e: e.dxf.name)
        if name:
            top_counts[name] += 1

    totals: Counter = Counter(top_counts)
    child_cache: dict[str, Counter] = {}

    def children_of(name: str) -> Counter:
        if name not in child_cache:
            block_def = _safe(lambda: ezdxf_doc.blocks.get(name))
            child_cache[name] = _direct_child_block_counts(block_def) if block_def is not None else Counter()
        return child_cache[name]

    def _propagate(name: str, weight: int, depth: int, visited: frozenset):
        # Cycle guard mirrors detectors/pile.py's `_walk_container`: a block
        # referencing one of its own ancestors is skipped rather than
        # followed, so a malformed/circular block reference can't loop
        # forever or blow up the weighted total.
        if depth >= max_depth or weight <= 0 or name in visited:
            return
        for child_name, child_count in children_of(name).items():
            add = weight * child_count
            totals[child_name] += add
            _propagate(child_name, add, depth + 1, visited | {name})

    for name, weight in list(top_counts.items()):
        _propagate(name, weight, 0, frozenset())

    return dict(totals)


def geometry_signature(block_def) -> Optional[str]:
    """Rotation- and translation-independent shape fingerprint: entity-type
    multiset + sorted circle radii + sorted line lengths, all rounded to
    absorb floating-point noise. Two blocks with the same signature are
    almost certainly the same drafted symbol, whatever their names —
    including one named ('FK65') and one anonymous ('*U43'). Deliberately
    ignores relative entity *position* (see module docstring) — a coarser,
    cheaper signal than full canonical-position matching, good enough to
    group candidates for human review, not strong enough on its own to
    silently merge detection results."""
    try:
        entities = list(block_def)
    except Exception:
        return None
    if not entities:
        return None
    type_counts = tuple(sorted(Counter(e.dxftype() for e in entities).items()))
    radii = []
    lengths = []
    for e in entities:
        t = e.dxftype()
        if t == "CIRCLE":
            r = _safe(lambda e=e: float(e.dxf.radius))
            if r:
                radii.append(round(r, 1))
        elif t == "LINE":
            s, en = _safe(lambda e=e: (e.dxf.start, e.dxf.end)), None
            if s:
                start, end = s
                length = ((start.x - end.x) ** 2 + (start.y - end.y) ** 2) ** 0.5
                lengths.append(round(length, 1))
    sig = (type_counts, tuple(sorted(radii)), tuple(sorted(lengths)))
    return repr(sig)


@dataclass
class BlockInventoryEntry:
    name: str
    is_anonymous: bool
    is_xref: bool
    top_level_count: int
    total_physical_count: int
    nested_only_count: int
    entity_type_counts: dict[str, int] = field(default_factory=dict)
    attribute_defs: list[str] = field(default_factory=list)
    layers_used: list[str] = field(default_factory=list)
    signature_group: Optional[int] = None
    signature_group_members: list[str] = field(default_factory=list)

    def to_api_dict(self) -> dict:
        return {
            "name": self.name,
            "isAnonymous": self.is_anonymous,
            "isXref": self.is_xref,
            "topLevelCount": self.top_level_count,
            "totalPhysicalCount": self.total_physical_count,
            "nestedOnlyCount": self.nested_only_count,
            "entityTypeCounts": self.entity_type_counts,
            "attributeDefs": self.attribute_defs,
            "layersUsed": self.layers_used,
            "signatureGroup": self.signature_group,
            "signatureGroupMembers": self.signature_group_members,
        }


def build_block_inventory(doc: CadDocument, limit: int = 50) -> list[BlockInventoryEntry]:
    """Top-N Model-Space-reachable blocks by total physical count, each
    carrying its own top-level/nested split, ATTDEF attribute template
    (if any), and a geometry-signature cluster id shared with any other
    block (named or anonymous) that draws the same shape. Diagnostic-only —
    not consumed by the pile/anchor detectors, surfaced via
    `POST /cad/inspect` for development/admin review (see
    CAD_RESEARCH.md's "Raw Inventory Mode" section)."""
    ezdxf_doc = doc.ezdxf_doc
    if ezdxf_doc is None:
        return []

    weighted = compute_weighted_occurrences(doc)
    msp = ezdxf_doc.modelspace()

    top_counts: Counter = Counter()
    insert_layers: dict[str, set[str]] = defaultdict(set)
    for e in msp.query("INSERT"):
        name = _safe(lambda e=e: e.dxf.name)
        if name:
            top_counts[name] += 1
            insert_layers[name].add(_safe(lambda e=e: e.dxf.layer, "0") or "0")

    entries: list[BlockInventoryEntry] = []
    signatures: dict[str, str] = {}
    for name, total in weighted.items():
        if total <= 0 or name.lower() in _SKIP_LAYOUT_BLOCKS:
            continue
        block_def = _safe(lambda: ezdxf_doc.blocks.get(name))
        if block_def is None:
            continue
        entity_counts = Counter(e.dxftype() for e in block_def)
        attribute_defs = [
            _safe(lambda e=e: e.dxf.tag) for e in block_def if e.dxftype() == "ATTDEF"
        ]
        attribute_defs = [t for t in attribute_defs if t]
        is_xref = bool(_safe(lambda: block_def.is_xref, False))
        sig = geometry_signature(block_def)
        if sig:
            signatures[name] = sig

        entries.append(BlockInventoryEntry(
            name=name,
            is_anonymous=name.startswith("*"),
            is_xref=is_xref,
            top_level_count=top_counts.get(name, 0),
            total_physical_count=total,
            nested_only_count=max(0, total - top_counts.get(name, 0)),
            entity_type_counts=dict(entity_counts),
            attribute_defs=attribute_defs,
            layers_used=sorted(insert_layers.get(name, ())),
        ))

    # Geometry-signature clustering: group everything sharing a signature
    # that at least two distinct block names produce (a signature only one
    # block has isn't a "cluster", it's just that block).
    by_sig: dict[str, list[str]] = defaultdict(list)
    for name, sig in signatures.items():
        by_sig[sig].append(name)
    group_id = 0
    sig_to_group: dict[str, int] = {}
    for sig, names in by_sig.items():
        if len(names) < 2:
            continue
        group_id += 1
        sig_to_group[sig] = group_id

    for entry in entries:
        sig = signatures.get(entry.name)
        if sig in sig_to_group:
            entry.signature_group = sig_to_group[sig]
            entry.signature_group_members = sorted(n for n in by_sig[sig] if n != entry.name)

    entries.sort(key=lambda e: -e.total_physical_count)
    return entries[:limit]
