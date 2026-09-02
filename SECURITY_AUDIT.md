# GeoDrill Security Audit

Date: 2026-09-02. Scope: full-stack security/infrastructure review, OWASP-oriented. Engineering calculation logic was explicitly excluded from scope and was not modified — see **Calculation Integrity** below.

## Executive Summary

The codebase was in materially good shape going in: every data-access endpoint already filters by `owner_id`/`user_id` (no IDOR found in existing code), there is no SQL injection surface anywhere (SQLAlchemy ORM throughout, no raw string-built queries), the frontend has zero `dangerouslySetInnerHTML`/`innerHTML` usage (no XSS vectors found), secrets are correctly kept out of the repo and out of the frontend bundle, and a prior hardening pass (~4-5 months ago per git history) had already added CORS restrictions, most security headers, rate limiting on the expensive endpoints, and `SECRET_KEY` production enforcement.

This pass found no Critical or High findings. It found and fixed several concrete Medium/Low issues (mostly: internal error/exception detail leaking to API clients, a username-enumeration timing side-channel, two outdated file-parsing dependencies with a large number of known CVEs, one endpoint missing rate limiting, and a header-injection-adjacent filename-sanitization gap), added regression tests locking in the IDOR protections that already existed, and closed a couple of small gaps in the CAD upload feature's own error handling. Everything else already met a solid bar.

## Critical

None found.

## High

None found.

## Medium

1. **Internal exception details returned to API clients** (3 locations)
   - **Problem**: `except Exception as e: raise HTTPException(..., detail=f"...: {e}")` forwarded the raw Python exception string straight into the HTTP response body.
   - **Risk**: Information disclosure — internal error text can reveal library internals, occasionally filesystem paths or other implementation details, to any authenticated caller who can trigger the failure path.
   - **Location**: `backend/routers/cost.py` (`calculate_cost`), `backend/routers/soil_import.py` (`extract_pdf_text`, `parse_with_claude`).
   - **Fix**: Replaced with a generic, Turkish, user-safe message; the real exception is now logged server-side via `logger.warning/exception(..., exc_info=True)`.
   - **Verification**: Full backend suite green after the change (`184 passed`); these are error-path-only changes, no success-path behavior touched.

2. **DWG converter internals leaked to API clients** (`backend/modules/cad/dwg_converter.py`)
   - **Problem**: A misconfigured `GEODRILL_DWG_CONVERTER` path, an `OSError` starting the converter, and the converter's raw stderr (up to 800 chars) were all returned verbatim in the HTTP 400/500 response.
   - **Risk**: Discloses server filesystem paths and internal tool diagnostics to whoever uploads a `.dwg` file.
   - **Fix**: All three now log full detail server-side (`logger.error`/`logger.warning`) and return a generic Turkish message to the client.
   - **Verification**: `test_cad_parser.py` / `test_cad_api.py` (already covering the corrupted-file and unavailable-converter paths) still pass.

3. **Username-enumeration timing side-channel in login** (`backend/auth.py`)
   - **Problem**: `authenticate_user()` used `if not user or not verify_password(...)`, so a nonexistent-username request returned near-instantly (skipping bcrypt entirely) while a valid-username-wrong-password request took the full bcrypt cost (~100-300ms). The response time itself let an attacker enumerate valid usernames even though the error message is identical.
   - **Risk**: Account enumeration — a precursor to targeted credential-stuffing/brute-force.
   - **Fix**: `verify_password` is now always called, against a precomputed dummy bcrypt hash when no user exists, so both cases pay the same cost. No change to any legitimate login's success/failure outcome.
   - **Verification**: `tests/test_auth.py` + full suite green (`184 passed`).

