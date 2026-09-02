"""CadParser: untrusted upload bytes -> normalized CadDocument.

This is the only module that talks to ezdxf directly for *loading* a
document; everything else (rule engine, detectors, resolver) works against
the ``document.CadDocument`` model, so parsing concerns never leak into
business logic (and vice versa — swapping the parsing backend later
shouldn't touch detection code).
"""
from __future__ import annotations

import io
import logging

from ezdxf import recover
from ezdxf.document import Drawing
from ezdxf.lldxf.const import DXFStructureError

from . import dxf_repair
from .document import (
    CadBlockInfo, CadDocument, CadEntity, CadLayerInfo, CadLayoutStats, CadPoint,
)
from .dwg_converter import DwgConversionFailed, DwgConverterUnavailable, dwg_bytes_to_dxf_text
from .security import CadUploadError, validate_upload

logger = logging.getLogger("geodrill.cad")

_INSUNITS = {
    0: "unknown", 1: "in", 2: "ft", 3: "mi", 4: "mm", 5: "cm", 6: "m", 7: "km",
    8: "microin", 9: "mil", 10: "yd", 13: "um", 14: "dm", 16: "hm",
}

# Entity types we bother extracting a representative geometry point + extra
# attributes for. Anything else is still counted in stats but otherwise
# passed through with point=None — "unknown entity handling" degrades to
# "counted, not geometrically analyzed" rather than crashing.
_TEXT_TYPES = {"TEXT", "MTEXT", "ATTRIB"}


class CadParseError(RuntimeError):
    """Wraps every failure mode below into one type the router can map to a
    clean 400 response instead of a 500 crash."""


def _safe(fn, default=None):
    try:
        return fn()
    except Exception:
        return default


def _entity_point(e, etype: str) -> CadPoint | None:
    try:
        if etype == "CIRCLE":
            c = e.dxf.center
            return CadPoint(c.x, c.y, getattr(c, "z", 0.0) or 0.0)
        if etype == "ARC":
            c = e.dxf.center
            return CadPoint(c.x, c.y, getattr(c, "z", 0.0) or 0.0)
        if etype == "INSERT":
            p = e.dxf.insert
            return CadPoint(p.x, p.y, getattr(p, "z", 0.0) or 0.0)
        if etype in _TEXT_TYPES:
            p = e.dxf.insert if e.dxf.hasattr("insert") else getattr(e.dxf, "align_point", None)
            if p is None:
                return None
            return CadPoint(p.x, p.y, getattr(p, "z", 0.0) or 0.0)
        if etype in ("LWPOLYLINE", "POLYLINE"):
            pts = list(e.vertices()) if etype == "POLYLINE" else [v[:2] for v in e.get_points()]
            if not pts:
                return None
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            return CadPoint(sum(xs) / len(xs), sum(ys) / len(ys), 0.0)
        if etype == "LINE":
            s, en = e.dxf.start, e.dxf.end
            return CadPoint((s.x + en.x) / 2, (s.y + en.y) / 2, 0.0)
        if etype == "POINT":
            p = e.dxf.location
            return CadPoint(p.x, p.y, getattr(p, "z", 0.0) or 0.0)
        if etype == "HATCH":
            bbox = _safe(lambda: e.paths.bbox()) if hasattr(e, "paths") else None
            if bbox and bbox.has_data:
                return CadPoint((bbox.extmin.x + bbox.extmax.x) / 2, (bbox.extmin.y + bbox.extmax.y) / 2, 0.0)
            return None
        if etype == "DIMENSION":
            p = _safe(lambda: e.dxf.defpoint)
            if p is None:
                return None
            return CadPoint(p.x, p.y, getattr(p, "z", 0.0) or 0.0)
    except Exception:
        return None
    return None


def _entity_to_cad_entity(e, path: tuple[str, ...] = ()) -> CadEntity:
    etype = e.dxftype()
    layer = _safe(lambda: e.dxf.layer, "0") or "0"
    handle = _safe(lambda: e.dxf.handle, "") or ""
    ce = CadEntity(handle=handle, entity_type=etype, layer=layer, source_path=path)
    ce.point = _entity_point(e, etype)

    if etype == "CIRCLE":
        ce.radius = _safe(lambda: float(e.dxf.radius))
    elif etype == "INSERT":
        ce.block_name = _safe(lambda: e.dxf.name)
    elif etype in _TEXT_TYPES:
        if etype == "MTEXT":
            ce.text = _safe(lambda: e.plain_text(), "") or ""
        else:
            ce.text = _safe(lambda: e.dxf.text, "") or ""
    elif etype in ("LWPOLYLINE", "POLYLINE"):
        ce.closed = _safe(lambda: bool(e.closed), None)
        ce.vertex_count = _safe(lambda: len(list(e.vertices())) if etype == "POLYLINE" else len(e), None)
    return ce


def _load_document_text(text: str, filename: str):
    """Strict -> ezdxf.recover -> our own lenient repair, in that order.
    Returns (ezdxf.Drawing, warnings: list[str], dropped: dict[str,int])."""
    warnings: list[str] = []
    dropped: dict[str, int] = {}
    try:
        return Drawing.read(io.StringIO(text)), warnings, dropped
    except DXFStructureError as e1:
        logger.info("CAD: strict DXF parse failed for %s (%s), trying recover mode", filename, e1)

    try:
        doc, auditor = recover.read(io.BytesIO(text.encode("utf-8", errors="replace")))
        if auditor and auditor.has_errors:
            warnings.append(f"DXF kurtarma modu {len(auditor.errors)} yapısal sorunu onardı.")
        return doc, warnings, dropped
    except Exception as e2:
        logger.info("CAD: ezdxf.recover also failed for %s (%s), trying lenient repair", filename, e2)

    try:
        doc, dropped_counter, rounds = dxf_repair.load_dxf_lenient(text)
        if dropped_counter:
            total = sum(dropped_counter.values())
            detail = ", ".join(f"{k}×{v}" for k, v in dropped_counter.most_common())
            warnings.append(
                f"Dosyada {total} bozuk/okunamayan eleman atlanarak onarım yapıldı ({detail}). "
                "Bu elemanlar kazık/ankraj tespitine dahil edilmedi; sonuçları temkinli değerlendirin."
            )
        return doc, warnings, dict(dropped_counter)
    except dxf_repair.DxfUnrecoverableError as e3:
        raise CadParseError(f"CAD dosyası okunamadı, format ciddi şekilde bozuk: {e3}")


