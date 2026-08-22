#!/usr/bin/env python3
"""Load 2021 ABS GCP G36 dwelling structure data for Sydney and Melbourne.

The script reads the NSW and Victorian SAL-level General Community Profile files,
validates the occupied-private-dwelling component total, then upserts only SALs
that are already in ``geo_sal`` and belong to Greater Sydney or Greater Melbourne.

The target table and ``v_housing_mix`` view are managed in the Supabase SQL Editor;
run the DDL in docs/planning/unit-to-house-ratio-plan.md before running this script.

Usage:
    cd etl
    python etl_dwelling_structure.py
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

NSW_G36 = (
    DATA
    / "2021_GCP_all_for_NSW_short-header"
    / "2021 Census GCP All Geographies for NSW"
    / "SAL"
    / "NSW"
    / "2021Census_G36_NSW_SAL.csv"
)
VIC_G36 = (
    DATA
    / "2021_GCP_all_for_VIC_short-header"
    / "2021 Census GCP All Geographies for VIC"
    / "SAL"
    / "VIC"
    / "2021Census_G36_VIC_SAL.csv"
)

TARGET_GCCSA_CODES = ("1GSYD", "2GMEL")
CENSUS_YEAR = 2021
# ABS applies random adjustment to Census cells for confidentiality. In the
# supplied G36 files, category sums differ from the published total by up to 16.
# A larger gap indicates an incorrect source column or a corrupted input file.
MAX_COMPONENT_TOTAL_DELTA = 20

# Database column -> G36 short-header source column.
COLUMN_MAP = {
    "separate_houses": "OPDs_Separate_house_Dwellings",
    "semi_detached_townhouses": "OPDs_SD_r_t_h_th_Tot_Dwgs",
    "apartments": "OPDs_Flt_apart_Tot_Dwgs",
    "other_dwellings": "OPDs_Other_dwelling_Tot_Dwgs",
    "structure_not_stated": "OPDs_Dwlling_structur_NS_Dwgs",
    "total_occupied_private_dwellings": "OPDs_Tot_OPDs_Dwellings",
}
SOURCE_CODE_COLUMN = "SAL_CODE_2021"
DB_COLUMNS = list(COLUMN_MAP)


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
    """Read and validate a state's G36 source file before any transformation."""
    if not path.exists():
        sys.exit(f"ERROR: Source file not found:\n  {path}")

    print(f"  Reading {state} G36 ({path.name}) ...")
    frame = pd.read_csv(path, dtype={SOURCE_CODE_COLUMN: str}, na_values=[".."])
    required_columns = {SOURCE_CODE_COLUMN, *COLUMN_MAP.values()}
    missing = required_columns.difference(frame.columns)
    if missing:
        sys.exit(
            f"ERROR: {state} G36 is missing expected columns: {sorted(missing)}\n"
            "The ABS file may not be the 2021 short-header SAL G36 release."
        )

    frame = frame[[SOURCE_CODE_COLUMN, *COLUMN_MAP.values()]].copy()
    frame["source_state"] = state
    frame[SOURCE_CODE_COLUMN] = frame[SOURCE_CODE_COLUMN].map(normalise_sal_code)

    if frame[SOURCE_CODE_COLUMN].isna().any() or (frame[SOURCE_CODE_COLUMN] == "").any():
        sys.exit(f"ERROR: {state} G36 contains a blank {SOURCE_CODE_COLUMN}.")
    if frame[SOURCE_CODE_COLUMN].duplicated().any():
        duplicates = frame.loc[frame[SOURCE_CODE_COLUMN].duplicated(), SOURCE_CODE_COLUMN].head(5)
        sys.exit(f"ERROR: {state} G36 contains duplicate SAL codes: {duplicates.tolist()}")

    for source_column in COLUMN_MAP.values():
        original = frame[source_column]
        numeric = pd.to_numeric(original, errors="coerce")
        invalid = original.notna() & numeric.isna()
        if invalid.any():
            examples = original[invalid].head(5).tolist()
            sys.exit(
                f"ERROR: {state} G36 column {source_column} has non-numeric values: {examples}"
            )
        if numeric.isna().any():
            sys.exit(f"ERROR: {state} G36 column {source_column} has missing values.")
        if (numeric < 0).any() or (numeric % 1 != 0).any():
            sys.exit(f"ERROR: {state} G36 column {source_column} has invalid dwelling counts.")
        frame[source_column] = numeric.astype("int64")

    print(f"  {state}: {len(frame):,} SAL rows")
    return frame