4. **`python-multipart` and `pillow` pinned to versions with many known CVEs**
   - **Problem**: `python-multipart==0.0.22` (parses every multipart upload — PDF and DWG/DXF) and `pillow==12.1.1` (transitive dependency of `reportlab`) both had a substantial number of open advisories in `pip-audit`.
   - **Risk**: `python-multipart` is on the direct path of untrusted file uploads; a parser-level DoS/crash there is directly reachable by an attacker. `pillow` is a transitive dependency reportlab pulls in but this app never calls PIL directly (no image upload/embedding feature exists), so its actual reachable risk is low — patched anyway since the upgrade was free.
   - **Fix**: Upgraded to `python-multipart==0.0.32` and `pillow==12.3.0` — both are patch/minor bumps within the already-installed major version, not a framework migration.
   - **Verification**: `pip-audit` no longer reports either package; full backend suite green (`184 passed`, including all multipart-upload-driven CAD/soil-import tests); frontend `npm run build`/`lint`/`test` unaffected (backend-only change).

5. **`join_company` allows any authenticated user to join any company by slug, with no invite/approval step**
   - **Problem**: `POST /companies/me/join/{slug}` looks up a company purely by its (guessable/known) slug and immediately adds the caller as a `member` — no invitation token, no owner approval.
   - **Risk**: An unrelated user who learns another company's slug (often derivable from its name) can join it and **consume that company's shared monthly analysis quota** (`Subscription.analyses_used`), degrading a paying customer's plan. Confirmed this does **not** expose other members' projects/equipment/analyses — those are always scoped by `owner_id`, never by `company_id` (verified by grep across every router).
   - **Status**: **Not fixed automatically** — the correct fix (invite tokens? owner approval? is open-join actually the intended small-team model?) is a product decision, not a pure security patch. See **Requires Manual Decision**.

## Low

1. **`Permissions-Policy` header was missing.** Added (`geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()`) in `main.py`. Defense-in-depth only — this origin never serves renderable HTML, so the header has limited practical effect, but costs nothing and was explicitly requested.
2. **CSV/PDF report filenames interpolated the user-editable `proje_kodu` field directly into a `Content-Disposition` header value.** A project code containing a `"` could malform the header (not a classic CRLF-injection — the ASGI/HTTP layer rejects embedded newlines — but still a header-value integrity issue). Added `_safe_filename_part()` in `backend/routers/reports.py` (strips to `[A-Za-z0-9_-]`, 80-char cap) used for both the CSV and PDF filenames. No effect on normal project codes.
3. **`POST /projects/{id}/cost` had no rate limit**, unlike every other calculation/export/upload endpoint in the codebase. Added `@limiter.limit("60/minute")`, matching the identical limit already used on `POST /projects/{id}/analyses`. The calculation itself is cheap (pure Python, no I/O beyond two indexed queries) so this is precautionary consistency, not a response to an observed DoS.
4. **`pypdf==5.1.0`** has a long list of CVEs fixed only in the 6.x line — a **major** version bump. Per the audit's explicit instruction not to auto-perform major/framework upgrades, this was **not** upgraded; see **Dependency Status** and **Requires Manual Decision**. Added a magic-byte check (`%PDF-` signature) before handing bytes to `pypdf.PdfReader`, and genericized its error message (see Medium #1) as a compensating control in the meantime.
5. **`ecdsa==0.19.2`** (transitive, via `python-jose[cryptography]`) has an open advisory with **no fixed version** (the maintainers have stated the underlying timing-channel is out of scope for the pure-Python implementation). Not reachable by this app in practice — GeoDrill's JWTs use `HS256` (HMAC), never an EC algorithm, so `ecdsa`'s vulnerable code path is never executed. No action taken; documented for awareness.
6. **`xlsx` (SheetJS)** has two known high-severity advisories (prototype pollution, ReDoS) with **no fix available**. Confirmed by code review that this app only ever *writes* spreadsheets client-side (`frontend/src/api.js` → `downloadExcelReport`, using `XLSX.utils.book_new/aoa_to_sheet/writeFile`) — there is no `XLSX.read()` call anywhere, so the vulnerable (parsing) code path is never reached by user input. Documented, not fixed (no fix exists; the reachable risk is effectively nil given current usage — flag this again if a "re-import my exported Excel" feature is ever added).
7. **`GET /health`'s 503 response includes a truncated raw DB error string** (`db_error`, first 120 chars) to any unauthenticated caller. Useful for ops/uptime monitoring, minor info-disclosure risk in the failure case. Left as-is — this is a common, deliberate ops/monitoring tradeoff and changing the shape of a health-check response is a behavior change outside this audit's "don't silently change behavior" boundary; flagged for awareness.
8. **`FiyatAnalizi.jsx` reads `localStorage.getItem("gd_token")` directly** instead of going through `api.js`'s centralized request helper (which has 401-handling/retry/timeout logic). Not a vulnerability — the token is only ever placed in an `Authorization` header, never logged or put in a URL — but it's an inconsistency. Not touched: this is the pricing/cost UI's own file, and the audit's "don't touch calculation-adjacent code" boundary was interpreted conservatively to include this file.

