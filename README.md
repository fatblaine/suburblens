# SuburbLens

[![Live](https://img.shields.io/badge/live-suburblensapp.com-c6f24e?style=flat-square)](https://www.suburblensapp.com)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![.NET](https://img.shields.io/badge/.NET-10-512bd4?style=flat-square&logo=dotnet&logoColor=white)](https://dotnet.microsoft.com)
[![Python](https://img.shields.io/badge/Python-3.11-3776ab?style=flat-square&logo=python&logoColor=white)](https://www.python.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres%2BPostGIS-3ecf8e?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)

> **"Should I move to _{suburb}_?"**
> Helping new immigrants and international students in Australia evaluate suburbs
> using ABS Census data — instead of just "what houses are for sale."

SuburbLens turns raw Australian Census data into a readable story about what a
suburb *is actually like* and *which way it's changing*: who owns vs. rents, the
community's languages and countries of origin, education levels, and recent crime
— for **Sydney** and **Melbourne**.

🌐 **Live:** [suburblensapp.com](https://www.suburblensapp.com) · 🧩 **Chrome extension** overlays these insights directly on realestate.com.au & domain.com.au listings.

---

## Why it exists

Property portals answer *"what houses are available."* They don't answer
*"what is this neighbourhood like, and is it becoming more owner-occupied or more
of a rental market?"* — the question that actually matters when you're new to a
city. SuburbLens does exactly that, and nothing else.

---

## Features

| Feature | What it shows | Source (ABS TSP) |
|---|---|---|
| 🏠 **Tenure Time Machine** | Owned / mortgaged / rented mix per suburb, tracked across Census years — is the area "buying in" or "renting out"? | T01 |
| 🗣️ **Language at Home** | Community language profile | T10A/B |
| 🌏 **Country of Birth** | Where residents were born | T08A/B |
| 🎓 **Education Level** | Highest qualification distribution | T29 |
| 🚔 **Crime** | Recent recorded-offence context | State data |
| 📈 **Residency Shift Index** | A single heuristic score for "owning-up vs. renting-up" trend — *labelled "SuburbLens Custom", not an official ABS metric* | derived |
| 📍 **Nearby Suburbs** | Closest suburbs by centroid distance (PostGIS) | — |
| ⚖️ **Compare + PDF export** | Side-by-side comparison of multiple suburbs, exportable as a report | — |
| 🗺️ **Map heatmap** | Interactive MapLibre choropleth | — |
| 🤖 **AI Assistant** | Ask questions about a suburb in natural language (LangGraph agent grounded in the same data) | — |
| 🧩 **Browser extension** | Overlays tenure insights on realestate.com.au / domain.com.au listing pages | — |

---

## Architecture

```
                       ┌──────────────────────────────┐
  Browser Extension ──▶│  C# .NET Minimal API (Lambda) │◀── React SPA (Amplify)
   (MV3, RE/Domain)    │  Dapper · Npgsql · read-only  │      │
                       └───────────────┬──────────────┘      │
                                       │                     │ direct (RLS)
                                       ▼                     ▼
                       ┌──────────────────────────────────────────┐
                       │   Supabase · PostgreSQL 15 + PostGIS      │
                       │   (calculations pushed into SQL views)    │
                       └───────────────▲──────────────────────────┘
                                       │ checkpointer / data
                       ┌───────────────┴──────────────┐
                       │  Python AI Agent (Fly.io)     │◀── React SPA (AI chat)
                       │  LangGraph · LangChain · FastAPI
                       └──────────────────────────────┘

  ETL (Python · Pandas · GeoPandas) ──▶ Supabase   (one-off, idempotent loaders)
```

**Key design constraints**
- **SAL** (Suburb & Locality) is the user-facing search layer; **SA2** is the ABS
  data layer — bridged via `geo_sal_to_sa2`.
- Only **Sydney (1GSYD)** and **Melbourne (2GMEL)** are in scope.
- All calculations live in **Postgres views**; the backend (Dapper) is
  **query-only** — writes (e.g. the popular-suburb counter) go directly to
  Supabase under Row-Level Security.

---

## Tech stack

| Layer | Stack |
|---|---|
| **Frontend** | React 19 · TypeScript 6 · Vite 8 · Tailwind CSS v4 · React Router 7 · TanStack Query 5 · Recharts 3 · MapLibre GL 5 · Supabase JS |
| **Backend API** | C# .NET 10 · ASP.NET Core Minimal APIs · Dapper · Npgsql · AWS Lambda (SAM) |
| **AI Agent** | Python · LangGraph · LangChain (langchain-openai) · FastAPI / Uvicorn · Postgres checkpointer · Fly.io |
| **Database** | Supabase PostgreSQL 15 + PostGIS |
| **ETL** | Python 3.11 · Pandas · GeoPandas |
| **Extension** | Chrome Manifest V3, vanilla JS content scripts |
| **Analytics** | Microsoft Clarity · Google Analytics 4 (manual SPA page_view) · self-hosted popular-suburb counter |

---

## Repository layout

```
suburblens/
├── frontend/      React SPA (the website)
├── backend/       C# .NET Minimal API  → AWS Lambda (SuburbLens.Api + .Tests)
├── agent/         Python LangGraph AI assistant → Fly.io
├── extension/     Chrome MV3 browser extension
├── etl/           Python data loaders (tenure, language, birthcountry, education, crime)
├── data/          Source ABS/crime data + SQL
└── docs/          Planning, features, deployment notes, AI changelog
```

---

## Getting started

> Requires: Node 20+, .NET 10 SDK, Python 3.11+, and a Supabase project.

### Frontend
```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
npm run build:deploy # production build + prerender flat suburb pages (SEO)
```

### Backend API
```bash
cd backend/SuburbLens.Api
dotnet run           # local Minimal API
dotnet test ../SuburbLens.Api.Tests
```
Connection string is read from `appsettings.Development.json` (not committed).

### AI Agent
```bash
cd agent
pip install -r requirements.txt
uvicorn server:server --reload   # SUPABASE_DB_URL enables persistence + rate limiting
```

### ETL (one-off, idempotent)
```bash
cd etl
pip install -r requirements.txt
python etl.py              # tenure
python etl_language.py
python etl_birthcountry.py
python etl_education.py
python etl_crime.py
```

### Extension
Load `extension/` as an unpacked extension in `chrome://extensions`
(Developer mode → Load unpacked). Visit any listing on realestate.com.au or
domain.com.au.

---

## API

### Data API — C# Minimal API (AWS Lambda). All responses **camelCase**.

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/suburbs/search?q=` | Search suburbs by name |
| GET | `/api/suburbs/search/batch?names=` | Batch name search |
| GET | `/api/suburbs/{salCode}/tenure` | Tenure across Census years + shift index |
| GET | `/api/suburbs/tenure/batch?salCodes=` | Batch tenure (compare view) |
| GET | `/api/suburbs/{salCode}/language` | Language-at-home profile |
| GET | `/api/suburbs/{salCode}/birthcountry` | Country-of-birth profile |
| GET | `/api/suburbs/{salCode}/education` | Education-level profile |
| GET | `/api/suburbs/{salCode}/crime` | Crime context |
| GET | `/api/suburbs/{salCode}/nearby?limit=` | Nearest suburbs (PostGIS) |
| GET | `/api/suburbs/heatmap?city=` | Choropleth data for the map |

### AI Agent — Python FastAPI (Fly.io)

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | Health check |
| POST | `/chat` | Streamed (`text/plain`) suburb-analyst answer. **Bearer-token auth — registered users only**; rejects anonymous guests. Body: `{ "message": string, "thread_id": string }`. Enforces a daily question quota (default 50, Sydney time), a 2 000-char input cap, and a multi-layer prompt-injection / off-topic guard. Chat history is persisted & summarised in the Postgres checkpointer. |

---

## Design system — "Nocturne"

A dark, editorial "data terminal" aesthetic. Space Grotesk for headings/numbers,
IBM Plex Sans for body, IBM Plex Mono for labels; a near-black surface stack with
a single lemon (`#c6f24e`) accent. Tokens live in `frontend/src/index.css` and
`frontend/src/lib/theme.ts`.

---

## Privacy

The website uses privacy-friendly analytics (Clarity, GA4) and **shows no ads**.
The **browser extension contains no advertising, injects no ads, and sends no
data to any advertising network** — it reads only the suburb name from the page
to fetch that suburb's Census stats. See [/privacy](https://www.suburblensapp.com/privacy).

---

## Data

All demographic data is from the **Australian Bureau of Statistics (ABS) Census**
(General Community Profile / Time Series Profile tables), plus state crime
statistics. SuburbLens is an independent project and is not affiliated with the ABS.
