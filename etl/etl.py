#!/usr/bin/env python3
"""
SuburbLens ETL — Phase 1: Tenure Time Machine

Reads:
  ../data/2021_TSP_SA2_for_NSW_short-header/
      2021 Census TSP Statistical Area 2 for NSW/
          2021Census_T18A_NSW_SA2.csv
          2021Census_T18B_NSW_SA2.csv
  ../data/2021_TSP_SA2_for_VIC_short-header/
      2021 Census TSP Statistical Area 2 for VIC/
          2021Census_T18A_VIC_SA2.csv
          2021Census_T18B_VIC_SA2.csv
  ../data/SA2_2021_AUST_SHP_GDA2020/SA2_2021_AUST_GDA2020.shp
  ../data/SAL_2021_AUST_GDA2020_SHP/SAL_2021_AUST_GDA2020.shp

Writes to Supabase (via SUPABASE_DB_URL in .env):
  geo_sa2          — SA2 names, GCCSA, state (updated from shapefile)
  geo_sal          — SAL suburb names, GCCSA, state (Sydney + Melbourne only)
  geo_sal_to_sa2   — SAL↔SA2 mapping via area-overlap spatial join
  tsp_tenure       — tenure counts × 3 census years

Steps are idempotent — safe to re-run.

Usage:
    python etl.py --step geo       # load geo_sa2 / geo_sal / geo_sal_to_sa2
    python etl.py --step tsp       # load tsp_tenure (+ geo_sa2 stubs if needed)
    python etl.py --step verify    # spot-check all tables
    python etl.py --step all       # geo → tsp → verify
"""

import argparse
import os
import sys
from pathlib import Path

import pandas as pd
import psycopg2
import shapefile
import shapely.geometry
from psycopg2.extras import execute_values
from shapely import STRtree
from dotenv import load_dotenv

# ── Paths ─────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "extracted"

NSW_DIR = (
    DATA
    / "2021_TSP_SA2_for_NSW_short-header"
    / "2021 Census TSP Statistical Area 2 for NSW"
)
T18A     = NSW_DIR / "2021Census_T18A_NSW_SA2.csv"
T18B     = NSW_DIR / "2021Census_T18B_NSW_SA2.csv"

VIC_DIR  = (
    DATA
    / "2021_TSP_SA2_for_VIC_short-header"
    / "2021 Census TSP Statistical Area 2 for VIC"
)
VIC_T18A = VIC_DIR / "2021Census_T18A_VIC_SA2.csv"
VIC_T18B = VIC_DIR / "2021Census_T18B_VIC_SA2.csv"
SA2_SHP  = DATA / "SA2_2021_AUST_SHP_GDA2020" / "SA2_2021_AUST_GDA2020.shp"
SAL_SHP  = DATA / "SAL_2021_AUST_GDA2020_SHP" / "SAL_2021_AUST_GDA2020.shp"

# Only load suburbs in these two GCCSAs
TARGET_GCCSAS = {"1GSYD", "2GMEL"}

# ── TSP column selections ─────────────────────────────────────────────────────

T18A_COLS = [
    "SA2_CODE_2021",
    "C11_Owned_Outright_Tot",
    "C11_Owned_with_mortgage_Tot",
    "C11_R_Tot_Tot",
    "C11_OTT_Tot",
    "C11_TT_NS_Tot",
    "C11_Tot_Tot",
    "C16_OO_Tot",
    "C16_OWM_Tot",
    "C16_R_Tot_Tot",
    "C16_OTT_Tot",
    "C16_TT_NS_Tot",
    "C16_Tot_Tot",
    "C21_OO_Tot",
    "C21_OWM_Tot",
    "C21_R_Tot_Tot",
]

T18B_COLS = [
    "SA2_CODE_2021",
    "C21_OTT_Tot",
    "C21_TT_NS_Tot",
    "C21_Tot_Tot",
]