def build_rows(frame: pd.DataFrame) -> list[tuple]:
    """Map source columns to the target tuple order and validate component totals."""
    transformed = pd.DataFrame(
        {
            "sal_code": frame[SOURCE_CODE_COLUMN],
            **{database: frame[source] for database, source in COLUMN_MAP.items()},
        }
    )

    component_total = transformed[
        [
            "separate_houses",
            "semi_detached_townhouses",
            "apartments",
            "other_dwellings",
            "structure_not_stated",
        ]
    ].sum(axis=1)
    total_delta = component_total - transformed["total_occupied_private_dwellings"]
    invalid_totals = total_delta.abs() > MAX_COMPONENT_TOTAL_DELTA
    if invalid_totals.any():
        examples = transformed.loc[
            invalid_totals,
            ["sal_code", *DB_COLUMNS],
        ].head(5)
        sys.exit(
            "ERROR: G36 dwelling-structure component totals differ too far from the "
            "published total.\n"
            f"Examples:\n{examples.to_string(index=False)}"
        )

    adjusted_rows = (total_delta != 0).sum()
    if adjusted_rows:
        print(
            f"NOTE: {adjusted_rows:,} rows have ABS confidentiality-adjustment deltas "
            f"between components and total (maximum absolute delta: "
            f"{total_delta.abs().max():,}). Published values are preserved."
        )

    return [
        (row.sal_code, CENSUS_YEAR, *[getattr(row, column) for column in DB_COLUMNS])
        for row in transformed.itertuples(index=False)
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
    columns = ["sal_code", "census_year", *DB_COLUMNS]
    update_set = ",\n                    ".join(
        f"{column} = EXCLUDED.{column}" for column in DB_COLUMNS
    )

    with connection:
        with connection.cursor() as cursor:
            execute_values(
                cursor,
                f"""
                INSERT INTO gcp_dwelling_structure ({", ".join(columns)})
                VALUES %s
                ON CONFLICT (sal_code, census_year) DO UPDATE SET
                    {update_set}
                """,
                rows,
                page_size=500,
            )


def verify(connection) -> None:
    """Print scoped row counts and three deterministic samples after the upsert."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT s.gccsa_name, COUNT(*)
            FROM gcp_dwelling_structure d
            JOIN geo_sal s ON s.sal_code = d.sal_code
            WHERE d.census_year = %s
              AND s.gccsa_code = ANY(%s)
            GROUP BY s.gccsa_name
            ORDER BY s.gccsa_name
            """,
            (CENSUS_YEAR, list(TARGET_GCCSA_CODES)),
        )
        print("\n── Loaded dwelling-structure rows ───────────────────")
        for city, count in cursor.fetchall():
            print(f"  {city}: {count:,} SALs")

        cursor.execute(
            """
            SELECT s.sal_name, s.gccsa_name, d.separate_houses,
                   d.semi_detached_townhouses, d.apartments,
                   d.total_occupied_private_dwellings
            FROM gcp_dwelling_structure d
            JOIN geo_sal s ON s.sal_code = d.sal_code
            WHERE d.census_year = %s
              AND s.gccsa_code = ANY(%s)
            ORDER BY s.gccsa_name, s.sal_name
            LIMIT 3
            """,
            (CENSUS_YEAR, list(TARGET_GCCSA_CODES)),
        )
        print("\n── Sample suburbs ───────────────────────────────────")
        for name, city, houses, townhouses, apartments, total in cursor.fetchall():
            print(
                f"  {name} ({city}): houses={houses:,}, townhouses={townhouses:,}, "
                f"apartments={apartments:,}, total={total:,}"
            )


def main() -> None:
    print("=== SuburbLens ETL: Dwelling Structure (GCP G36, 2021) ===\n")

    nsw = load_state(NSW_G36, "NSW")
    vic = load_state(VIC_G36, "VIC")
    source = pd.concat([nsw, vic], ignore_index=True)
    print(f"\nSource rows: NSW={len(nsw):,}, VIC={len(vic):,}, total={len(source):,}")

    all_rows = build_rows(source)
    print(f"Validated {len(all_rows):,} source rows; checking application geography ...")

    connection = get_connection()
    try:
        scoped_rows = filter_to_target_sals(connection, all_rows)
        print(f"In scope (Greater Sydney / Greater Melbourne): {len(scoped_rows):,} SAL rows")
        upsert(connection, scoped_rows)
        print(f"Upserted {len(scoped_rows):,} gcp_dwelling_structure rows.")
        verify(connection)
    finally:
        connection.close()


if __name__ == "__main__":
    main()
