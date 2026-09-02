# GeoDrill — System Audit

Snapshot of the system as found, before any security work in this pass. Written 2026-09-02.

## Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19.2 (Vite 8, no client-side router — single-page state machine in `App.jsx`) |
| Backend framework | FastAPI 0.135.2 (Python 3.13) |
| Runtime | Python 3.13 (backend), Node/Vite build → static assets (frontend) |
| Database | PostgreSQL (Neon, production) / SQLite (local dev) via SQLAlchemy 2.0 ORM |
| ORM | SQLAlchemy 2.0.48, `DeclarativeBase` models, no raw SQL in app code |
| Authentication | JWT (HS256, python-jose), bcrypt password hashing, `OAuth2PasswordBearer` |
| Authorization | Per-row `owner_id`/`user_id` filtering in every query — no separate authz layer/framework |
| API structure | REST-ish, resource-nested (`/projects/{id}/soil-layers`, `/projects/{id}/cad/analyze`, …), FastAPI routers per domain |
| File upload | `python-multipart` via FastAPI `UploadFile`; PDF (soil-log import), DWG/DXF (CAD analysis) — both processed in memory / throwaway temp dirs, nothing persisted to disk long-term |
| Storage | No object storage / S3 — uploads are never written to permanent disk; PDFs/CSVs are generated on the fly and streamed |
| Env vars | `SECRET_KEY`, `DATABASE_URL`, `ALLOWED_ORIGINS`, `ANTHROPIC_API_KEY`, `ENV`, `LOG_LEVEL`, `GEODRILL_DWG_CONVERTER` (+ related CAD env vars) |
| Deployment | Render (backend, native Python runtime, `render.yaml`), Vercel (frontend static build) |
| Build system | Vite (frontend), pip/venv (backend) — no monorepo tool, no Docker |
| Package manager | npm (frontend), pip (backend) |
| External services | Anthropic API (Claude — PDF soil-log parsing only), Neon Postgres |
| Email | None. No transactional email of any kind (no verification, no password reset). |
| Logging | Python `logging`, `logging.basicConfig` to stdout, per-module loggers (`geodrill.*`) |
| Error handling | Global FastAPI exception handler returns a generic 500 + server-side log; per-router `try/except` around specific failure modes |
| Cache | None (no Redis/memcached) |
| Background jobs | None (no queue/worker) |
| User roles | `role` on `User`: `owner`/`admin`/`member` — scoped to **company** membership only (subscription/plan management), never used to gate access to another user's projects/equipment/analyses, which are always scoped by `owner_id`/`user_id` |
| Admin functions | No admin panel or admin-only data-access endpoints exist |
| Public endpoints | `POST /auth/login`, `POST /auth/register`, `GET /`, `GET /health` |
| Private endpoints | Everything else — behind `Depends(get_current_user)` |
| Engineering calc modules | `backend/modules/calculations/` (`engine.py`, `soil_resistance.py`) + mirrored `frontend/src/hesaplamalar.js`; coefficients in `backend/configs/geotech_coefficients.py` |

## Directory Map (security-relevant)

```
backend/
  auth.py                 JWT + bcrypt, SECRET_KEY enforcement
  database.py              Engine/session factory
  main.py                  CORS, security headers, global exception handler, lifespan/migrations
  models.py                ORM models (ownership columns: owner_id / user_id)
  schemas.py                Pydantic request/response schemas (whitelist — no mass assignment)
  routers/
    auth.py                 login/register/me (rate-limited)
    projects.py, soil.py, equipment.py, analyses.py, cost.py, reports.py, dashboard.py
                             — all filter by current_user.id
    companies.py             company/subscription management (role-gated within a company)
    soil_import.py           PDF upload → Claude API → soil layers
    cad.py                   DWG/DXF upload → pile/anchor detection (added this session, previous conversation)
  modules/
    calculations/            engineering formulas — NOT touched by this audit
    cad/                      DWG/DXF parsing + detection engine — NOT touched functionally,
                               only its error-message/logging safety hardened this pass
frontend/
  src/api.js                 Single backend gateway — JWT injection, timeout, retry, case conversion
  src/App.jsx                 Auth state, routing-by-state, localStorage token/session
  src/*.jsx                   Page components — no dangerouslySetInnerHTML / innerHTML anywhere in the tree
```

## Auth Flow (as found)

1. `POST /auth/register` — creates a `User` (bcrypt-hashed password), optional company auto-create.
2. `POST /auth/login` — OAuth2 password form → `authenticate_user()` → JWT (`sub=username`, 8h expiry) → `{access_token, token_type}`.
3. Frontend stores the JWT in `localStorage` (`gd_token`) and attaches `Authorization: Bearer <token>` on every request via `api.js`.
3. Every protected route depends on `get_current_user`, which decodes the JWT and re-loads the `User` row (`is_active` re-checked live).
4. Logout is client-side only (`localStorage.removeItem`) — JWTs are stateless, no server-side revocation list.
5. No password-reset flow, no email verification flow — neither exists in the codebase (not "broken", simply not implemented).

## Baseline (pre-audit)

- Backend: `pytest tests/` → 167 passed, 0 failed (before this session's new tests were added).
- Frontend: `npm run build` clean, `npm run lint` clean (0 warnings/errors), `npm run test` (vitest) → 42 passed.
- No pre-existing failing tests were found — the codebase was in a green state going into this audit.
- One **pre-existing, unrelated** issue was hit while preparing to test locally: `main.py`'s `_run_schema_migrations()` uses `ALTER TABLE … ADD COLUMN IF NOT EXISTS`, which is valid PostgreSQL syntax but **not valid SQLite syntax** — every migration silently fails (logged as a warning) against a local SQLite dev DB created before the newest columns existed. This does not affect production (Postgres) and is not a security issue; it's noted here for completeness since it was observed, not introduced, during this pass. Not fixed in this pass (schema-migration behavior change requires a product decision, see `SECURITY_AUDIT.md` → Requires Manual Decision).
