#!/usr/bin/env python3
"""Load 2021 ABS GCP G01 usual-resident population for Sydney and Melbourne.

Feeds the population-density metric. The script reads the NSW and Victorian
SAL-level General Community Profile G01 files (total persons, place of usual
residence), then upserts only SALs that are already in ``geo_sal`` and belong
to Greater Sydney or Greater Melbourne.

Density itself is computed in the ``v_population_density`` view (total_persons /
geo_sal.area_sqkm); this ETL only lands the population counts. The target table
``gcp_population`` and the density views are managed in the Supabase SQL Editor;
run the DDL in docs/planning/population-density-plan.md before running this.

Idempotent — safe to re-run.

Usage:
    cd etl
    python etl_population.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pandas as pd
import psycopg2
from dotenv import load_dotenv
from psycopg2.extras import execute_values


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "extracted"

NSW_G01 = (
    DATA
    / "2021_GCP_all_for_NSW_short-header"
    / "2021 Census GCP All Geographies for NSW"
    / "SAL"
    / "NSW"
    / "2021Census_G01_NSW_SAL.csv"
)
VIC_G01 = (
    DATA
    / "2021_GCP_all_for_VIC_short-header"
    / "2021 Census GCP All Geographies for VIC"
    / "SAL"
    / "VIC"
    / "2021Census_G01_VIC_SAL.csv"
)

TARGET_GCCSA_CODES = ("1GSYD", "2GMEL")
CENSUS_YEAR = 2021

SOURCE_CODE_COLUMN = "SAL_CODE_2021"
SOURCE_POP_COLUMN = "Tot_P_P"  # total persons (male + female), usual residence


def normalise_sal_code(value: str) -> str:
    """Map GCP's ``SAL10002`` code form to geo_sal's ASGS ``10002`` form."""
    code = str(value).strip()
    if code.startswith("SAL") and code[3:].isdigit():
        return code[3:]
    return code


def get_connection():
    """Open a Supabase connection using etl/.env regardless of current directory."""
    load_dotenv(Path(__file__).resolve().parent / ".env")
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        sys.exit(
            "ERROR: SUPABASE_DB_URL is not set — copy etl/.env.example to etl/.env "
            "and supply the Supabase pooler URL."
        )
    try:
        return psycopg2.connect(url)
    except psycopg2.OperationalError as error:
        sys.exit(f"ERROR: Cannot connect to database:\n  {error}")


def load_state(path: Path, state: str) -> pd.DataFrame:
    """Read and validate a state's G01 source file before any transformation."""
    if not path.exists():
        sys.exit(f"ERROR: Source file not found:\n  {path}")

    print(f"  Reading {state} G01 ({path.name}) ...")
    frame = pd.read_csv(path, dtype={SOURCE_CODE_COLUMN: str}, na_values=[".."])
    required_columns = {SOURCE_CODE_COLUMN, SOURCE_POP_COLUMN}
    missing = required_columns.difference(frame.columns)
    if missing:
        sys.exit(
            f"ERROR: {state} G01 is missing expected columns: {sorted(missing)}\n"
            "The ABS file may not be the 2021 short-header SAL G01 release."
        )

    frame = frame[[SOURCE_CODE_COLUMN, SOURCE_POP_COLUMN]].copy()
    frame[SOURCE_CODE_COLUMN] = frame[SOURCE_CODE_COLUMN].map(normalise_sal_code)

    if frame[SOURCE_CODE_COLUMN].isna().any() or (frame[SOURCE_CODE_COLUMN] == "").any():
        sys.exit(f"ERROR: {state} G01 contains a blank {SOURCE_CODE_COLUMN}.")
    if frame[SOURCE_CODE_COLUMN].duplicated().any():
        duplicates = frame.loc[frame[SOURCE_CODE_COLUMN].duplicated(), SOURCE_CODE_COLUMN].head(5)
        sys.exit(f"ERROR: {state} G01 contains duplicate SAL codes: {duplicates.tolist()}")

    numeric = pd.to_numeric(frame[SOURCE_POP_COLUMN], errors="coerce")
    invalid = frame[SOURCE_POP_COLUMN].notna() & numeric.isna()
    if invalid.any():
        examples = frame.loc[invalid, SOURCE_POP_COLUMN].head(5).tolist()
        sys.exit(f"ERROR: {state} G01 column {SOURCE_POP_COLUMN} has non-numeric values: {examples}")
    if numeric.isna().any():
        sys.exit(f"ERROR: {state} G01 column {SOURCE_POP_COLUMN} has missing values.")
    if (numeric < 0).any() or (numeric % 1 != 0).any():
        sys.exit(f"ERROR: {state} G01 column {SOURCE_POP_COLUMN} has invalid population counts.")
    frame[SOURCE_POP_COLUMN] = numeric.astype("int64")

    print(f"  {state}: {len(frame):,} SAL rows")
    return frame


