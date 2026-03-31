# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GeoDrill** is a geotechnical drilling decision support system (Turkish: "Geoteknik Karar Destek Sistemi") for managing pile drilling projects. It calculates torque requirements, casing needs, drilling time, fuel consumption, stability risk, and equipment suitability from soil profile data.

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
```

API docs available at http://localhost:8000/docs when server is running.

## Architecture

### Project Structure
```
geodrill/
├── backend/                # FastAPI + SQLAlchemy (Python)
│   ├── routers/            # Route modules
│   │   ├── auth.py         # Login, register, /me
│   │   ├── projects.py     # Project CRUD
│   │   ├── soil.py         # Soil layer bulk operations
│   │   ├── equipment.py    # Equipment CRUD + bulk
│   │   └── reports.py      # PDF/CSV export + calculation functions
│   ├── tests/              # pytest integration tests
│   │   ├── conftest.py     # In-memory SQLite fixtures
│   │   ├── test_auth.py
│   │   ├── test_projects.py
│   │   └── test_soil.py
│   ├── main.py             # App entry, CORS, startup seed
│   ├── database.py         # Engine, session, get_db
│   ├── models.py           # ORM: User, Project, SoilLayer, Equipment
│   ├── schemas.py          # Pydantic schemas
│   ├── auth.py             # JWT + bcrypt auth helpers
│   └── requirements.txt
├── frontend/               # React 19 + Vite SPA
│   ├── src/
│   │   ├── App.jsx         # Root: auth, routing, state, Sidebar, Header, ErrorBoundary
│   │   ├── api.js          # API client with snake_case ↔ camelCase transforms
│   │   ├── hesaplamalar.js # Pure calculation module (torque, risk, casing, time, fuel)
│   │   ├── hesaplamalar.test.js  # Vitest unit tests (~34 tests)
│   │   ├── ProjeForm.jsx   # Project metadata editor
│   │   ├── ZeminLogu.jsx   # Soil layer table editor
│   │   ├── MakinePark.jsx  # Equipment fleet manager
│   │   ├── AnalizSonucu.jsx # Analysis results + export (CSV/PDF/print)
│   │   ├── Gorseller.jsx   # Visualizations (SVG + Recharts)
│   │   ├── LandingPage.jsx # Marketing/public page
│   │   ├── RegisterPage.jsx # Sign-up form
│   │   ├── index.css       # Tailwind imports + CSS vars + animations
│   │   └── main.jsx        # React entry point
│   ├── package.json
│   └── vite.config.js
├── render.yaml             # Render deployment manifest
├── .gitignore
└── CLAUDE.md
```

### Frontend (`frontend/src/`)

Single-page React app. No client-side router — `App.jsx` manages page state via `activePage`. Uses React hooks only (no Redux/Context).

- **`App.jsx`** — Root component; owns all shared state (`proje`, `zemin`, `makineler`) and passes them as props + setters to child pages. Contains inline LoginPage, Sidebar, Header, and ErrorBoundary components. Auth via localStorage (`gd_token`, `gd_username`). Dashboard nav: Proje Bilgileri → Zemin Logu → Makine Parki → Analiz Sonucu.
- **`api.js`** — All backend communication. Wraps `fetch` with JWT token injection, auto-logout on 401, snake_case ↔ camelCase conversion. Exports: `login`, `register`, `fetchMe`, `fetchProjects`, `createProject`, `fetchProject`, `updateProject`, `saveZeminBulk`, `fetchEquipment`, `saveEquipmentBulk`, `downloadReport`, `downloadZeminCSV`.
- **`hesaplamalar.js`** — Pure calculation module (no React/DOM dependencies). Exported functions:
  - `gerekliTork(zemin[], capMm)` — Max required torque across soil layers (SPT/UCS/RQD-based shear strength)
  - `stabiliteRiski(tip, kohezyon, spt, yas)` — Returns "Yuksek" / "Orta" / "Dusuk"
  - `casingDurum(zemin[], yas)` — Casing requirement decision with justification list
  - `casingMetreHesapla(zemin[], yas)` — Required casing meters (100% high-risk, 50% medium)
  - `ropHesapla(tip, ucs, capMm)` — Rate of penetration (m/hr) by soil type
  - `kazikSuresi(zemin[], capMm, kazikBoyu, casingM)` — Single pile drilling time (hours)
  - `mazotTahmini(tork, kazikBoyu)` — Fuel consumption { mBasi, toplam }
  - `kritikKatman(zemin[])` — Highest geotechnical complexity layer
  - `makinaUygunluk(makine, tork, kazikBoyu, kazikCapi, casingGerekli)` — Equipment suitability decision (Uygun/Sartli Uygun/Riskli/Uygun Degil)
- **`AnalizSonucu.jsx`** — Analysis results page. Read-only — uses `useMemo` for memoized calculations from `hesaplamalar.js`. Shows 5 metric cards, technical recommendations, critical layer details, casing justification, visualizations, equipment suitability matrix. Export: PDF report, zemin CSV, analysis CSV (client-generated), print.
- **`Gorseller.jsx`** — Four visualization components:
  - `ZeminProfilDiyagrami` — SVG vertical soil column with water table line, pile tip marker, legend
  - `TorkDerinlikGrafigi` — Recharts horizontal bar chart (torque vs depth per layer)
  - `GanttSemasi` — SVG Gantt chart (Mobilizasyon → Kazik Delme → Bekleme/Test → Demobilizasyon)
  - `SenaryoKarsilastirma` — Recharts dual-axis bar chart (diameter scenarios ±200/±400mm)
- **`ProjeForm.jsx`** — Project metadata editor. Fields: projeAdi*, projeKodu, sahaKodu, lokasyon, isTipi (Fore Kazik/Ankraj/Mini Kazik), kazikBoyu*, kazikCapi*, kazikAdedi*, yeraltiSuyu, projeNotu, teklifNotu.
- **`ZeminLogu.jsx`** — Editable soil layer table. Columns: depth range, formasyon, zemTipi (9 types), kohezyon, SPT (0-300), UCS, RQD (0-100), stabilite risk badge, tip recommendation. Validates depth coverage against kazikBoyu on save.
- **`MakinePark.jsx`** — Equipment fleet CRUD. Pre-populates 3 default rigs (Rig A: Bauer BG 24m/180kNm, Rig B: Soilmec SR 36m/260kNm, Rig C: Klemm KR 20m/130kNm). Bulk save.
- **`LandingPage.jsx`** — Marketing page with animated soil strata background, feature grid, how-it-works steps, CTA.
- **`RegisterPage.jsx`** — Registration form (adSoyad, username*, email*, password*, password confirmation). Auto-login on success.

### Backend (`backend/`)

FastAPI with SQLAlchemy ORM. PostgreSQL in production (Render), SQLite for local dev.

- **`main.py`** — App entry point. Lifespan context manager creates DB tables and seeds 3 demo users on startup. CORS from `ALLOWED_ORIGINS` env. Health check at `GET /` returns API version.
- **`database.py`** — SQLAlchemy engine + session factory. Reads `DATABASE_URL` env (converts `postgres://` → `postgresql://`). Default: `sqlite:///./geodrill.db`.
- **`models.py`** — ORM models with cascading deletes:
  - `User` — id, username (unique), hashed_password, is_active, created_at. Has many: projects, equipment.
  - `Project` — id, owner_id (FK), proje_adi, proje_kodu, saha_kodu, lokasyon, is_tipi, kazik_boyu, kazik_capi, kazik_adedi, yeralti_suyu, proje_notu, teklif_notu, created_at, updated_at. Has many: soil_layers (ordered by baslangic).
  - `SoilLayer` — id, project_id (FK), baslangic, bitis, formasyon, zem_tipi, kohezyon, spt, ucs, rqd, aciklama.
  - `Equipment` — id, owner_id (FK), ad, tip, marka, max_derinlik, max_cap, tork, casing, dar_alan, yakit_sinifi, not.