YEAR_COLS = {
    2011: {
        "owned_outright":           "C11_Owned_Outright_Tot",
        "owned_with_mortgage":      "C11_Owned_with_mortgage_Tot",
        "rented":                   "C11_R_Tot_Tot",
        "other_tenure":             "C11_OTT_Tot",
        "not_stated":               "C11_TT_NS_Tot",
        "total_occupied_dwellings": "C11_Tot_Tot",
    },
    2016: {
        "owned_outright":           "C16_OO_Tot",
        "owned_with_mortgage":      "C16_OWM_Tot",
        "rented":                   "C16_R_Tot_Tot",
        "other_tenure":             "C16_OTT_Tot",
        "not_stated":               "C16_TT_NS_Tot",
        "total_occupied_dwellings": "C16_Tot_Tot",
    },
    2021: {
        "owned_outright":           "C21_OO_Tot",
        "owned_with_mortgage":      "C21_OWM_Tot",
        "rented":                   "C21_R_Tot_Tot",
        "other_tenure":             "C21_OTT_Tot",
        "not_stated":               "C21_TT_NS_Tot",
        "total_occupied_dwellings": "C21_Tot_Tot",
    },
}

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_connection() -> psycopg2.extensions.connection:
    load_dotenv()
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        sys.exit("ERROR: SUPABASE_DB_URL not set — copy .env.example to .env and fill it in")
    try:
        return psycopg2.connect(url)
    except psycopg2.OperationalError as e:
        sys.exit(f"ERROR: Cannot connect to database:\n  {e}")


def to_int(val) -> int | None:
    try:
        return None if pd.isna(val) else int(val)
    except (TypeError, ValueError):
        return None


def check_file(path: Path) -> None:
    if not path.exists():
        sys.exit(f"ERROR: File not found:\n  {path}")


def shp_records(path: Path):
    """Yield (fields, record_dict, shape) for every row in a shapefile."""
    sf = shapefile.Reader(str(path))
    fields = [f[0] for f in sf.fields[1:]]
    for shape, record in zip(sf.shapes(), sf.records()):
        yield fields, dict(zip(fields, record)), shape


def to_shapely(shape):
    """Convert pyshp shape to shapely geometry, repairing if invalid."""
    geom = shapely.geometry.shape(shape.__geo_interface__)
    return geom if geom.is_valid else geom.buffer(0)


# ── Step: geo ─────────────────────────────────────────────────────────────────

