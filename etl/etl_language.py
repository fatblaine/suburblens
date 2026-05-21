#!/usr/bin/env python3
"""
SuburbLens ETL — Phase 2: Language Spoken at Home

Reads:
  ../data/extracted/2021_TSP_SA2_for_NSW_short-header/
      2021 Census TSP Statistical Area 2 for NSW/
          2021Census_T10A_NSW_SA2.csv   (English + 22 languages, partial Pe_ex_Da)
          2021Census_T10B_NSW_SA2.csv   (Pe_ex_Da completion + 14 remaining languages)
  ../data/extracted/2021_TSP_SA2_for_VIC_short-header/
      2021 Census TSP Statistical Area 2 for VIC/
          2021Census_T10A_VIC_SA2.csv
          2021Census_T10B_VIC_SA2.csv

Writes to Supabase (via SUPABASE_DB_URL in .env):
  tsp_language  — language spoken at home counts × 3 census years

Idempotent — safe to re-run.

Usage:
    python etl_language.py
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

NSW_T10A = NSW_DIR / "2021Census_T10A_NSW_SA2.csv"
NSW_T10B = NSW_DIR / "2021Census_T10B_NSW_SA2.csv"
VIC_T10A = VIC_DIR / "2021Census_T10A_VIC_SA2.csv"
VIC_T10B = VIC_DIR / "2021Census_T10B_VIC_SA2.csv"

# ── Column mapping: db column → ABS source prefix (append _CXX_P for each year) ──
#
# Note on Pe_ex_Da (Persian excl. Dari): T10A has _C11_M/_C11_F only;
# _C11_P and all C16/C21 columns are in T10B. The merge resolves this.

LANG_COLS = {
    "english_only":   "Uses_Engl_only",
    "arabic":         "UOL_Arabic",
    "aus_indigenous": "UOL_Aus_In_La",
    "bengali":        "UOL_Bengali",
    "cantonese":      "UOL_Canton",
    "mandarin":       "UOL_Mandar",
    "chinese_other":  "UOL_CL_Oth",
    "chinese_total":  "UOL_CL_Tot",   # pre-aggregated by ABS; excluded from total_persons
    "croatian":       "UOL_Croatian",
    "filipino":       "UOL_Filipino",
    "french":         "UOL_French",
    "german":         "UOL_German",
    "greek":          "UOL_Gre",
    "gujarati":       "UOL_Gujarati",
    "hindi":          "UOL_Hindi",
    "indonesian":     "UOL_Indon",
    "italian":        "UOL_Italian",
    "japanese":       "UOL_Japanes",
    "korean":         "UOL_Korean",
    "macedonian":     "UOL_Mac",
    "malayalam":      "UOL_Malayalam",
    "nepali":         "UOL_Nepali",
    "persian_dari":   "UOL_Pe_ex_Da",
    "portuguese":     "UOL_Portuguese",
    "punjabi":        "UOL_Punjabi",
    "russian":        "UOL_Russian",
    "serbian":        "UOL_Serbian",
    "sinhalese":      "UOL_Sinhalese",
    "spanish":        "UOL_Spanish",
    "tagalog":        "UOL_Tagalog",
    "tamil":          "UOL_Tamil",
    "thai":           "UOL_Thai",
    "turkish":        "UOL_Turkish",
    "urdu":           "UOL_Urdu",
    "vietnamese":     "UOL_Viet",
    "other_language": "UOL_Other",
}

# Languages that sum into total_persons (chinese_total excluded to avoid double-counting
# cantonese + mandarin + chinese_other which are already counted individually)
TOTAL_LANGS = {k for k in LANG_COLS if k != "chinese_total"}

YEAR_SUFFIX = {2011: "C11", 2016: "C16", 2021: "C21"}

# Ordered list of DB columns for the INSERT (must match VALUES tuple order)
DB_COLS = [
    "english_only", "arabic", "aus_indigenous", "bengali",
    "cantonese", "mandarin", "chinese_other", "chinese_total",
    "croatian", "filipino", "french", "german", "greek",
    "gujarati", "hindi", "indonesian", "italian", "japanese",
    "korean", "macedonian", "malayalam", "nepali", "persian_dari",
    "portuguese", "punjabi", "russian", "serbian", "sinhalese",
    "spanish", "tagalog", "tamil", "thai", "turkish",
    "urdu", "vietnamese", "other_language",
]

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


def check_file(path: Path):
    if not path.exists():
        sys.exit(f"ERROR: File not found:\n  {path}")


def load_state(t10a_path: Path, t10b_path: Path, label: str) -> pd.DataFrame:
    check_file(t10a_path)
    check_file(t10b_path)
    print(f"  Reading {label} T10A ({t10a_path.name}) ...")
    a = pd.read_csv(t10a_path, dtype={"SA2_CODE_2021": str})
    print(f"  Reading {label} T10B ({t10b_path.name}) ...")
    b = pd.read_csv(t10b_path, dtype={"SA2_CODE_2021": str})
    # T10B holds Pe_ex_Da_C11_P and all C16/C21 Pe_ex_Da cols that T10A truncated.
    # No overlapping data columns between A and B (only SA2_CODE_2021 is shared).
    merged = a.merge(b, on="SA2_CODE_2021", how="left")
    print(f"  {label}: {len(merged)} SA2 rows merged")
    return merged


# ── Core transform ────────────────────────────────────────────────────────────

def build_rows(df: pd.DataFrame) -> list[tuple]:
    rows = []
    for _, row in df.iterrows():
        sa2_code = str(row["SA2_CODE_2021"]).strip()

        for year, suffix in YEAR_SUFFIX.items():
            lang_values: dict[str, int | None] = {}
            for db_col, src_prefix in LANG_COLS.items():
                lang_values[db_col] = to_int(row.get(f"{src_prefix}_{suffix}_P"))

            # total_persons: sum of individual languages; None only if all columns are null
            non_null = [v for k, v in lang_values.items() if k in TOTAL_LANGS and v is not None]
            total = sum(non_null) if non_null else None

            rows.append((
                sa2_code,
                year,
                total,
                *[lang_values[col] for col in DB_COLS],
            ))

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
                print(f"Upserting {len(rows)} rows into tsp_language ...")
                execute_values(cur, f"""
                    INSERT INTO tsp_language ({col_list})
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
                FROM tsp_language
                GROUP BY census_year ORDER BY census_year
            """)
            print("\n── tsp_language ─────────────────────────────────────")
            print(f"  {'Year':<6} {'SA2 rows':<12} {'Total persons'}")
            for year, count, total in cur.fetchall():
                print(f"  {year:<6} {count:<12} {total:>14,}")

            # Spot-check: Glebe SA2
            GLEBE_SA2 = "117031331"
            cur.execute("""
                SELECT census_year, total_persons, english_only, mandarin,
                       cantonese, arabic, vietnamese, other_language
                FROM tsp_language
                WHERE sa2_code = %s ORDER BY census_year
            """, (GLEBE_SA2,))
            rows = cur.fetchall()
            print(f"\n── Spot-check: Glebe–Forest Lodge (SA2 {GLEBE_SA2}) ─")
            if rows:
                print(f"  {'Year':<6} {'Total':>8} {'English':>9} {'Mandarin':>9} "
                      f"{'Cantonese':>10} {'Arabic':>8} {'Viet':>6} {'Other':>7}")
                for r in rows:
                    print(f"  {r[0]:<6} {str(r[1] or '?'):>8} {str(r[2] or '?'):>9} "
                          f"{str(r[3] or '?'):>9} {str(r[4] or '?'):>10} "
                          f"{str(r[5] or '?'):>8} {str(r[6] or '?'):>6} {str(r[7] or '?'):>7}")
            else:
                print(f"  SA2 {GLEBE_SA2} not found — run main() first")
    finally:
        conn.close()


# ── Entry point ───────────────────────────────────────────────────────────────

def main():
    print("=== SuburbLens ETL: Language Spoken at Home ===\n")

    print("Loading NSW ...")
    nsw = load_state(NSW_T10A, NSW_T10B, "NSW")
    print("Loading VIC ...")
    vic = load_state(VIC_T10A, VIC_T10B, "VIC")

    df = pd.concat([nsw, vic], ignore_index=True)
    print(f"\nCombined: {len(df)} SA2 rows (NSW={len(nsw)}, VIC={len(vic)})")

    rows = build_rows(df)
    print(f"Built {len(rows)} tsp_language rows ({len(df)} SA2s × 3 years)\n")

    upsert(rows)
    verify()


if __name__ == "__main__":
    main()
