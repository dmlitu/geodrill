# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GeoDrill** is a geotechnical drilling decision support system (Turkish: "Geoteknik Karar Destek Sistemi") for managing pile drilling projects. It calculates torque requirements, casing needs, drilling time, fuel consumption, stability risk, and equipment suitability from soil profile data.

## Commands

### Frontend (React + Vite)
```bash
cd frontend
npm run dev      # Start dev server at http://localhost:5173
npm run build    # Production build
npm run lint     # ESLint
npm run preview  # Preview production build
```

### Backend (FastAPI)
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload   # Dev server (default: http://localhost:8000)
```

## Architecture

### Frontend (`frontend/src/`)
Single-page app with client-side state only — no backend integration yet.

- **`App.jsx`** — Root component; handles authentication state (localStorage token) and routing between pages via `currentPage` state. Demo credentials: `demo/demo`, `firma1/1234`, `admin/admin123`.
- **`ProjeForm.jsx`** — Project metadata and pile specifications input (name, location, depth, diameter, quantity, groundwater level).
- **`ZeminLogu.jsx`** — Editable soil layer table with dynamic stability risk and tip-type recommendations calculated inline from SPT/UCS/RQD values.
- **`MakinePark.jsx`** — Drilling equipment fleet management with CRUD operations.
- **`AnalizSonucu.jsx`** — Core analysis engine. Receives `projeData`, `zeminData`, and `makinaData` as props and performs all geotechnical calculations (torque, casing length, drilling time, fuel, equipment suitability matrix). All calculation logic lives here.

### Data Flow
`App.jsx` owns all state (`projeData`, `zeminData`, `makinaData`) and passes them as props + setter callbacks to child pages. `AnalizSonucu` is read-only — it only computes derived values from the other three datasets.

### Styling
Tailwind CSS 4 (via `@tailwindcss/vite` plugin) plus inline styles throughout. No CSS modules or external stylesheets beyond `src/index.css`.

### Backend (`backend/main.py`)
Minimal FastAPI scaffold — single `GET /` health-check endpoint, CORS configured for `http://localhost:5173`. No database or business logic yet.
