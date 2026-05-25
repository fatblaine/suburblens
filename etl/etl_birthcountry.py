#!/usr/bin/env python3
"""
SuburbLens ETL — Country of Birth (TSP T08)

Reads:
  ../data/extracted/2021_TSP_SA2_for_NSW_short-header/
      2021 Census TSP Statistical Area 2 for NSW/
          2021Census_T08A_NSW_SA2.csv   (Afghanistan → Nepal, all 3 years)
          2021Census_T08B_NSW_SA2.csv   (Netherlands → Total, all 3 years)
  ../data/extracted/2021_TSP_SA2_for_VIC_short-header/
      2021 Census TSP Statistical Area 2 for VIC/
          2021Census_T08A_VIC_SA2.csv
          2021Census_T08B_VIC_SA2.csv

Writes to Supabase (via SUPABASE_DB_URL in .env):
  tsp_birthcountry — country of birth counts × 3 census years

Idempotent — safe to re-run.

Usage:
    python etl_birthcountry.py
"""

import os
import sys
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# ── Paths ─────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "extracted"

NSW_DIR = DATA / "2021_TSP_SA2_for_NSW_short-header" / "2021 Census TSP Statistical Area 2 for NSW"
VIC_DIR = DATA / "2021_TSP_SA2_for_VIC_short-header" / "2021 Census TSP Statistical Area 2 for VIC"

NSW_T08A = NSW_DIR / "2021Census_T08A_NSW_SA2.csv"
NSW_T08B = NSW_DIR / "2021Census_T08B_NSW_SA2.csv"
VIC_T08A = VIC_DIR / "2021Census_T08A_VIC_SA2.csv"
VIC_T08B = VIC_DIR / "2021Census_T08B_VIC_SA2.csv"

# ── Column mapping: db_col → ABS column prefix (append _C11_P / _C16_P / _C21_P) ──

COB_COLS = {
    "australia":    "Aust",
    "china":        "China",
    "india":        "India",
    "new_zealand":  "New_Zealand",
    "philippines":  "Philippines",
    "vietnam":      "Vietnam",
    "uk":           "Unitd_Kingdom",
    "south_africa": "South_Africa",
    "malaysia":     "Malaysia",
    "south_korea":  "Korea",
    "italy":        "Italy",
    "sri_lanka":    "Sri_Lanka",
    "nepal":        "Nepal",
    "pakistan":     "Pakistan",
    "hong_kong":    "Hong_Kong",
    "usa":          "Unit_Sts_Amer",
    "lebanon":      "Lebanon",
    "iraq":         "Iraq",
    "germany":      "Germany",
    "indonesia":    "Indonesia",
    "bangladesh":   "Bangladesh",
    "afghanistan":  "Afghanistan",
    "greece":       "Greece",
    "egypt":        "Egypt",
    "fiji":         "Fiji",
    "croatia":      "Croatia",
    "ireland":      "Ireland",
    "japan":        "Japan",
    "netherlands":  "Netherlands",
    "poland":       "Poland",
    "singapore":    "Singapore",
    "taiwan":       "Taiwan",
    "thailand":     "Thailand",
    "canada":       "Canada",
    "born_elsewhere": "Born_elsewhere",
}

YEAR_SUFFIX = {2011: "C11", 2016: "C16", 2021: "C21"}

DB_COLS = list(COB_COLS.keys())

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_connection():
    load_dotenv()
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        sys.exit("ERROR: SUPABASE_DB_URL not set — copy .env.example to .env and fill it in")
    try:
        return psycopg2.connect(url)
    except psycopg2.OperationalError as e:
        sys.exit(f"ERROR: Cannot connect to database:\n  {e}")


def to_int(val):
    try:
        return None if pd.isna(val) else int(val)
    except (TypeError, ValueError):
        return None


def load_state(t08a_path: Path, t08b_path: Path, label: str) -> pd.DataFrame:
    for p in [t08a_path, t08b_path]:
        if not p.exists():
            sys.exit(f"ERROR: File not found:\n  {p}")
    print(f"  Reading {label} T08A ({t08a_path.name}) ...")
    a = pd.read_csv(t08a_path, dtype={"SA2_CODE_2021": str})
    print(f"  Reading {label} T08B ({t08b_path.name}) ...")
    b = pd.read_csv(t08b_path, dtype={"SA2_CODE_2021": str})
    merged = a.merge(b, on="SA2_CODE_2021", how="left")
    print(f"  {label}: {len(merged)} SA2 rows merged")
    return merged


