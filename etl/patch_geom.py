#!/usr/bin/env python3
"""
One-off patch: read SAL shapefile geometry and update
geo_sal.geom and geo_sal.centroid columns in the database.
"""

import os
import sys
from pathlib import Path

import shapefile
import shapely.geometry
import psycopg2
from psycopg2.extras import execute_batch
from dotenv import load_dotenv

ROOT    = Path(__file__).resolve().parent.parent
SAL_SHP = ROOT / "data" / "extracted" / "SAL_2021_AUST_GDA2020_SHP" / "SAL_2021_AUST_GDA2020.shp"

def main():
    if not SAL_SHP.exists():
        sys.exit(f"ERROR: shapefile not found:\n  {SAL_SHP}")

    load_dotenv()
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        sys.exit("ERROR: SUPABASE_DB_URL not set")

    conn = psycopg2.connect(url)

    with conn.cursor() as cur:
        cur.execute("SELECT sal_code FROM geo_sal")
        existing_codes = {row[0] for row in cur.fetchall()}
    print(f"Found {len(existing_codes)} suburbs in geo_sal, matching against shapefile ...")

    sf     = shapefile.Reader(str(SAL_SHP))
    fields = [f[0] for f in sf.fields[1:]]

    rows   = []
    missed = 0

    for shape, record in zip(sf.shapes(), sf.records()):
        rec      = dict(zip(fields, record))
        sal_code = rec["SAL_CODE21"]

        if sal_code not in existing_codes:
            missed += 1
            continue

        try:
            geom = shapely.geometry.shape(shape.__geo_interface__)
            if not geom.is_valid:
                geom = geom.buffer(0)
        except Exception:
            missed += 1
            continue

        rows.append((geom.wkt, sal_code))

    print(f"Matched {len(rows)} suburbs, skipped {missed}")
    print("Updating geom and centroid ...")

    with conn:
        with conn.cursor() as cur:
            execute_batch(cur, """
                UPDATE geo_sal
                SET
                    geom     = ST_Multi(ST_GeomFromText(%s, 4326)),
                    centroid = ST_GeogFromWKB(
                                   ST_AsEWKB(
                                       ST_Centroid(ST_GeomFromText(%s, 4326))
                                   )
                               )
                WHERE sal_code = %s
            """,
            [(wkt, wkt, code) for wkt, code in rows],
            page_size=200)

    conn.close()
    print("Done!")

if __name__ == "__main__":
    main()