def build_rows(frame: pd.DataFrame) -> list[tuple]:
    """Map source columns to (sal_code, census_year, total_persons) tuples."""
    return [
        (row[SOURCE_CODE_COLUMN], CENSUS_YEAR, int(row[SOURCE_POP_COLUMN]))
        for _, row in frame.iterrows()
    ]


def filter_to_target_sals(connection, rows: list[tuple]) -> list[tuple]:
    """Keep only source SALs that exist in the app's two supported city geographies."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT sal_code
            FROM geo_sal
            WHERE gccsa_code = ANY(%s)
            """,
            (list(TARGET_GCCSA_CODES),),
        )
        in_scope_codes = {sal_code for (sal_code,) in cursor.fetchall()}

    selected = [row for row in rows if row[0] in in_scope_codes]
    if not selected:
        sys.exit(
            "ERROR: No source SALs matched geo_sal in Greater Sydney or Greater Melbourne. "
            "Run the geography ETL first and verify the source SAL codes."
        )
    return selected


def upsert(connection, rows: list[tuple]) -> None:
    with connection:
        with connection.cursor() as cursor:
            execute_values(
                cursor,
                """
                INSERT INTO gcp_population (sal_code, census_year, total_persons)
                VALUES %s
                ON CONFLICT (sal_code, census_year) DO UPDATE SET
                    total_persons = EXCLUDED.total_persons
                """,
                rows,
                page_size=500,
            )


def verify(connection) -> None:
    """Print scoped row counts and a few density spot-checks after the upsert."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT s.gccsa_name, COUNT(*), SUM(p.total_persons)
            FROM gcp_population p
            JOIN geo_sal s ON s.sal_code = p.sal_code
            WHERE p.census_year = %s
              AND s.gccsa_code = ANY(%s)
            GROUP BY s.gccsa_name
            ORDER BY s.gccsa_name
            """,
            (CENSUS_YEAR, list(TARGET_GCCSA_CODES)),
        )
        print("\n── Loaded population rows ────────────────────────────")
        for city, count, persons in cursor.fetchall():
            print(f"  {city}: {count:,} SALs, {persons:,} persons")

        # Density spot-check straight from the view, highest-density suburbs first.
        cursor.execute(
            """
            SELECT sal_name, gccsa_name, total_persons,
                   ROUND(area_sqkm::numeric, 3)       AS area_sqkm,
                   ROUND(persons_per_sqkm::numeric, 0) AS density
            FROM v_population_density
            WHERE persons_per_sqkm IS NOT NULL
            ORDER BY persons_per_sqkm DESC
            LIMIT 5
            """
        )
        print("\n── Densest suburbs (from v_population_density) ───────")
        for name, city, persons, area, density in cursor.fetchall():
            print(f"  {name} ({city}): {persons:,} ppl / {area} sqkm = {density:,}/sqkm")


def main() -> None:
    print("=== SuburbLens ETL: Population (GCP G01, 2021) ===\n")

    nsw = load_state(NSW_G01, "NSW")
    vic = load_state(VIC_G01, "VIC")
    source = pd.concat([nsw, vic], ignore_index=True)
    print(f"\nSource rows: NSW={len(nsw):,}, VIC={len(vic):,}, total={len(source):,}")

    all_rows = build_rows(source)
    print(f"Built {len(all_rows):,} source rows; checking application geography ...")

    connection = get_connection()
    try:
        scoped_rows = filter_to_target_sals(connection, all_rows)
        print(f"In scope (Greater Sydney / Greater Melbourne): {len(scoped_rows):,} SAL rows")
        upsert(connection, scoped_rows)
        print(f"Upserted {len(scoped_rows):,} gcp_population rows.")
        verify(connection)
    finally:
        connection.close()


if __name__ == "__main__":
    main()
