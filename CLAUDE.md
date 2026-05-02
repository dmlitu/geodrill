# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GeoDrill** is a geotechnical drilling decision support system (Turkish: "Geoteknik Karar Destek Sistemi") for managing pile drilling projects. It calculates torque requirements, casing needs, drilling time, fuel consumption, stability risk, and equipment suitability from soil profile data.

The product is a multi-tenant SaaS with company workspaces, subscription/usage limits, saved analysis snapshots, cost analysis, and a 3-language UI (Turkish, English, Russian).

Engine version: **v3.1** (see `TECHNICAL_CHANGELOG.md`, `ENGINEERING_ASSUMPTIONS.md`, `docs/delgi_suresi_hesap_metodolojisi.md`).

## Commands

### Frontend (React 19 + Vite)
```bash
cd frontend
npm run dev          # Dev server at http://localhost:5173
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest — run all unit tests once
npm run test:watch   # Vitest — watch mode
```

### Backend (FastAPI + SQLAlchemy)
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload         # Dev server at http://localhost:8000
pytest tests/                     # Run all backend tests
pytest tests/test_auth.py -v      # Run a single test file
pytest tests/test_calculations.py::test_specific -v   # Single test
```

API docs available at http://localhost:8000/docs when server is running.

## Architecture

### High-Level Layout

```
geodrill/
├── backend/                # FastAPI + SQLAlchemy (Python 3)
│   ├── routers/            # auth, projects, soil, soil_import, equipment,
│   │                       # reports, companies, analyses, dashboard, cost
│   ├── modules/calculations/  # v3.x calculation engine (engine.py + soil_resistance.py)
│   ├── configs/            # geotech_coefficients.py — KATSAYILAR table
│   ├── tests/              # pytest integration tests (in-memory SQLite)
│   ├── main.py             # App entry, CORS, security headers, lifespan migrations
│   ├── database.py         # Engine, session, get_db
│   ├── models.py           # ORM (Company, Subscription, User, Project,
│   │                       #      SoilLayer, Analysis, Equipment)
│   ├── schemas.py          # Pydantic v2 schemas
│   ├── auth.py             # JWT + bcrypt
│   └── requirements.txt
├── frontend/               # React 19 + Vite SPA
│   ├── src/
│   │   ├── App.jsx         # Root: auth, page routing, sidebar, ErrorBoundary
│   │   ├── api.js          # API client (JWT, snake↔camel, 401 soft logout, 30s timeout)
│   │   ├── hesaplamalar.js # Pure calculation module — mirrors backend engine
│   │   ├── hesaplamalar.test.js  # Vitest unit tests
│   │   ├── i18n.js / LangContext.jsx / locales/{tr,en,ru}.json
│   │   ├── Toast.jsx, ConfirmDialog.jsx
│   │   ├── DemoProje.js, MakineKatalogu.js   # Static demo / catalog data
│   │   └── (page components — see below)
│   └── package.json
├── docs/                   # Methodology notes
├── ENGINEERING_ASSUMPTIONS.md
├── TECHNICAL_CHANGELOG.md
├── render.yaml             # Render deployment manifest
└── CLAUDE.md
```

### Frontend Pages (`frontend/src/`)

Single-page React app. **No client-side router** — `App.jsx` manages page state via `activePage`. State (`proje`, `zemin`, `makineler`) lives in `App.jsx` and flows down as props + setters. Auth via localStorage (`gd_token`, `gd_username`). Top-level `LangProvider` and `ToastProvider` wrap the tree.

Page components:
- **`Dashboard.jsx`** — Landing page after login. Stats, recent analyses, quick actions.
- **`ProjeForm.jsx`** — Project metadata editor.
- **`ZeminLogu.jsx`** — Editable soil layer table. v3 fields include CPT qc, su (undrained shear), kaya_durumu (rock mass quality).
- **`MakinePark.jsx`** — Equipment fleet CRUD (bulk save). v3 fields: crowd_force, kelly_uzunluk.
- **`ProjeKalibrasyonu.jsx`** — Engine calibration / coefficient overrides per project.
- **`AnalizSonucu.jsx`** — Read-only analysis results page; uses `useMemo` to derive metrics from `hesaplamalar.js`.
- **`FiyatAnalizi.jsx`** — Cost analysis (concrete, rebar, labor, fuel) — persisted via `cost` router as `maliyet_json`.
- **`OncekiAnalizler.jsx`** — Saved analysis snapshots browser (the `Analysis` table).
- **`Gorseller.jsx`** — Visualization library: ZeminProfilDiyagrami (SVG), TorkDerinlikGrafigi (Recharts), GanttSemasi (SVG), SenaryoKarsilastirma (Recharts dual-axis).
- **`Onboarding.jsx`** — First-run wizard.
- **`Ayarlar.jsx`** — Settings (account, language, company).
- **`LandingPage.jsx`** — Public marketing page.
- **`RegisterPage.jsx`** / **`BlogPost.jsx`** — Public pages.

Several non-critical pages are lazy-loaded via `React.lazy` + `Suspense` with a `SkeletonLoader` fallback.

### Backend Routers (`backend/routers/`)

| File | Responsibility |
|---|---|
| `auth.py` | `POST /auth/login` (rate-limited via slowapi), `POST /auth/register`, `GET /auth/me` |
| `projects.py` | Full CRUD; list returns `ProjectSummary` sorted by `updated_at` DESC; all queries filter by `owner_id` for multi-tenancy |
| `soil.py` | `GET` list, `PUT /bulk` (delete-all + insert transaction) |
| `soil_import.py` | Bulk import from CSV/XLSX uploads |
| `equipment.py` | CRUD + `PUT /bulk` (same delete-all + insert pattern) |
| `reports.py` | `GET /report` (ReportLab PDF), `GET /soil-layers/export` (Pandas CSV). Re-runs calculations server-side via the engine module |
| `companies.py` | Company / tenant management |
| `analyses.py` | Save / list / fetch analysis snapshots — stores full engine output as `analiz_json` |
| `dashboard.py` | Aggregated stats for the Dashboard page |
| `cost.py` | Cost analysis persistence (linked to an Analysis row) |

### Calculation Engine

The geotechnical formulas exist in **two parallel implementations** that must stay in sync:

1. **Frontend**: `frontend/src/hesaplamalar.js` — pure module, no React/DOM deps.
2. **Backend**: `backend/modules/calculations/engine.py` (+ `soil_resistance.py`) — used by `reports.py` and `analyses.py`.

The shared coefficient table is in `backend/configs/geotech_coefficients.py` (`KATSAYILAR`). Frontend mirrors these constants inline.

**Key v3.x principles** (see `engine.py` docstring):
- Torque formula: `T = tau_eff × (π × D³ / 8) × K_app × K_method × K_gw × K_depth × K_uncertainty`
- Resistance pathway priority: rock → su → CPT → SPT → inferred
- Four-band equipment suitability: RAHAT UYGUN / UYGUN / SINIRDA / UYGUN DEĞİL
- Confidence scoring (`guven_analizi`): 0–100 score + A/B/C/D level

**Calculation parity rule:** any change to a formula, coefficient, or band threshold MUST be applied in BOTH `hesaplamalar.js` and `engine.py`. Run `npm run test` (frontend) and `pytest tests/test_calculations.py` (backend) after any change.

### Data Model

Multi-tenant SaaS schema (see `models.py`):
- `Company` (workspace) → has many `User`s; `Subscription` has plan/limits and monthly `analyses_used` counter.
- `User` belongs to a `Company`; has many `Project`s, `Equipment`, `Analysis`s.
- `Project` → many `SoilLayer` (cascade delete, ordered by `baslangic`).
- `Analysis` is a snapshot: stores `analiz_json` (full engine output) and `maliyet_json` (cost). Indexed scalar columns (`tork_max`, `casing_m`, `sure_saat`, `guven_seviyesi`, `risk_ozeti`) speed up dashboard queries.
- `Equipment` is owned by `User` (not `Company`).

### Database Migrations

**No Alembic.** Schema evolves via two mechanisms in `main.py` lifespan:
1. `Base.metadata.create_all()` creates new tables.
2. `_run_schema_migrations()` runs idempotent `ALTER TABLE … ADD COLUMN IF NOT EXISTS` statements in **separate transactions** — important on PostgreSQL where one failed ALTER aborts the whole transaction. When adding a new column to an existing table, append it to that list.

### API & Frontend Plumbing

- `api.js` is the single backend gateway: JWT injection, 30s `AbortController` timeout, `setOnUnauthorized` hook for soft React logout (avoids `window.location.reload()` which would lose state), and snake_case ↔ camelCase conversion via `fromSnake*` / `toSnake*` helpers.
- Backend security headers middleware sets `X-Frame-Options: DENY`, HSTS, etc. Login is rate-limited via `slowapi`.

### Data Flow

1. After login `App.jsx` loads project → soil layers → equipment.
2. Page components receive data as props and call setters on save (which in turn call `api.js`).
3. `AnalizSonucu` is read-only: imports `hesaplamalar.js` and memoizes results.
4. Saving an analysis posts the full engine output to `/analyses` for replay/history.
5. PDF / CSV exports re-run the calculation server-side using `engine.py` to guarantee parity.

## Key Conventions

- All UI text is **Turkish** (with EN/RU translations in `locales/`). Use the `t()` helper from `LangContext` instead of hardcoding strings.
- Variable names mix Turkish and English (`zemin`, `kazikBoyu`, `proje`, `tork`).
- Demo credentials (seeded on startup): `demo/demo`, `firma1/1234`, `admin/admin123`.
- `VITE_API_URL` configures backend URL (default in code points to the Render production API; local dev typically sets it to `http://localhost:8000`).
- Styling: Tailwind CSS 4 (via `@tailwindcss/vite`) plus inline style objects. Design tokens are CSS variables in `index.css`. Fonts: Fraunces (headings), Plus Jakarta Sans (body), DM Mono (code).
- `bcrypt` is **pinned to 4.0.1** for `passlib` compatibility — do not upgrade.
- Soil types (canonical 9 + 2 organic): Dolgu, Kil, Silt, Kum, Çakıl, Ayrışmış Kaya, Kumtaşı, Kireçtaşı, Sert Kaya, Organik Kil, Torf.
- Equipment types: Fore Kazık, Ankraj, Mini Kazık.
- Bulk operations pattern: soil layers and equipment use **delete-all + insert** (not per-row CRUD).
- No CI/CD pipeline — deploy is Render-native (backend) and Vercel (frontend).

