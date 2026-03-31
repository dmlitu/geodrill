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

### Frontend (`frontend/src/`)

Single-page React app. No client-side router — `App.jsx` manages page state via `currentPage`.

- **`App.jsx`** — Root component; owns all shared state (`projeData`, `zeminData`, `makinaData`) and passes them as props + setters to child pages. Handles auth (localStorage JWT token) and page routing.
- **`api.js`** — All backend communication. Wraps `fetch` with JWT token injection, auto-logout on 401, and snake_case ↔ camelCase conversion between frontend/backend.
- **`hesaplamalar.js`** — Pure calculation module (torque, stability risk, casing, drilling time, fuel, equipment suitability). No React/DOM dependencies — imported by both `AnalizSonucu.jsx` and `Gorseller.jsx`. All unit tests target this file.
- **`AnalizSonucu.jsx`** — Analysis results page. Read-only — computes derived values from project/soil/equipment data using `hesaplamalar.js`. Includes CSV/PDF export and print buttons.
- **`Gorseller.jsx`** — Visualization components (soil profile SVG, torque-depth chart, Gantt chart, scenario comparison). Uses Recharts for bar charts.
- **`ProjeForm.jsx`** — Project metadata and pile specification input.
- **`ZeminLogu.jsx`** — Editable soil layer table with inline stability risk and tip-type calculations.
- **`MakinePark.jsx`** — Equipment fleet CRUD.
- **`LandingPage.jsx`** / **`RegisterPage.jsx`** — Public-facing pages (hero, features, sign-up flow).

### Backend (`backend/`)

FastAPI with SQLAlchemy ORM. Database is PostgreSQL in production (Render), SQLite for local dev.

- **`main.py`** — App entry point; router registration, CORS config, DB table creation, demo user seeding on startup.
- **`database.py`** — SQLAlchemy engine, session factory, `get_db` dependency.
- **`models.py`** — ORM models: `User`, `Project`, `SoilLayer`, `Equipment`.
- **`schemas.py`** — Pydantic request/response schemas.
- **`auth.py`** — Password hashing (bcrypt), JWT creation/verification, `get_current_user` dependency.
- **`routers/`** — Route modules: `auth.py`, `projects.py`, `soil.py`, `equipment.py`, `reports.py` (PDF/CSV export).
- **`tests/`** — pytest integration tests with in-memory SQLite (StaticPool). `conftest.py` sets up test client and DB fixtures.

### Data Flow

`App.jsx` → props/callbacks → page components. `AnalizSonucu` is read-only (compute-only). All backend calls go through `api.js` which handles auth tokens and case conversion.

### Key Conventions

- All UI text is in **Turkish**. Variable names and code comments mix Turkish and English.
- Demo credentials: `demo/demo`, `firma1/1234`, `admin/admin123`.
- `VITE_API_URL` env var configures the backend URL (defaults to `http://localhost:8000`).
- Styling: Tailwind CSS 4 (via `@tailwindcss/vite`) plus extensive inline styles. No CSS modules.
- `bcrypt` is pinned to 4.0.1 for passlib compatibility.

### Deployment

Hosted on Render (backend + PostgreSQL) and Vercel (frontend). Config in `render.yaml`. Allowed CORS origins include `geodrillinsight.com` and the Vercel deploy URL.