def load_geography() -> None:
    check_file(SA2_SHP)
    check_file(SAL_SHP)

    # ── 1. Load SA2 shapefile ──────────────────────────────────────────────────
    print("Reading SA2 shapefile ...")
    sa2_geoms: list = []
    sa2_codes: list[str] = []
    sa2_attrs: dict[str, dict] = {}

    for _, rec, shape in shp_records(SA2_SHP):
        # Only NSW (1) and VIC (2) — keeps the STRtree small
        if rec["STE_CODE21"] not in ("1", "2"):
            continue
        try:
            geom = to_shapely(shape)
        except Exception:
            continue
        code = rec["SA2_CODE21"]
        sa2_geoms.append(geom)
        sa2_codes.append(code)
        sa2_attrs[code] = rec

    print(f"  {len(sa2_geoms)} NSW+VIC SA2s loaded")

    sa2_tree = STRtree(sa2_geoms)

    # ── 2. Upsert geo_sa2 with real names ─────────────────────────────────────
    sa2_rows = [
        (
            rec["SA2_CODE21"],
            rec["SA2_NAME21"],
            rec["GCC_CODE21"],
            rec["GCC_NAME21"],
            rec["STE_CODE21"],
            rec["STE_NAME21"],
            float(rec["AREASQKM21"]),
        )
        for rec in sa2_attrs.values()
    ]

    conn = get_connection()
    try:
        with conn:
            with conn.cursor() as cur:
                print(f"Upserting {len(sa2_rows)} geo_sa2 rows ...")
                execute_values(cur, """
                    INSERT INTO geo_sa2
                        (sa2_code, sa2_name, gccsa_code, gccsa_name,
                         state_code, state_name, area_sqkm)
                    VALUES %s
                    ON CONFLICT (sa2_code) DO UPDATE SET
                        sa2_name   = EXCLUDED.sa2_name,
                        gccsa_code = EXCLUDED.gccsa_code,
                        gccsa_name = EXCLUDED.gccsa_name,
                        state_code = EXCLUDED.state_code,
                        state_name = EXCLUDED.state_name,
                        area_sqkm  = EXCLUDED.area_sqkm
                """, sa2_rows)
    finally:
        conn.close()

    # ── 3. Load SAL shapefile + spatial join ───────────────────────────────────
    print("Reading SAL shapefile and computing SAL→SA2 overlap ...")
    geo_sal_rows: list[tuple] = []
    geo_bridge_rows: list[tuple] = []
    skipped = 0

    for _, rec, shape in shp_records(SAL_SHP):
        # Pre-filter: only NSW and VIC SALs (avoids processing all 15k)
        if rec["STE_CODE21"] not in ("1", "2"):
            continue
        try:
            sal_geom = to_shapely(shape)
        except Exception:
            skipped += 1
            continue

        sal_area = sal_geom.area
        if sal_area == 0:
            skipped += 1
            continue

        # Find SA2 candidates whose envelope intersects this SAL
        candidate_idx = sa2_tree.query(sal_geom, predicate="intersects")
        if len(candidate_idx) == 0:
            skipped += 1
            continue

        # Compute intersection area for each candidate → overlap ratio
        overlaps: list[tuple[float, str]] = []
        for idx in candidate_idx:
            try:
                intersection = sal_geom.intersection(sa2_geoms[idx])
                ratio = intersection.area / sal_area
            except Exception:
                continue
            if ratio > 0.001:   # ignore negligible slivers
                overlaps.append((ratio, sa2_codes[idx]))

        if not overlaps:
            skipped += 1
            continue

        overlaps.sort(reverse=True)
        primary_sa2_code = overlaps[0][1]
        primary_gcc = sa2_attrs[primary_sa2_code]["GCC_CODE21"]

        # Only keep SALs whose primary SA2 is in Greater Sydney or Greater Melbourne
        if primary_gcc not in TARGET_GCCSAS:
            continue

        sal_code = rec["SAL_CODE21"]
        gcc_name = sa2_attrs[primary_sa2_code]["GCC_NAME21"]

        geo_sal_rows.append((
            sal_code,
            rec["SAL_NAME21"],
            rec["STE_CODE21"],
            rec["STE_NAME21"],
            primary_gcc,
            gcc_name,
            primary_sa2_code,
            float(rec["AREASQKM21"]),
        ))

        for ratio, sa2_code in overlaps:
            is_primary = (sa2_code == primary_sa2_code)
            geo_bridge_rows.append((sal_code, sa2_code, round(ratio, 4), is_primary))

    print(f"  {len(geo_sal_rows)} SALs in Sydney/Melbourne | {skipped} skipped")

    # ── 4. Upsert geo_sal and geo_sal_to_sa2 ──────────────────────────────────
    conn = get_connection()
    try:
        with conn:
            with conn.cursor() as cur:
                print(f"Upserting {len(geo_sal_rows)} geo_sal rows ...")
                execute_values(cur, """
                    INSERT INTO geo_sal
                        (sal_code, sal_name, state_code, state_name,
                         gccsa_code, gccsa_name, primary_sa2_code, area_sqkm)
                    VALUES %s
                    ON CONFLICT (sal_code) DO UPDATE SET
                        sal_name         = EXCLUDED.sal_name,
                        state_code       = EXCLUDED.state_code,
                        state_name       = EXCLUDED.state_name,
                        gccsa_code       = EXCLUDED.gccsa_code,
                        gccsa_name       = EXCLUDED.gccsa_name,
                        primary_sa2_code = EXCLUDED.primary_sa2_code,
                        area_sqkm        = EXCLUDED.area_sqkm
                """, geo_sal_rows)

                print(f"Upserting {len(geo_bridge_rows)} geo_sal_to_sa2 rows ...")
                execute_values(cur, """
                    INSERT INTO geo_sal_to_sa2
                        (sal_code, sa2_code, overlap_ratio, is_primary)
                    VALUES %s
                    ON CONFLICT (sal_code, sa2_code) DO UPDATE SET
                        overlap_ratio = EXCLUDED.overlap_ratio,
                        is_primary    = EXCLUDED.is_primary
                """, geo_bridge_rows)

        print("geo step complete.")
    finally:
        conn.close()


