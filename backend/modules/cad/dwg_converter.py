"""DWG -> DXF conversion via an external converter executable.

ezdxf (and every other Python-native library) cannot read the proprietary
binary DWG format directly, so we shell out to a converter and read the DXF
it produces. The converter path is never hard-coded:

    GEODRILL_DWG_CONVERTER          absolute path to the converter executable
    GEODRILL_DWG_CONVERTER_ARGS     optional override of its CLI argument template

If unset, we look for known converter binaries on PATH, in this order:

    1. ``dwg2dxf``           (GNU LibreDWG — free, open source, what this repo
                               is tested against; ``brew install libredwg`` /
                               apt package ``libredwg-tools``)
    2. ``ODAFileConverter``   (Open Design Alliance's free-of-charge but
                               proprietary converter, if an operator installs
                               it separately — higher DWG-version fidelity)

Upload bytes are never interpolated into a shell string — subprocess.run is
always called with an argv list and shell=False (the default), and every
path used is one we generated ourselves inside a per-request temp directory.
"""
import os
import shutil
import subprocess

from .security import secure_temp_dir, safe_basename

CONVERT_TIMEOUT_SECONDS = int(os.environ.get("GEODRILL_DWG_CONVERT_TIMEOUT", "60"))

_CANDIDATE_TOOLS = ["dwg2dxf", "ODAFileConverter"]


class DwgConverterUnavailable(RuntimeError):
    """No usable DWG->DXF converter is configured/installed on this host."""


class DwgConversionFailed(RuntimeError):
    """The converter ran but did not produce a usable DXF."""


def _resolve_converter() -> str:
    override = os.environ.get("GEODRILL_DWG_CONVERTER")
    if override:
        if not os.path.isfile(override) or not os.access(override, os.X_OK):
            raise DwgConverterUnavailable(
                f"GEODRILL_DWG_CONVERTER ({override}) çalıştırılabilir bir dosya değil."
            )
        return override
    for name in _CANDIDATE_TOOLS:
        found = shutil.which(name)
        if found:
            return found
    raise DwgConverterUnavailable(
        "DWG dosyalarını okumak için bir dönüştürücü bulunamadı. "
        "GEODRILL_DWG_CONVERTER ortam değişkenini bir 'dwg2dxf' (GNU LibreDWG) "
        "veya 'ODAFileConverter' yoluna ayarlayın, ya da .dxf dosyası yükleyin."
    )


def dwg_bytes_to_dxf_text(data: bytes, original_filename: str) -> str:
    """Convert DWG bytes to DXF text using the configured converter.
    Runs entirely inside a throwaway temp directory that is always cleaned
    up. Raises DwgConverterUnavailable / DwgConversionFailed — never lets a
    subprocess crash propagate as a raw exception."""
    converter = _resolve_converter()
    tool_name = os.path.basename(converter).lower()

    with secure_temp_dir() as tmpdir:
        in_name = safe_basename(original_filename, ".dwg")
        in_path = os.path.join(tmpdir, in_name)
        out_path = os.path.splitext(in_path)[0] + ".dxf"

        with open(in_path, "wb") as f:
            f.write(data)

        if "dwg2dxf" in tool_name:
            argv = [converter, "-y", "-o", out_path, in_path]
        elif "odafileconverter" in tool_name:
            # ODAFileConverter's CLI takes an input/output *directory* pair,
            # not a single-file path — convert within the same temp dir.
            argv = [converter, tmpdir, tmpdir, "ACAD2018", "DXF", "0", "1", in_name]
        else:
            argv = [converter, "-y", "-o", out_path, in_path]

        try:
            proc = subprocess.run(
                argv,
                cwd=tmpdir,
                capture_output=True,
                timeout=CONVERT_TIMEOUT_SECONDS,
                shell=False,
            )
        except subprocess.TimeoutExpired:
            raise DwgConversionFailed(
                f"DWG dönüştürme {CONVERT_TIMEOUT_SECONDS} saniye içinde tamamlanamadı (zaman aşımı)."
            )
        except OSError as e:
            raise DwgConverterUnavailable(f"Dönüştürücü çalıştırılamadı: {e}")

        if not os.path.isfile(out_path) or os.path.getsize(out_path) == 0:
            stderr_tail = (proc.stderr or b"").decode("utf-8", errors="replace")[-800:]
            raise DwgConversionFailed(
                "DWG dosyası DXF'e dönüştürülemedi. Dosya bozuk, şifreli veya "
                f"desteklenmeyen bir sürüm olabilir. (converter exit={proc.returncode}) {stderr_tail}"
            )

        with open(out_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
