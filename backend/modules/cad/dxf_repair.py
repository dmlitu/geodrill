"""Tolerant DXF recovery.

Real-world DWG->DXF conversion (and hand-edited or otherwise damaged DXF
files) can produce a stream that is *mostly* well-formed but has one or more
corrupted entities — e.g. a legacy/obscure object type a converter doesn't
fully understand, dumping garbage bytes into what should be numeric fields.
ezdxf's own strict reader (and even its `recover` module) aborts the whole
document on the first such tag.

This module implements a generic, format-level resynchronization: DXF is a
flat stream of (group code, value) pairs, and group code ``0`` always starts
a new entity/section/table/EOF. So when a numeric group code's value fails to
parse as the type that code mandates, we drop entities back to the start of
the current group-0 block and resume scanning from the *next* group-0 block
whose value looks like a real DXF name — repeating until the whole document
parses or we give up. This is not specific to any particular file; it is a
straightforward application of the DXF group-code type table.

It is intentionally a last resort: ``CadParser`` only calls this after both
a strict ``ezdxf.readfile`` and ezdxf's own ``recover.readfile`` have failed.
"""
import io
import re
from collections import Counter

import ezdxf
from ezdxf.document import Drawing
from ezdxf.lldxf.const import DXFStructureError

# DXF group-code type table (subset covering the ranges that actually appear
# in real drawings — see the DXF reference "Group Code Value Types").
_FLOAT_CODES = (
    set(range(10, 60)) | set(range(110, 150)) | set(range(210, 240))
    | set(range(460, 470)) | set(range(1010, 1060))
)
_INT_CODES = (
    set(range(60, 80)) | set(range(90, 100)) | set(range(160, 170)) | set(range(170, 180))
    | set(range(270, 300)) | set(range(370, 390)) | set(range(400, 410))
    | set(range(420, 450)) | set(range(1060, 1072))
)
# A real DXF group-0 value (entity/section/table name) is always a bare
# uppercase-ish identifier. Requiring this shape when hunting for the next
# resync point guards against stray "0" lines that show up *inside* garbled
# binary data by coincidence.
_NAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]{1,60}$")

MAX_REPAIR_ROUNDS = 15
MAX_ENTITIES_DROPPED = 500  # sanity cap — beyond this the file is too damaged to trust


class DxfUnrecoverableError(RuntimeError):
    pass


def _repair_pass(text: str) -> tuple[str, Counter]:
    """One resynchronization scan. Returns (possibly-shorter) DXF text and a
    Counter of {entity_type: count} that were dropped in this pass."""
    lines = text.splitlines()
    n = len(lines)
    out: list[str] = []
    entity_start = None
    entity_name = None
    dropped: Counter = Counter()
    i = 0
    while i < n:
        code_line = lines[i]
        if i + 1 >= n:
            out.append(code_line)
            i += 1
            continue
        value_line = lines[i + 1]
        try:
            code = int(code_line.strip())
        except ValueError:
            # Not a tag boundary at all (shouldn't normally happen) — pass through.
            out.append(code_line)
            i += 1
            continue

        if code == 0 and _NAME_RE.match(value_line.strip()):
            entity_start = len(out)
            entity_name = value_line.strip()

        v = value_line.strip()
        valid = True
        if code in _FLOAT_CODES:
            try:
                float(v)
            except ValueError:
                valid = False
        elif code in _INT_CODES:
            try:
                int(v)
            except ValueError:
                valid = False

        if not valid:
            j = i + 2
            while j < n - 1:
                if lines[j].strip() == "0" and _NAME_RE.match(lines[j + 1].strip()):
                    break
                j += 1
            if entity_start is not None:
                del out[entity_start:]
                dropped[entity_name or "?"] += 1
            else:
                dropped["<header/preamble>"] += 1
            i = j
            entity_start = None
            continue

        out.append(code_line)
        out.append(value_line)
        i += 2
    return "\n".join(out) + "\n", dropped


def load_dxf_lenient(text: str, max_rounds: int = MAX_REPAIR_ROUNDS):
    """Parse DXF text, repairing corrupted entities as needed.

    Returns (ezdxf.Drawing, dropped_entities: Counter, rounds_used: int).
    Raises DxfUnrecoverableError if the document still won't parse after
    max_rounds repair passes, or if too many entities had to be dropped
    (a signal the file is fundamentally too damaged to trust)."""
    total_dropped: Counter = Counter()
    for round_no in range(max_rounds):
        try:
            return Drawing.read(io.StringIO(text)), total_dropped, round_no
        except DXFStructureError:
            text, dropped = _repair_pass(text)
            if not dropped:
                raise DxfUnrecoverableError(
                    "DXF yapısı bozuk ve otomatik onarım bir ilerleme kaydedemedi."
                )
            total_dropped.update(dropped)
            if sum(total_dropped.values()) > MAX_ENTITIES_DROPPED:
                raise DxfUnrecoverableError(
                    f"Dosyada {sum(total_dropped.values())}'den fazla bozuk eleman tespit edildi; "
                    "dosya güvenilir şekilde onarılamayacak kadar hasarlı."
                )
    # One last honest attempt so the final exception (if any) is ezdxf's own.
    return Drawing.read(io.StringIO(text)), total_dropped, max_rounds