# ── Step: tsp ─────────────────────────────────────────────────────────────────

def load_tsp_tenure() -> None:
    check_file(T18A)
    check_file(T18B)
    check_file(VIC_T18A)
    check_file(VIC_T18B)

    print(f"Reading {T18A.name} ...")
    nsw_a = pd.read_csv(T18A, usecols=T18A_COLS, dtype={"SA2_CODE_2021": str})
    print(f"Reading {T18B.name} ...")
    nsw_b = pd.read_csv(T18B, usecols=T18B_COLS, dtype={"SA2_CODE_2021": str})

    print(f"Reading {VIC_T18A.name} ...")
    vic_a = pd.read_csv(VIC_T18A, usecols=T18A_COLS, dtype={"SA2_CODE_2021": str})
    print(f"Reading {VIC_T18B.name} ...")
    vic_b = pd.read_csv(VIC_T18B, usecols=T18B_COLS, dtype={"SA2_CODE_2021": str})

    nsw = nsw_a.merge(nsw_b, on="SA2_CODE_2021", how="left")
    vic = vic_a.merge(vic_b, on="SA2_CODE_2021", how="left")
    df = pd.concat([nsw, vic], ignore_index=True)
    print(f"  Merged: {len(df)} SA2 rows (NSW={len(nsw)}, VIC={len(vic)})")

    tenure_rows = []
    for _, row in df.iterrows():
        code = row["SA2_CODE_2021"].strip()
        for year, col_map in YEAR_COLS.items():
            tenure_rows.append((
                code,
                year,
                to_int(row[col_map["owned_outright"]]),
                to_int(row[col_map["owned_with_mortgage"]]),
                to_int(row[col_map["rented"]]),
                to_int(row[col_map["other_tenure"]]),
                to_int(row[col_map["not_stated"]]),
                to_int(row[col_map["total_occupied_dwellings"]]),
            ))

    sa2_codes = sorted({r[0] for r in tenure_rows})

    # Insert geo_sa2 stubs for any SA2 not yet loaded by the geo step
    # SA2 codes starting with "2" are VIC; "1" are NSW
    def _stub(code: str) -> tuple:
        if code.startswith("2"):
            return (code, f"[stub] {code}", "2GMEL", "Victoria", "2", "Victoria")
        return (code, f"[stub] {code}", "1RNSW", "New South Wales", "1", "New South Wales")

    stub_rows = [_stub(code) for code in sa2_codes]

    conn = get_connection()
    try:
        with conn:
            with conn.cursor() as cur:
                print(f"Ensuring {len(stub_rows)} geo_sa2 rows exist ...")
                execute_values(cur, """
                    INSERT INTO geo_sa2
                        (sa2_code, sa2_name, gccsa_code, gccsa_name, state_code, state_name)
                    VALUES %s
                    ON CONFLICT (sa2_code) DO NOTHING
                """, stub_rows)

                print(f"Upserting {len(tenure_rows)} tsp_tenure rows ({len(sa2_codes)} SA2s × 3 years) ...")
                execute_values(cur, """
                    INSERT INTO tsp_tenure (
                        sa2_code, census_year,
                        owned_outright, owned_with_mortgage, rented,
                        other_tenure, not_stated, total_occupied_dwellings
                    )
                    VALUES %s
                    ON CONFLICT (sa2_code, census_year) DO UPDATE SET
                        owned_outright           = EXCLUDED.owned_outright,
                        owned_with_mortgage      = EXCLUDED.owned_with_mortgage,
                        rented                   = EXCLUDED.rented,
                        other_tenure             = EXCLUDED.other_tenure,
                        not_stated               = EXCLUDED.not_stated,
                        total_occupied_dwellings = EXCLUDED.total_occupied_dwellings
                """, tenure_rows)

        print("tsp step complete.")
    finally:
        conn.close()


