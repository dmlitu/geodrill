# GeoDrill backend — FastAPI app + GNU LibreDWG (dwg2dxf), built from source.
#
# Why Docker at all: Render's native Python runtime has no apt/system-package
# access (confirmed — https://render.com/docs/native-runtimes), and dwg2dxf
# is a compiled C binary, not something pip can install. This is the only
# way to get real .dwg support in production without asking every deploy
# operator to hand-install something.
#
# Why build from source instead of `apt-get install libredwg-tools`:
# LibreDWG is not packaged in Debian/Ubuntu at all (checked — no such
# package). The official GNU release tarball ships a pre-generated
# `configure` script, so building it needs nothing beyond a C compiler,
# make, and pkg-config — no autoconf/automake/libtool required.

# ── Stage 1: build dwg2dxf ───────────────────────────────────────────────
# Same base image as the runtime stage so the compiled binary's glibc ABI
# always matches what it will actually run against.
FROM python:3.13-slim AS dwg2dxf-builder
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

ARG LIBREDWG_VERSION=0.14
# Pinned SHA-256 of libredwg-0.14.tar.gz from https://ftp.gnu.org/gnu/libredwg/
# — verified against the upstream release during this change. Bump both the
# version and this checksum together if you ever update LIBREDWG_VERSION.
ARG LIBREDWG_SHA256=cb6ee0b078c6d9e0f09d66f1feac33ba6342df88ae544e9f9335fab475218351

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential pkg-config ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
RUN curl -fsSL -o libredwg.tar.gz \
        "https://ftp.gnu.org/gnu/libredwg/libredwg-${LIBREDWG_VERSION}.tar.gz" \
    && echo "${LIBREDWG_SHA256}  libredwg.tar.gz" | sha256sum -c - \
    && tar xzf libredwg.tar.gz --strip-components=1 \
    && rm libredwg.tar.gz

# --disable-shared: statically link libredwg into dwg2dxf itself, so the
#   final image only needs to copy one file, no separate .so to manage.
# --disable-bindings / --disable-docs: we only need the CLI tool, skip
#   the Python/Perl bindings and texinfo/doxygen docs (fewer build deps).
RUN ./configure --disable-shared --disable-bindings --disable-docs \
    && make -j"$(nproc)" \
    && test -x programs/dwg2dxf   # fail the build now if this didn't actually produce a binary

# ── Stage 2: application image ───────────────────────────────────────────
FROM python:3.13-slim

COPY --from=dwg2dxf-builder /src/programs/dwg2dxf /usr/local/bin/dwg2dxf
RUN chmod 0755 /usr/local/bin/dwg2dxf \
    # Build-time proof the binary actually runs in *this* image, not just
    # in the builder stage — catches a glibc/linking mismatch immediately
    # instead of on the first user's .dwg upload.
    && dwg2dxf --version

# GeoDrill always resolves the converter via this env var first (see
# modules/cad/dwg_converter.py) — explicit beats PATH-guessing in prod.
ENV GEODRILL_DWG_CONVERTER=/usr/local/bin/dwg2dxf
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

RUN useradd --create-home --uid 1000 geodrill
WORKDIR /app

# Separate layer so `pip install` is only re-run when requirements.txt
# actually changes, not on every source-code edit.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chown -R geodrill:geodrill /app
USER geodrill

EXPOSE 10000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-10000}"]