- **`schemas.py`** — Pydantic v2 schemas: Token, UserCreate (username 3-50 chars, password min 4), UserOut, SoilLayerCreate (validator: bitis > baslangic), SoilLayerOut, ProjectCreate (kazik_boyu 0-200, kazik_capi 0-5000), ProjectOut (includes soil_layers), ProjectSummary, EquipmentCreate (`not_` aliased to `"not"`), EquipmentOut.
- **`auth.py`** — bcrypt password hashing, HS256 JWT (8-hour expiry), `get_current_user` dependency. SECRET_KEY from env.
- **`routers/auth.py`** — POST `/auth/login` (OAuth2 form), POST `/auth/register`, GET `/auth/me`.
- **`routers/projects.py`** — Full CRUD. GET list returns ProjectSummary (sorted by updated_at DESC). All queries filter by owner_id for multi-tenancy.
- **`routers/soil.py`** — GET list (ordered by baslangic), PUT `/bulk` (delete-all + insert transaction).
- **`routers/equipment.py`** — CRUD + PUT `/bulk` (same delete-all + insert pattern).
- **`routers/reports.py`** — GET `/report` (ReportLab PDF with calculations, styled tables, color-coded risk), GET `/soil-layers/export` (Pandas CSV). Contains Python implementations of all `hesaplamalar.js` functions: `gerekli_tork`, `stabilite_riski`, `casing_metre`, `casing_durum`, `rop_hesapla`, `kazik_suresi`, `mazot_tahmini`, `makine_uygunluk`.
- **`tests/`** — pytest with in-memory SQLite (StaticPool). `conftest.py` provides `client` and `auth_headers` fixtures. ~15 integration tests covering auth, project CRUD, soil bulk operations, validation errors, and user data isolation.

