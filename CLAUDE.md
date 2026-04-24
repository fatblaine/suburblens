# SuburbLens Project Context

## Project Goal
Help new immigrants to Australia determine whether a suburb is trending toward owner-occupation or rentals, using ABS Census data.
Phase 1 covers only one feature: the Tenure Time Machine. Full plan: `docs/SuburbLens_MVP_Plan_Final.md`.

## Tech Stack
- Backend: C# .NET 8 + ASP.NET Core Minimal APIs + Dapper + Npgsql, deployed on AWS Lambda
- Frontend: React + TypeScript + Vite + Tailwind + Recharts
- DB: Supabase PostgreSQL 15 + PostGIS
- ETL: Python 3.11 + Pandas + GeoPandas (one-off scripts)

## Code Style
- C#: use Minimal API, no Controllers
- SQL: push all calculations into Postgres views (e.g. v_tenure_shift); Dapper is query-only
- EF Core is banned; use Dapper only
- All JSON response fields must be camelCase

## Key Design Constraints
- SAL is the user-facing search layer; SA2 is the data layer — bridged via geo_sal_to_sa2
- Residency Shift Index is a custom heuristic metric; the UI must label it "SuburbLens Custom"
- Optimise Lambda cold starts with SnapStart

## Current Phase
Phase 1 - Week 1 - Backend Skeleton