# CAD test fixtures

This directory intentionally ships empty. Drop real DWG/DXF files here to
exercise `test_cad_real_files.py` locally — it discovers `*.dwg`/`*.dxf`
files in this folder automatically and skips itself if none are present
(including in CI, so no fixture is required to keep the suite green).

Real client project drawings should **not** be committed to git — this
folder (except this file) is gitignored for that reason. Keep fixtures
local, or use synthetic/anonymized DWGs if you want one checked in.