# ── Core transform ────────────────────────────────────────────────────────────

def build_rows(df: pd.DataFrame) -> list[tuple]:
    rows = []
    for _, row in df.iterrows():
        sa2_code = str(row["SA2_CODE_2021"]).strip()

        for year, suffix in YEAR_SUFFIX.items():
            vals: dict[str, int | None] = {}
            for db_col, src_prefix in COB_COLS.items():
                vals[db_col] = to_int(row.get(f"{src_prefix}_{suffix}_P"))

            # Total = Tot_CXX_P from T08B (grand total, more accurate than summing)
            total = to_int(row.get(f"Tot_{suffix}_P"))
            # Fall back to summing individual cols if Tot not available
            if total is None:
                non_null = [v for v in vals.values() if v is not None]
                total = sum(non_null) if non_null else None

            rows.append((sa2_code, year, total, *[vals[c] for c in DB_COLS]))

    return rows


# ── DB upsert ─────────────────────────────────────────────────────────────────

def upsert(rows: list[tuple]) -> None:
    col_list = ", ".join(["sa2_code", "census_year", "total_persons"] + DB_COLS)
    update_set = ",\n                        ".join(
        f"{col} = EXCLUDED.{col}"
        for col in ["total_persons"] + DB_COLS
    )

    conn = get_connection()
    try:
        with conn:
            with conn.cursor() as cur:
                print(f"Upserting {len(rows)} rows into tsp_birthcountry ...")
                execute_values(cur, f"""
                    INSERT INTO tsp_birthcountry ({col_list})
                    VALUES %s
                    ON CONFLICT (sa2_code, census_year) DO UPDATE SET
                        {update_set}
                """, rows)
        print(f"Done — {len(rows)} rows upserted.")
    finally:
        conn.close()


# ── Verify ────────────────────────────────────────────────────────────────────

def verify() -> None:
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT census_year, COUNT(*), SUM(total_persons)
                FROM tsp_birthcountry
                GROUP BY census_year ORDER BY census_year
            """)
            print("\n── tsp_birthcountry ─────────────────────────────────")
            print(f"  {'Year':<6} {'SA2 rows':<12} {'Total persons'}")
            for year, count, total in cur.fetchall():
                print(f"  {year:<6} {count:<12} {total:>14,}")

            # Spot-check: Glebe SA2
            GLEBE_SA2 = "117031331"
            cur.execute("""
                SELECT census_year, total_persons, australia, china, india,
                       new_zealand, vietnam, philippines
                FROM tsp_birthcountry
                WHERE sa2_code = %s ORDER BY census_year
            """, (GLEBE_SA2,))
            rows = cur.fetchall()
            print(f"\n── Spot-check: Glebe (SA2 {GLEBE_SA2}) ─────────────")
            if rows:
                print(f"  {'Year':<6} {'Total':>8} {'Aust':>8} {'China':>8} "
                      f"{'India':>8} {'NZ':>6} {'Viet':>6} {'Phil':>6}")
                for r in rows:
                    print(f"  {r[0]:<6} {str(r[1] or '?'):>8} {str(r[2] or '?'):>8} "
                          f"{str(r[3] or '?'):>8} {str(r[4] or '?'):>8} "
                          f"{str(r[5] or '?'):>6} {str(r[6] or '?'):>6} {str(r[7] or '?'):>6}")
            else:
                print(f"  SA2 {GLEBE_SA2} not found — run main() first")
    finally:
        conn.close()


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    print("=== SuburbLens ETL: Country of Birth (TSP T08) ===\n")

    print("Loading NSW ...")
    nsw = load_state(NSW_T08A, NSW_T08B, "NSW")
    print("Loading VIC ...")
    vic = load_state(VIC_T08A, VIC_T08B, "VIC")

    df = pd.concat([nsw, vic], ignore_index=True)
    print(f"\nCombined: {len(df)} SA2 rows (NSW={len(nsw)}, VIC={len(vic)})")

    rows = build_rows(df)
    print(f"Built {len(rows)} tsp_birthcountry rows ({len(df)} SA2s × 3 years)\n")

    upsert(rows)
    verify()


if __name__ == "__main__":
    main()