## Deployment

- **Backend**: Render (Python web service). Config in `render.yaml`.
- **Database**: **Neon** (managed Postgres, AWS eu-central-1 / Frankfurt). Free tier with scale-to-zero. Connection string is set manually in the Render dashboard as `DATABASE_URL` — `render.yaml` does NOT define a `databases:` block (Render Postgres free tier expired and was migrated off; if blueprint sync ever recreates one, ignore it and keep the manual Neon URL).
- **Frontend**: Vercel (static build from `frontend/`).
- **Domains**: `geodrillinsight.com`, `www.geodrillinsight.com`, `geodrill-five.vercel.app`.
- **CORS**: `ALLOWED_ORIGINS` env on backend (comma-separated). `main.py` always appends `localhost:5173/3000` and `127.0.0.1:5173` regardless.
- **Render env vars**: `DATABASE_URL` (manual — Neon connection string with `?sslmode=require`), `SECRET_KEY` (auto-generated), `ALLOWED_ORIGINS`, optional `LOG_LEVEL`, optional `ANTHROPIC_API_KEY` (the `anthropic` SDK is installed for AI-assisted features).

## Dependencies

### Frontend
React 19.2, Vite 8, Tailwind CSS 4.2, Recharts 3.8, Lucide React 1.7, Vitest 4.1, ESLint 9, **xlsx 0.18** (for soil-import parsing).

### Backend
FastAPI 0.135, SQLAlchemy 2.0, Pydantic 2.12, Uvicorn 0.42, python-jose 3.5 (JWT), passlib 1.7 + bcrypt 4.0.1, ReportLab 4.4 (PDF), Pandas 3.0 + numpy 2.4 (CSV/Excel), psycopg2-binary 2.9, **slowapi 0.1** (rate limiting), **pypdf 5.1**, **anthropic 0.40** (AI features).