# ── Step: verify ──────────────────────────────────────────────────────────────

def verify() -> None:
    conn = get_connection()
    try:
        with conn.cursor() as cur:

            # tsp_tenure summary
            cur.execute("""
                SELECT census_year, COUNT(*), SUM(total_occupied_dwellings)
                FROM tsp_tenure
                GROUP BY census_year ORDER BY census_year
            """)
            print("\n── tsp_tenure ───────────────────────────────────────")
            print(f"  {'Year':<6} {'SA2 rows':<12} {'Total dwellings'}")
            for year, count, total in cur.fetchall():
                print(f"  {year:<6} {count:<12} {total:>12,}")

            # geo table counts
            cur.execute("SELECT COUNT(*) FROM geo_sa2")
            (n_sa2,) = cur.fetchone()
            cur.execute("SELECT COUNT(*) FROM geo_sal")
            (n_sal,) = cur.fetchone()
            cur.execute("SELECT COUNT(*) FROM geo_sal_to_sa2")
            (n_bridge,) = cur.fetchone()
            print(f"\n── geo tables ───────────────────────────────────────")
            print(f"  geo_sa2:          {n_sa2:>6} rows")
            print(f"  geo_sal:          {n_sal:>6} rows")
            print(f"  geo_sal_to_sa2:   {n_bridge:>6} rows")

            # Spot-check: Glebe (SAL 11645 → SA2 117031331 Glebe-Forest Lodge)
            GLEBE_SAL = "11645"
            GLEBE_SA2 = "117031331"
            cur.execute("""
                SELECT census_year,
                       owned_outright, owned_with_mortgage, rented,
                       total_occupied_dwellings
                FROM tsp_tenure WHERE sa2_code = %s ORDER BY census_year
            """, (GLEBE_SA2,))
            rows = cur.fetchall()
            print(f"\n── Spot-check: Glebe–Forest Lodge (SA2 {GLEBE_SA2}) ─")
            if rows:
                print(f"  {'Year':<6} {'Outright':>16} {'Mortgage':>16} {'Rented':>16}  {'Total':>6}")
                for year, oo, owm, r, tot in rows:
                    def fmt(v): return f"{v:>6} ({100*v/tot:.1f}%)" if tot else str(v)
                    print(f"  {year:<6} {fmt(oo):>16} {fmt(owm):>16} {fmt(r):>16}  {tot:>6}")
            else:
                print(f"  SA2 {GLEBE_SA2} not found")

            # Check v_tenure_shift returns data
            cur.execute("""
                SELECT sal_code, sal_name, residency_shift_index, trend_label
                FROM v_tenure_shift
                WHERE sal_code = %s
            """, (GLEBE_SAL,))
            row = cur.fetchone()
            print(f"\n── v_tenure_shift: Glebe (SAL {GLEBE_SAL}) ─────────")
            if row:
                print(f"  sal_name={row[1]}  shift_index={row[2]}  trend={row[3]}")
            else:
                print("  No result — geo step may not have run yet")

    finally:
        conn.close()


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="SuburbLens ETL — Phase 1 Tenure")
    parser.add_argument(
        "--step",
        choices=["geo", "tsp", "verify", "all"],
        required=True,
        help="geo=load geography | tsp=load tenure | verify=spot-check | all=geo+tsp+verify",
    )
    args = parser.parse_args()

    if args.step in ("geo", "all"):
        load_geography()
    if args.step in ("tsp", "all"):
        load_tsp_tenure()
    if args.step in ("verify", "all"):
        verify()


if __name__ == "__main__":
    main()