### API Endpoints Summary

| Route Prefix | Endpoints | Auth |
|---|---|---|
| `/auth` | POST `/login`, POST `/register`, GET `/me` | login/register: no, me: yes |
| `/projects` | GET list, POST create, GET `/{id}`, PUT `/{id}`, DELETE `/{id}` | yes |
| `/projects/{id}/soil-layers` | GET list, PUT `/bulk` | yes |
| `/projects/{id}/soil-layers/export` | GET (CSV download) | yes |
| `/projects/{id}/report` | GET (PDF download) | yes |
| `/equipment` | GET list, POST create, PUT `/{id}`, DELETE `/{id}`, PUT `/bulk` | yes |

### Data Flow

1. `App.jsx` loads project → zemin → makineler on login
2. Page components receive data as props, call setters on save
3. All API calls go through `api.js` (auth headers + case conversion)
4. `AnalizSonucu` is read-only: imports `hesaplamalar.js` for calculations
5. PDF/CSV exports hit backend which re-runs same calculations server-side

### Calculation Parity

`hesaplamalar.js` (frontend) and `reports.py` (backend) implement the same geotechnical formulas. Changes to calculation logic must be updated in **both files** to keep parity.

## Key Conventions

- All UI text is in **Turkish**. Variable names and code comments mix Turkish and English.
- Demo credentials: `demo/demo`, `firma1/1234`, `admin/admin123` (seeded on startup).
- `VITE_API_URL` env var configures the backend URL (defaults to `http://localhost:8000`).
- Styling: Tailwind CSS 4 (via `@tailwindcss/vite`) + inline style objects. Design tokens as CSS variables in `index.css`. Fonts: Fraunces (headings), Plus Jakarta Sans (body), DM Mono (code).
- `bcrypt` is pinned to 4.0.1 for passlib compatibility.
- Soil types: Dolgu, Kil, Silt, Kum, Cakil, Ayrismiis Kaya, Kumtasi, Kirectasi, Sert Kaya.
- Equipment types: Fore Kazik, Ankraj, Mini Kazik.
- Bulk operations pattern: soil layers and equipment use delete-all + insert (not individual CRUD).
- No database migrations — tables auto-created via `Base.metadata.create_all()` on startup.
- No CI/CD pipeline — deployment is Render-native (backend) and Vercel (frontend).

## Deployment

- **Backend**: Render (Python web service + PostgreSQL). Config in `render.yaml`.
- **Frontend**: Vercel (static build from `frontend/`).
- **Domains**: `geodrillinsight.com`, `www.geodrillinsight.com`, `geodrill-five.vercel.app`.
- **CORS**: Configured via `ALLOWED_ORIGINS` env on backend (comma-separated).
- **Env vars on Render**: `DATABASE_URL` (auto-injected from PG service), `SECRET_KEY` (auto-generated), `ALLOWED_ORIGINS`.

## Dependencies

### Frontend (key packages)
- React 19.2, Vite 8, Tailwind CSS 4.2, Recharts 3.8, Lucide React 1.7, Vitest 4.1, ESLint 9

### Backend (key packages)
- FastAPI 0.135, SQLAlchemy 2.0, Pydantic 2.12, Uvicorn 0.42, python-jose 3.5 (JWT), passlib 1.7 + bcrypt 4.0.1, ReportLab 4.4 (PDF), Pandas 3.0 (CSV), psycopg2-binary 2.9