class CadParser:
    """parse(data, filename) -> CadDocument. Never raises anything other than
    CadParseError (upload/format problems) — those get mapped to HTTP 400 by
    the router; anything truly unexpected still bubbles up to the app's
    global exception handler as a 500, but doesn't take the process down."""

    def parse(self, data: bytes, filename: str) -> CadDocument:
        try:
            file_type = validate_upload(filename, data)
        except CadUploadError as e:
            raise CadParseError(str(e))

        if file_type == "dwg":
            try:
                dxf_text = dwg_bytes_to_dxf_text(data, filename)
            except (DwgConverterUnavailable, DwgConversionFailed) as e:
                raise CadParseError(str(e))
        else:
            dxf_text = data.decode("utf-8", errors="replace")

        try:
            doc, warnings, dropped = _load_document_text(dxf_text, filename)
        except CadParseError:
            raise
        except Exception as e:
            raise CadParseError(f"CAD dosyası ayrıştırılamadı: {e}")

        return self._normalize(doc, filename, warnings, dropped)

    def _normalize(self, doc, filename: str, warnings: list[str], dropped: dict[str, int]) -> CadDocument:
        insunits = _safe(lambda: int(doc.header.get("$INSUNITS", 0)), 0)
        units = _INSUNITS.get(insunits, "unknown")

        cad_doc = CadDocument(
            filename=filename,
            dxf_version=_safe(lambda: doc.dxfversion, "unknown") or "unknown",
            units=units,
            unit_source="header" if units != "unknown" else "unknown",
            ezdxf_doc=doc,
            warnings=list(warnings),
            repaired_entities_dropped=dropped,
        )

        # Seed the layer catalog with every *defined* layer (incl. unused ones —
        # useful for the diagnostic report), then tally modelspace usage.
        for layer in _safe(lambda: list(doc.layers), []):
            name = _safe(lambda: layer.dxf.name, None)
            if name:
                cad_doc.layers[name] = CadLayerInfo(name=name)

        msp = doc.modelspace()
        for e in msp:
            etype = e.dxftype()
            ce = _entity_to_cad_entity(e)
            cad_doc.model_space_entities.append(ce)

            layer_info = cad_doc.layers.setdefault(ce.layer, CadLayerInfo(name=ce.layer))
            layer_info.entity_type_counts[etype] = layer_info.entity_type_counts.get(etype, 0) + 1

            if etype in _TEXT_TYPES and ce.text:
                cad_doc.texts.append(ce)

        # Block catalog: definition stats + top-level modelspace insert counts.
        insert_counts: dict[str, int] = {}
        for e in msp.query("INSERT"):
            name = _safe(lambda: e.dxf.name)
            if name:
                insert_counts[name] = insert_counts.get(name, 0) + 1

        for block in _safe(lambda: list(doc.blocks), []):
            name = block.name
            is_anon = name.startswith("*")
            n_insert = insert_counts.get(name, 0)
            if is_anon and n_insert == 0:
                continue  # internal/dimension-associative scaffolding, not user content
            info = CadBlockInfo(name=name, insert_count=n_insert, is_anonymous=is_anon)
            info.is_xref = bool(_safe(lambda: block.is_xref, False))
            for be in _safe(lambda: list(block), []):
                bt = be.dxftype()
                info.entity_type_counts[bt] = info.entity_type_counts.get(bt, 0) + 1
            cad_doc.blocks[name] = info
            if info.is_xref:
                cad_doc.xref_blocks.append(name)
                cad_doc.warnings.append(
                    f"XREF (dış referans) bulundu: '{name}'. Kaynak dosyaya erişilemiyorsa içeriği "
                    "eksik sayılabilir; bu blok sessizce tam sayılmış gibi gösterilmez."
                )

        # Paper space layouts — reported for diagnostics, excluded from structural counts.
        for layout_name in _safe(lambda: [l.name for l in doc.layouts if l.name.lower() != "model"], []):
            layout = doc.layouts.get(layout_name)
            stats = CadLayoutStats(name=layout_name)
            for e in _safe(lambda: list(layout), []):
                t = e.dxftype()
                stats.entity_type_counts[t] = stats.entity_type_counts.get(t, 0) + 1
            cad_doc.paper_space_layouts.append(stats)

        extmin = _safe(lambda: doc.header.get("$EXTMIN"))
        extmax = _safe(lambda: doc.header.get("$EXTMAX"))
        if extmin and extmax and tuple(extmin) != tuple(extmax):
            cad_doc.extents = (
                CadPoint(extmin[0], extmin[1], extmin[2] if len(extmin) > 2 else 0.0),
                CadPoint(extmax[0], extmax[1], extmax[2] if len(extmax) > 2 else 0.0),
            )

        if units == "unknown":
            cad_doc.warnings.append(
                "Çizim birimi (INSUNITS) belirlenemedi; tolerans ve çap hesapları "
                "'unknown' birim varsayımıyla yapılacak, sonuçları temkinli değerlendirin."
            )

        return cad_doc
