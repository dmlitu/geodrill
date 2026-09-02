"""Spatial indexing + geometric clustering helpers.

Real engineering DWGs can carry tens of thousands of entities; naive
all-pairs comparison (duplicate resolution, text-proximity lookup) would be
O(n²). A uniform grid keyed by (x // cell_size, y // cell_size) gives
amortized O(1) neighbor queries without pulling in a full R-tree dependency.
"""
from __future__ import annotations

import statistics
from collections import defaultdict
from typing import Generic, Iterable, TypeVar

T = TypeVar("T")


class SpatialGrid(Generic[T]):
    def __init__(self, cell_size: float):
        self.cell_size = max(cell_size, 1e-9)
        self._cells: dict[tuple[int, int], list[tuple[float, float, T]]] = defaultdict(list)

    def _key(self, x: float, y: float) -> tuple[int, int]:
        return (int(x // self.cell_size), int(y // self.cell_size))

    def add(self, x: float, y: float, item: T) -> None:
        self._cells[self._key(x, y)].append((x, y, item))

    def query_radius(self, x: float, y: float, radius: float) -> Iterable[tuple[float, float, T]]:
        cx, cy = self._key(x, y)
        span = int(radius // self.cell_size) + 1
        r2 = radius * radius
        for dx in range(-span, span + 1):
            for dy in range(-span, span + 1):
                for (px, py, item) in self._cells.get((cx + dx, cy + dy), ()):
                    if (px - x) ** 2 + (py - y) ** 2 <= r2:
                        yield (px, py, item)


def radius_clusters(radii: list[float], rel_tolerance: float = 0.03) -> list[list[int]]:
    """Group circle-radius indices into clusters of (near-)equal radius —
    the geometric signature of a row of same-diameter piles. Returns a list
    of index-lists into the input `radii`, sorted radius ascending."""
    order = sorted(range(len(radii)), key=lambda i: radii[i])
    clusters: list[list[int]] = []
    current: list[int] = []
    for idx in order:
        if not current:
            current = [idx]
            continue
        ref = statistics.mean(radii[i] for i in current)
        if ref > 0 and abs(radii[idx] - ref) / ref <= rel_tolerance:
            current.append(idx)
        else:
            clusters.append(current)
            current = [idx]
    if current:
        clusters.append(current)
    return clusters
