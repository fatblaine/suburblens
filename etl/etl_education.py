#!/usr/bin/env python3
"""
SuburbLens ETL — Education Level (TSP T29)

Reads:
  ../data/extracted/2021_TSP_SA2_for_NSW_short-header/
      2021 Census TSP Statistical Area 2 for NSW/
          2021Census_T29_NSW_SA2.csv
  ../data/extracted/2021_TSP_SA2_for_VIC_short-header/
      2021 Census TSP Statistical Area 2 for VIC/
          2021Census_T29_VIC_SA2.csv

Writes to Supabase (via SUPABASE_DB_URL in .env):
  tsp_education — education qualification counts × 3 census years

Idempotent — safe to re-run.

Usage:
    python etl_education.py
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

NSW_T29 = NSW_DIR / "2021Census_T29_NSW_SA2.csv"
VIC_T29 = VIC_DIR / "2021Census_T29_VIC_SA2.csv"

# ── Column mapping: db_col → ABS prefix (append _C{year}_P) ──────────────────
#
# Total persons 15+: Per_age_15over_C{year}_P
# Qualification levels use abbreviated prefixes from T29 short-header format.

EDU_COLS = {
    "postgrad_deg":  "H_no_sc_qu_Po_De",
    "grad_dip_cert": "H_n_s_q_Gr_D_G_Ce",
    "bach_deg":      "H_n_s_q_BD",
    "adv_dip_dip":   "H_n_s_q_AdDip_DL",
    "cert_iii_iv":   "H_n_s_q_Cert_III_IV",
    "cert_i_ii":     "H_n_s_q_Cert_I_II",
}

TOTAL_PREFIX = "Per_age_15over"
YEAR_SUFFIX  = {2011: "C11", 2016: "C16", 2021: "C21"}
DB_COLS      = list(EDU_COLS.keys())

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


def load_state(path: Path, label: str) -> pd.DataFrame:
    if not path.exists():
        sys.exit(f"ERROR: File not found:\n  {path}")
    print(f"  Reading {label} T29 ({path.name}) ...")
    df = pd.read_csv(path, dtype={"SA2_CODE_2021": str})
    print(f"  {label}: {len(df)} SA2 rows")
    return df


# ── Core transform ────────────────────────────────────────────────────────────

def build_rows(df: pd.DataFrame) -> list[tuple]:
    rows = []
    for _, row in df.iterrows():
        sa2_code = str(row["SA2_CODE_2021"]).strip()

        for year, suffix in YEAR_SUFFIX.items():
            total = to_int(row.get(f"{TOTAL_PREFIX}_{suffix}_P"))
            vals = {
                db_col: to_int(row.get(f"{src_prefix}_{suffix}_P"))
                for db_col, src_prefix in EDU_COLS.items()
            }
            rows.append((sa2_code, year, total, *[vals[c] for c in DB_COLS]))

    return rows


# ── DB upsert ─────────────────────────────────────────────────────────────────

def upsert(rows: list[tuple]) -> None:
    col_list  = ", ".join(["sa2_code", "census_year", "total_persons"] + DB_COLS)
    update_set = ",\n                        ".join(
        f"{col} = EXCLUDED.{col}"
        for col in ["total_persons"] + DB_COLS
    )

    conn = get_connection()
    try:
        with conn:
            with conn.cursor() as cur:
                print(f"Upserting {len(rows)} rows into tsp_education ...")
                execute_values(cur, f"""
                    INSERT INTO tsp_education ({col_list})
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
                FROM tsp_education
                GROUP BY census_year ORDER BY census_year
            """)
            print("\n── tsp_education ────────────────────────────────────")
            print(f"  {'Year':<6} {'SA2 rows':<12} {'Persons 15+'}")
            for year, count, total in cur.fetchall():
                print(f"  {year:<6} {count:<12} {total:>14,}")

            GLEBE_SA2 = "117031331"
            cur.execute("""
                SELECT census_year, total_persons,
                       postgrad_deg, bach_deg, cert_iii_iv, cert_i_ii
                FROM tsp_education
                WHERE sa2_code = %s ORDER BY census_year
            """, (GLEBE_SA2,))
            rows = cur.fetchall()
            print(f"\n── Spot-check: Glebe (SA2 {GLEBE_SA2}) ─────────────")
            if rows:
                print(f"  {'Year':<6} {'15+':>8} {'Postgrad':>9} {'Bach':>7} {'CertIII':>8} {'CertI':>6}")
                for r in rows:
                    print(f"  {r[0]:<6} {str(r[1] or '?'):>8} {str(r[2] or '?'):>9} "
                          f"{str(r[3] or '?'):>7} {str(r[4] or '?'):>8} {str(r[5] or '?'):>6}")
            else:
                print(f"  SA2 {GLEBE_SA2} not found — run main() first")
    finally:
        conn.close()


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    print("=== SuburbLens ETL: Education Level (TSP T29) ===\n")

    print("Loading NSW ...")
    nsw = load_state(NSW_T29, "NSW")
    print("Loading VIC ...")
    vic = load_state(VIC_T29, "VIC")

    df = pd.concat([nsw, vic], ignore_index=True)
    print(f"\nCombined: {len(df)} SA2 rows (NSW={len(nsw)}, VIC={len(vic)})\n")

    rows = build_rows(df)
    print(f"Built {len(rows)} tsp_education rows ({len(df)} SA2s × 3 years)\n")

    upsert(rows)
    verify()


if __name__ == "__main__":
    main()
