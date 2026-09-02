"""Normalized, ezdxf-independent CAD document model.

Everything downstream (rule engine, detectors, duplicate resolver, API
response) works against these plain dataclasses rather than ezdxf objects
directly, so the detection logic doesn't care whether the source was a DWG
or a DXF, and could in principle be fed by a different parser later.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class CadPoint:
    x: float
    y: float
    z: float = 0.0

    def as_tuple(self) -> tuple[float, float, float]:
        return (self.x, self.y, self.z)


@dataclass
class CadEntity:
    """One normalized modelspace (or block-definition, or virtual/exploded)
    entity. Not every field applies to every entity_type — irrelevant fields
    stay None."""
    handle: str
    entity_type: str          # "CIRCLE", "LWPOLYLINE", "INSERT", "LINE", ...
    layer: str
    point: Optional[CadPoint] = None       # representative location (center / insertion / midpoint)
    radius: Optional[float] = None
    closed: Optional[bool] = None
    block_name: Optional[str] = None       # INSERT -> referenced block name
    text: Optional[str] = None             # TEXT / MTEXT / ATTRIB content
    vertex_count: Optional[int] = None
    source_path: tuple[str, ...] = field(default_factory=tuple)  # block-nesting breadcrumb, e.g. ("HATLARX",)
    raw: Any = field(default=None, repr=False, compare=False)    # underlying ezdxf entity, not serialized


@dataclass
class CadLayerInfo:
    name: str
    entity_type_counts: dict[str, int] = field(default_factory=dict)

    @property
    def total(self) -> int:
        return sum(self.entity_type_counts.values())


@dataclass
class CadBlockInfo:
    name: str
    entity_type_counts: dict[str, int] = field(default_factory=dict)
    insert_count: int = 0
    is_xref: bool = False
    is_anonymous: bool = False

    @property
    def entity_total(self) -> int:
        return sum(self.entity_type_counts.values())


@dataclass
class CadLayoutStats:
    name: str
    entity_type_counts: dict[str, int] = field(default_factory=dict)

    @property
    def total(self) -> int:
        return sum(self.entity_type_counts.values())


@dataclass
class CadDocument:
    filename: str
    dxf_version: str
    units: str                              # "mm" | "cm" | "m" | "in" | "ft" | "unknown"
    unit_source: str                        # "header" | "assumed"
    model_space_entities: list[CadEntity] = field(default_factory=list)
    layers: dict[str, CadLayerInfo] = field(default_factory=dict)
    blocks: dict[str, CadBlockInfo] = field(default_factory=dict)
    texts: list[CadEntity] = field(default_factory=list)          # TEXT/MTEXT/ATTRIB subset, with points
    paper_space_layouts: list[CadLayoutStats] = field(default_factory=list)
    xref_blocks: list[str] = field(default_factory=list)
    extents: Optional[tuple[CadPoint, CadPoint]] = None
    repaired_entities_dropped: dict[str, int] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    # kept for detectors that need direct ezdxf access (block virtual_entities etc.)
    ezdxf_doc: Any = field(default=None, repr=False, compare=False)

    def extents_span(self) -> float:
        """A characteristic drawing size, used to pick a sane spatial-grid
        cell size when $EXTMIN/$EXTMAX are unavailable or degenerate."""
        if self.extents:
            lo, hi = self.extents
            span = max(abs(hi.x - lo.x), abs(hi.y - lo.y))
            if span > 0:
                return span / 100
        return 50.0