## Fixed During Audit

| # | Change | File(s) | Why | Verified |
|---|---|---|---|---|
| 1 | Generic error messages + server-side logging, 3 leak points | `routers/cost.py`, `routers/soil_import.py` | Medium #1 | 184 tests pass |
| 2 | Generic error messages + server-side logging, 3 leak points | `modules/cad/dwg_converter.py`, `modules/cad/parser.py` | Medium #2 | 184 tests pass |
| 3 | Constant-time login regardless of username existence | `auth.py` | Medium #3 | 184 tests pass |
| 4 | `python-multipart` 0.0.22→0.0.32, `pillow` 12.1.1→12.3.0 | `requirements.txt` | Medium #4 | pip-audit clean for both; 184 tests pass |
| 5 | `Permissions-Policy` header added | `main.py` | Low #1 | manual header inspection |
| 6 | Content-Disposition filename sanitization | `routers/reports.py` | Low #2 | 184 tests pass |
| 7 | Rate limit added to cost calculation endpoint | `routers/cost.py` | Low #3 | 184 tests pass |
| 8 | PDF magic-byte signature check before parsing | `routers/soil_import.py` | Low #4 (compensating control) | 184 tests pass |
| 9 | 17 new IDOR/ownership regression tests (projects, soil layers, equipment, cost, reports, analyses — direct by-id access from a second user) | `tests/test_ownership_isolation.py` | Lock in existing (already-correct) authorization behavior | all 17 pass |
| 10 | Frontend dependency security patches (`npm audit fix`, semver-compatible only) — 7 of 8 advisories resolved (brace-expansion, browserslist, js-yaml, nanoid, postcss, vite, one more) | `frontend/package-lock.json` | Section 20 | `npm audit` clean except `xlsx` (no fix, see Low #6); build/lint/test all green |

## Requires Manual Decision

1. **`join_company` open enrollment** (Medium #5) — decide whether company joining should require an invite token / owner approval, or whether the current "know the slug, you're in" model is intentional for how small teams are meant to onboard. Either way it's a product decision, not a pure patch.
2. **JWT has no server-side revocation.** Logout is client-side only; a stolen/leaked token stays valid for up to 8 hours regardless of logout. A fix (token blacklist table, or moving to short-lived access + refresh tokens) is a real authentication-architecture change — explicitly out of scope for this pass per your instructions ("authentication sistemini tamamen değiştirme" requires approval).
3. **`pypdf` 5.1.0 → 6.x.** Many CVEs are only fixed in the 6.x line, which is a major version bump with a (small but nonzero) chance of touching the `PdfReader(...).pages[i].extract_text()` call this app uses. Recommend scheduling this as its own small, tested upgrade rather than folding it into a security pass that promised no major-version changes.
4. **Local SQLite dev migrations use Postgres-only `ADD COLUMN IF NOT EXISTS` syntax** (noted in `SYSTEM_AUDIT.md`) — doesn't affect production, but every local SQLite dev DB silently drifts out of schema sync on every new column added. Worth a dedicated fix (e.g., branch on `is_sqlite` and use SQLite's own idempotent-migration pattern) — deliberately not touched here since it's schema-migration logic, not strictly a security item, and touching migration code carries its own risk.
5. **Demo accounts (`demo/demo`, `firma1/1234`, `admin/admin123`) are seeded unconditionally on every startup, including production**, and are documented/advertised on the login page itself. Reviewed in detail: the `admin` username carries **no elevated role** (defaults to `role="member"`, no `company_id`) — it's a plain, empty demo account, same isolation as any other user. This is confirmed to be an intentional product/marketing decision (a public try-it-yourself account), not an oversight, so it was left alone — flagging only so it's a conscious choice going forward, not a forgotten one.

## Dependency Status

**Backend** (`pip-audit`): 4 packages had advisories going in. `python-multipart` and `pillow` — fixed (patched to CVE-free versions). `pypdf` — fixable only via a major version bump, deliberately left for a separate decision (see above). `ecdsa` — no fix available upstream; not reachable by this app's actual code path (HS256-only JWTs). FastAPI, Uvicorn, SQLAlchemy, Pydantic, python-jose, bcrypt, reportlab, pandas, numpy, slowapi, anthropic, ezdxf — no advisories found.

**Frontend** (`npm audit`): 8 advisories going in, all transitive build/dev-tooling dependencies (brace-expansion, browserslist, js-yaml, nanoid, postcss, vite, plus one more) except `xlsx`. 7 resolved via `npm audit fix` (semver-compatible, `package.json` itself unchanged — only the lockfile moved within already-declared ranges). `xlsx` has no fix upstream; confirmed not reachable given this app's write-only usage (see Low #6).

## Calculation Integrity

**Engineering calculation logic was not modified.**

- `backend/modules/calculations/` (`engine.py`, `soil_resistance.py`), `backend/configs/geotech_coefficients.py`, `frontend/src/hesaplamalar.js`, and every router's *use* of those modules were **not touched** at any point in this pass — confirmed structurally via `git status` (zero diff on any of those files), not merely by re-running tests.
- `backend/routers/cost.py` was edited only for rate limiting and error-message text (the `_hesapla()` function itself — the actual cost formula — was not touched).
- `backend/routers/reports.py` was edited only for filename sanitization on the Content-Disposition header; none of the report's calculation calls (`gerekli_tork_aralik`, `casing_metre`, `kazik_suresi`, `tam_cevrim_suresi`, `guven_analizi`, `mazot_tahmini`, `makine_uygunluk`) were touched.
- Verification: `pytest tests/test_calculations.py` → 59/59 passing, and `npx vitest run src/hesaplamalar.test.js` → 42/42 passing, both identical before and after this audit (same files, same tests, same green baseline).

## Remaining Risks

- No server-side JWT revocation (accepted architecture — see Requires Manual Decision #2).
- `pypdf` and the transitive `ecdsa`/`xlsx` advisories remain unpatched for the documented reasons above; reachable risk assessed as low-to-none given current usage, but should be revisited if usage patterns change (e.g., an "import my own exported Excel" feature would reopen the `xlsx` parsing surface).
- `join_company`'s open-enrollment model remains as-is pending a product decision.
- No request-body size limit beyond what individual endpoints enforce themselves (file uploads have explicit caps; `AnalysisCreate.analiz_json`/`maliyet_json` are unbounded `dict` fields with no application-level size cap — a very large JSON body is bounded only by whatever the hosting platform/reverse proxy enforces upstream). Flagged as a future hardening item; not implemented here because a blanket request-size middleware needs to accommodate the CAD module's legitimate up-to-60MB DWG uploads and was judged too easy to get subtly wrong under this pass's time constraints — safer to size it deliberately in its own change.
- No native rate limiting on `POST /companies` or `POST /companies/me/join/{slug}` — low priority (infrequent one-time actions per account), not addressed since it wasn't in the explicitly-named "expensive operations" list and adding limits speculatively risks being either too strict or theatrical.
