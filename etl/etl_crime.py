#!/usr/bin/env python3
"""
etl_crime.py — 载入大墨尔本 suburb 级犯罪事件数（VIC CSA, Table 03）。

读取 data/crime/ 下的 xlsx，映射 Offence Subdivision → 归一类别，
按 suburb 名解析 sal_code（仅 VIC + 大墨尔本），聚合到年度入库。幂等（TRUNCATE 后全量灌）。

依赖：pandas, openpyxl, psycopg2；连接串来自 etl/.env 的 SUPABASE_DB_URL。

Usage:
    cd etl
    python etl_crime.py
"""
import re
import sys
import pandas as pd
from pathlib import Path
from etl import get_connection                 # 复用 etl/etl.py:128 的连接函数
from psycopg2.extras import execute_values

DATA = Path(__file__).resolve().parent.parent / "data" / "crime"
VIC_XLSX = DATA / "Data_Tables_LGA_Criminal_Incidents_Year_Ending_March_2026_0.xlsx"
SHEET = "Table 03"

# —— VIC Offence Subdivision → 归一类别（其余全部落到 "other"）——
VIC_MAP = {
    "A20 Assault and related offences": "assault",
    "B30 Burglary/Break and enter":     "break_enter",
    "B40 Theft":                        "theft",
    "A50 Robbery":                      "robbery",
    "B20 Property damage":              "property_damage",
}


def norm(s: str) -> str:
    """名字归一：去首尾空格、压缩内部空白、转小写，并剥掉末尾的消歧括号后缀。用于 suburb 名匹配。

    geo_sal 对跨州重名的 suburb 带消歧后缀（如 'Carlton (Vic.)'、'Bellfield (Banyule - Vic.)'），
    而 CSA 源文件是纯名（'Carlton'）。不剥后缀会漏掉 101 个大墨尔本 suburb（含 Carlton / Brunswick /
    Richmond / Box Hill 等）。已核对：剥后缀后 572 个大墨尔本 SAL 全匹配，且无重名塌缩、无重复计数。
    """
    s = re.sub(r"\s+", " ", str(s).strip().lower())
    return re.sub(r"\s*\([^)]*\)\s*$", "", s).strip()


def load_and_aggregate() -> pd.DataFrame:
    if not VIC_XLSX.exists():
        sys.exit(f"ERROR: 找不到源文件:\n  {VIC_XLSX}\n  （确认已下载到 data/crime/，见 §2）")

    print(f"  Reading {VIC_XLSX.name} [{SHEET}] ...")
    df = pd.read_excel(VIC_XLSX, sheet_name=SHEET)

    needed = {"Suburb/Town Name", "Year", "Offence Subdivision", "Incidents Recorded"}
    missing = needed - set(df.columns)
    if missing:
        sys.exit(f"ERROR: 缺列 {missing}；实际列: {list(df.columns)}（CSA 可能改了表头，见 §3）")

    df["category"] = df["Offence Subdivision"].map(VIC_MAP).fillna("other")

    # suburb 跨 postcode/LGA → 按 (suburb, year, category) 求和
    g = (df.groupby(["Suburb/Town Name", "Year", "category"])["Incidents Recorded"]
           .sum().reset_index())
    print(f"  {len(df)} 源行 → {len(g)} 聚合行；{df['Suburb/Town Name'].nunique()} 个 suburb（全州）")
    return g


def main() -> None:
    print("=== SuburbLens ETL: Crime (VIC CSA, Table 03) ===\n")
    g = load_and_aggregate()

    conn = get_connection()
    try:
        with conn:
            with conn.cursor() as cur:
                # 只取 VIC(state_code='2') 且大墨尔本(2GMEL) 的 SAL
                # 注意：geo_sal 没有 sal_name_lower 列 —— SELECT sal_name 后在 Python norm()
                cur.execute("""
                    SELECT sal_name, sal_code
                    FROM geo_sal
                    WHERE state_code = '2' AND gccsa_code = '2GMEL'
                """)
                lookup = {norm(name): code for name, code in cur.fetchall()}
                print(f"  大墨尔本 SAL 词典：{len(lookup)} 个 suburb")

                rows, unmatched = [], set()
                for _, r in g.iterrows():
                    sal = lookup.get(norm(r["Suburb/Town Name"]))
                    if sal is None:
                        unmatched.add(r["Suburb/Town Name"])
                        continue
                    rows.append((sal, r["category"],
                                 int(r["Year"]), int(r["Incidents Recorded"])))

                print(f"  matched {len(rows)} 行；{len(unmatched)} 个 suburb 未匹配"
                      f"（全州非墨尔本，预期大量落选）")

                cur.execute("TRUNCATE crime_by_suburb")
                execute_values(cur, """
                    INSERT INTO crime_by_suburb
                        (sal_code, offence_category, year_ending, incidents)
                    VALUES %s
                    ON CONFLICT (sal_code, offence_category, year_ending)
                    DO UPDATE SET incidents =
                        crime_by_suburb.incidents + EXCLUDED.incidents
                """, rows)
                print(f"  已写入 crime_by_suburb（TRUNCATE 后全量灌）")
        verify()
    finally:
        conn.close()


def verify() -> None:
    """跑完自检：按年汇总 + 抽查一个 suburb。"""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT year_ending, COUNT(*) AS rows, SUM(incidents) AS incidents
                FROM crime_by_suburb GROUP BY year_ending ORDER BY year_ending
            """)
            print("\n── crime_by_suburb 按年 ─────────────────")
            print(f"  {'Year':<6}{'rows':>8}{'incidents':>14}")
            for y, n, inc in cur.fetchall():
                print(f"  {y:<6}{n:>8}{inc:>14,}")

            # 注意用 'Carlton%'：geo_sal 里 Carlton 的名字是 'Carlton (Vic.)'
            cur.execute("""
                SELECT s.sal_name, c.year_ending, c.offence_category, c.incidents
                FROM crime_by_suburb c JOIN geo_sal s ON s.sal_code = c.sal_code
                WHERE s.sal_name ILIKE 'Carlton (%' AND s.gccsa_code='2GMEL'
                  AND c.year_ending = (SELECT max(year_ending) FROM crime_by_suburb)
                ORDER BY c.incidents DESC
            """)
            print("\n── 抽查 Carlton（最新年份）──────────────")
            for name, y, cat, inc in cur.fetchall():
                print(f"  {name:<16}{y}  {cat:<16}{inc:>6}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
