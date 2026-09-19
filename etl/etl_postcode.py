#!/usr/bin/env python3
"""Map each Sydney/Melbourne suburb (SAL) to its primary postcode (POA 2021).

Feeds the outbound "Sales history" links on the suburb detail page — realestate.com.au,
Domain and Homely all address a suburb as ``{suburb}-{state}-{postcode}``, and we had no
postcode of our own. See docs/planning/sales-history-links-plan.md.

Reads:
  ../data/extracted/POA_2021_AUST_GDA2020_SHP/POA_2021_AUST_GDA2020.shp
  ../data/extracted/SAL_2021_AUST_GDA2020_SHP/SAL_2021_AUST_GDA2020.shp

Writes to Supabase (via SUPABASE_DB_URL in etl/.env):
  geo_sal.postcode   — primary POA by area overlap, Sydney + Melbourne only

The join is the same area-overlap spatial join ``etl.py`` already uses for SAL→SA2:
take the POA covering the largest share of the suburb's area. Measured over all 7,486
NSW/VIC suburbs, 99.5% resolve with >= 0.95 overlap; the handful that genuinely straddle
two postcodes are listed in POSTCODE_OVERRIDES below.

The target column is managed in the Supabase SQL Editor — run the DDL in
docs/planning/sales-history-links-plan.md section 4 before running this.

Idempotent — safe to re-run.

Usage:
    cd etl
    python etl_postcode.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg2
import shapefile
import shapely.geometry
from dotenv import load_dotenv
from psycopg2.extras import execute_values
from shapely import STRtree


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "extracted"

POA_SHP = DATA / "POA_2021_AUST_GDA2020_SHP" / "POA_2021_AUST_GDA2020.shp"
SAL_SHP = DATA / "SAL_2021_AUST_GDA2020_SHP" / "SAL_2021_AUST_GDA2020.shp"

TARGET_GCCSA_CODES = ("1GSYD", "2GMEL")

# NSW postcodes start with 2, Victorian ones with 3. Prefiltering here keeps the
# STRtree to the ~1,300 relevant POAs instead of all 2,644.
TARGET_POSTCODE_PREFIXES = ("2", "3")

# Slivers along a shared border are not a real overlap.
MIN_OVERLAP_RATIO = 0.001

# Below this, the largest-area POA is not a confident answer — printed for review.
REVIEW_OVERLAP_RATIO = 0.9

# Suburbs where largest-area overlap picks a postcode that is not the one the
# property sites use. Keyed by sal_code, not name, so an ABS rename fails loudly
# (see the dead-key check in apply_overrides) instead of silently doing nothing.
POSTCODE_OVERRIDES: dict[str, str] = {
    # Melbourne: the SAL includes Kings Domain / Botanic Gardens, so 3004 wins on
    # area while the CBD (3000) holds essentially all of the housing.
    "21640": "3000",
    "11649": "2560",  # Glen Alpine — area splits 0.53/0.47 with 2563
    "13411": "2760",  # Ropes Crossing — area splits 0.56/0.44 with 2747
}


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


def check_file(path: Path) -> None:
    if not path.exists():
        sys.exit(
            f"ERROR: Source file not found:\n  {path}\n"
            "Download the ABS 2021 shapefile and extract it as described in "
            "docs/planning/sales-history-links-plan.md section 3."
        )


def to_shapely(shape):
    """Convert a pyshp shape to a shapely geometry, repairing if invalid."""
    geom = shapely.geometry.shape(shape.__geo_interface__)
    return geom if geom.is_valid else geom.buffer(0)


def load_postcodes() -> tuple[list, list[str]]:
    """Read NSW/VIC postcode polygons. Returns (geometries, parallel postcode list)."""
    check_file(POA_SHP)
    print("Reading POA shapefile ...")

    reader = shapefile.Reader(str(POA_SHP))
    fields = [f[0] for f in reader.fields[1:]]

    geoms: list = []
    codes: list[str] = []
    skipped = 0

    for shape, record in zip(reader.shapes(), reader.records()):
        attrs = dict(zip(fields, record))
        code = str(attrs["POA_CODE21"]).strip()

        # 'ZZZZ' and friends are no-usual-address / offshore pseudo-areas.
        if not code.isdigit() or not code.startswith(TARGET_POSTCODE_PREFIXES):
            continue
        # A few POA records carry no geometry at all.
        if not shape.points:
            skipped += 1
            continue
        try:
            geom = to_shapely(shape)
        except Exception:
            skipped += 1
            continue
        if geom.is_empty or geom.area == 0:
            skipped += 1
            continue

        geoms.append(geom)
        codes.append(code)

    if not geoms:
        sys.exit("ERROR: No NSW/VIC postcode polygons were read — is this the 2021 POA release?")

    print(f"  {len(geoms):,} NSW/VIC postcodes | {skipped} skipped (no usable geometry)")
    return geoms, codes


def load_target_sal_codes(connection) -> set[str]:
    """The suburbs the app actually serves — Greater Sydney and Greater Melbourne."""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT sal_code FROM geo_sal WHERE gccsa_code = ANY(%s)",
            (list(TARGET_GCCSA_CODES),),
        )
        codes = {sal_code for (sal_code,) in cursor.fetchall()}

    if not codes:
        sys.exit(
            "ERROR: geo_sal has no Sydney/Melbourne rows. "
            "Run `python etl.py --step geo` first."
        )
    return codes


def match_postcodes(target_sal_codes: set[str], poa_geoms: list, poa_codes: list[str]):
    """Overlap every in-scope suburb with the postcode polygons.

    Returns (rows, review, unmatched) where rows is [(sal_code, postcode)],
    review lists the low-confidence matches and unmatched the suburbs with none.
    """
    check_file(SAL_SHP)
    print("Reading SAL shapefile and computing SAL→POA overlap ...")

    tree = STRtree(poa_geoms)
    reader = shapefile.Reader(str(SAL_SHP))
    fields = [f[0] for f in reader.fields[1:]]

    rows: list[tuple[str, str]] = []
    review: list[tuple[str, str, list[tuple[float, str]]]] = []
    unmatched: list[tuple[str, str]] = []

    for shape, record in zip(reader.shapes(), reader.records()):
        attrs = dict(zip(fields, record))
        sal_code = str(attrs["SAL_CODE21"]).strip()
        if sal_code not in target_sal_codes:
            continue

        sal_name = attrs["SAL_NAME21"]
        if not shape.points:
            unmatched.append((sal_code, sal_name))
            continue
        try:
            sal_geom = to_shapely(shape)
        except Exception:
            unmatched.append((sal_code, sal_name))
            continue

        sal_area = sal_geom.area
        if sal_area == 0:
            unmatched.append((sal_code, sal_name))
            continue

        overlaps: list[tuple[float, str]] = []
        for idx in tree.query(sal_geom, predicate="intersects"):
            try:
                ratio = sal_geom.intersection(poa_geoms[idx]).area / sal_area
            except Exception:
                continue
            if ratio > MIN_OVERLAP_RATIO:
                overlaps.append((ratio, poa_codes[idx]))

        if not overlaps:
            unmatched.append((sal_code, sal_name))
            continue

        overlaps.sort(reverse=True)
        rows.append((sal_code, overlaps[0][1]))
        if overlaps[0][0] < REVIEW_OVERLAP_RATIO:
            review.append((sal_code, sal_name, overlaps[:3]))

    return rows, review, unmatched


def apply_overrides(rows: list[tuple[str, str]]) -> list[tuple[str, str]]:
    """Replace the few largest-area answers the property sites disagree with."""
    matched = {sal_code for sal_code, _ in rows}
    dead_keys = set(POSTCODE_OVERRIDES).difference(matched)
    if dead_keys:
        # A stale override is a silent wrong link, so fail rather than warn.
        sys.exit(
            "ERROR: POSTCODE_OVERRIDES contains sal_codes that are not in scope: "
            f"{sorted(dead_keys)}\nRemove them or correct the codes."
        )

    applied = 0
    result: list[tuple[str, str]] = []
    for sal_code, postcode in rows:
        override = POSTCODE_OVERRIDES.get(sal_code)
        if override and override != postcode:
            applied += 1
            postcode = override
        result.append((sal_code, postcode))

    print(f"  {applied} row(s) corrected by POSTCODE_OVERRIDES")
    return result


def upsert(connection, rows: list[tuple[str, str]]) -> None:
    with connection:
        with connection.cursor() as cursor:
            execute_values(
                cursor,
                """
                UPDATE geo_sal AS g
                SET postcode = v.postcode
                FROM (VALUES %s) AS v(sal_code, postcode)
                WHERE g.sal_code = v.sal_code
                """,
                rows,
                page_size=500,
            )


def verify(connection) -> None:
    """Coverage per city, plus known-truth spot checks."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT gccsa_name, COUNT(*), COUNT(postcode)
            FROM geo_sal
            WHERE gccsa_code = ANY(%s)
            GROUP BY gccsa_name
            ORDER BY gccsa_name
            """,
            (list(TARGET_GCCSA_CODES),),
        )
        print("\n── Postcode coverage ─────────────────────────────────")
        for city, total, filled in cursor.fetchall():
            print(f"  {city}: {filled:,}/{total:,} suburbs have a postcode")

        cursor.execute(
            """
            SELECT sal_name, state_name, postcode
            FROM geo_sal
            WHERE sal_name = ANY(%s)
            ORDER BY sal_name
            """,
            ([
                "Ultimo", "Bondi", "Chatswood", "Glebe (NSW)",
                "Carlton (Vic.)", "Box Hill (Vic.)", "Melbourne",
            ],),
        )
        print("\n── Spot checks (expect 2007 2026 2067 2037 3053 3128 3000) ──")
        for name, state, postcode in cursor.fetchall():
            print(f"  {name} ({state}): {postcode}")


def main() -> None:
    print("=== SuburbLens ETL: Suburb → postcode (POA 2021) ===\n")

    poa_geoms, poa_codes = load_postcodes()

    connection = get_connection()
    try:
        target_sal_codes = load_target_sal_codes(connection)
        print(f"In scope (Greater Sydney / Greater Melbourne): {len(target_sal_codes):,} suburbs\n")

        rows, review, unmatched = match_postcodes(target_sal_codes, poa_geoms, poa_codes)
        print(f"  {len(rows):,} suburbs matched a postcode")

        if review:
            print(f"\n── Low confidence (top overlap < {REVIEW_OVERLAP_RATIO}) ──")
            for sal_code, sal_name, overlaps in review:
                shown = ", ".join(f"{code} {ratio:.2f}" for ratio, code in overlaps)
                override = POSTCODE_OVERRIDES.get(sal_code)
                suffix = f"  → override {override}" if override else "  ← REVIEW"
                print(f"  {sal_name} ({sal_code}): {shown}{suffix}")

        if unmatched:
            print(f"\n── No postcode matched ({len(unmatched)}) ──")
            for sal_code, sal_name in unmatched:
                print(f"  {sal_name} ({sal_code})")

        rows = apply_overrides(rows)

        upsert(connection, rows)
        print(f"\nUpdated {len(rows):,} geo_sal rows.")
        verify(connection)
    finally:
        connection.close()


if __name__ == "__main__":
    main()
