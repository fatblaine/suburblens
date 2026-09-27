#!/usr/bin/env python3
"""
etl_crime.py — 载入大墨尔本 + 大悉尼 suburb 级犯罪事件数。

- VIC：Crime Statistics Agency (CSA) LGA 工作簿的 Table 03，逐年（year ending June）长表。
- NSW：BOCSAR "Recorded Criminal Incidents by month – by Suburb"，逐月宽表，按 7 月–次年 6 月
  加总成 year ending June 年度值，与 VIC 口径对齐。

两州各自映射到同一套归一类别，按 suburb 名解析 sal_code（VIC 只取 2GMEL，NSW 只取 1GSYD），
在同一个事务里 TRUNCATE 后全量灌入 crime_by_suburb。幂等。

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
VIC_XLSX = DATA / "2026-06" / "vic" / "Data_Tables_LGA_Criminal_Incidents_Year_Ending_June_2026.xlsx"
SHEET = "Table 03"
NSW_CSV = DATA / "2026-06" / "nsw" / "SuburbData.csv"

# NSW 源数据从 1995 年开始；只取与 VIC Table 03 相同的起始年，库里两州年份范围一致
FIRST_YEAR = 2017

# —— VIC Offence Subdivision → 归一类别（其余全部落到 "other"）——
VIC_MAP = {
    "A20 Assault and related offences": "assault",
    "B30 Burglary/Break and enter":     "break_enter",
    "B40 Theft":                        "theft",
    "A50 Robbery":                      "robbery",
    "B20 Property damage":              "property_damage",
}

# —— NSW Subcategory → 归一类别（其余全部落到 "other"）——
# 跑在 Subcategory 而非 Offence category：NSW 的入室盗窃藏在大类 "Theft" 下。
# 为与 VIC 对齐：Fraud 归 other（VIC 在 B50 Deception）；Arson 归 other（VIC 在 B10 Arson）。
NSW_MAP = {
    "Domestic violence related assault":     "assault",
    "Non-domestic violence related assault": "assault",
    "Assault Police":                        "assault",
    "Break and enter dwelling":              "break_enter",
    "Break and enter non-dwelling":          "break_enter",
    "Receiving or handling stolen goods":    "theft",
    "Motor vehicle theft":                   "theft",
    "Steal from motor vehicle":              "theft",
    "Steal from retail store":               "theft",
    "Steal from dwelling":                   "theft",
    "Steal from person":                     "theft",
    "Stock theft":                           "theft",
    "Other theft":                           "theft",
    "Robbery without a weapon":              "robbery",
    "Robbery with a firearm":                "robbery",
    "Robbery with a weapon not a firearm":   "robbery",
    "Malicious damage to property":          "property_damage",
}

# —— NSW 不入库的 Offence category ——
# 公共交通违规（主要是逃票）：大悉尼一年约 4.2 万起，VIC 全州 F20 只有约 275 起 —— VIC 基本不把它
# 记为刑事事件。保留会让有火车站的 suburb 排名虚高，也破坏两州口径，故整类排除（Methodology 页已注明）。
NSW_EXCLUDE = {"Transport regulatory offences"}


def norm(s: str) -> str:
    """VIC 名字归一：去首尾空格、压缩内部空白、转小写，并剥掉末尾的消歧括号后缀。用于 suburb 名匹配。

    geo_sal 对跨州重名的 suburb 带消歧后缀（如 'Carlton (Vic.)'、'Bellfield (Banyule - Vic.)'），
    而 CSA 源文件是纯名（'Carlton'）。不剥后缀会漏掉 101 个大墨尔本 suburb（含 Carlton / Brunswick /
    Richmond / Box Hill 等）。已核对：剥后缀后 572 个大墨尔本 SAL 全匹配，且无重名塌缩、无重复计数。
    """
    s = re.sub(r"\s+", " ", str(s).strip().lower())
    return re.sub(r"\s*\([^)]*\)\s*$", "", s).strip()


def norm_nsw(s: str) -> str:
    """NSW 名字归一：只去掉州标记，保留括号里的 LGA，做精确匹配。

    BOCSAR 用 LGA 区分州内重名（'Darlington (Sydney)' vs 'Darlington (Singleton)'），
    geo_sal 的写法是 'Darlington (Sydney - NSW)'；跨州重名则是 'Abbotsford (NSW)' vs 源文件的 'Abbotsford'。
    不能沿用 norm() 整个剥括号 —— 那会把 21 个悉尼 suburb（Enmore / Punchbowl / The Rocks 等）
    与外地同名 suburb 合并、重复计数。已核对：921 个大悉尼 SAL 匹配 920 个（Womerah 源文件无记录），无塌缩。
    """
    s = re.sub(r"\s+", " ", str(s).strip().lower())
    s = re.sub(r"\s*\(nsw\)$", "", s)
    return re.sub(r"\s+-\s+nsw\)$", ")", s)


def load_vic() -> pd.DataFrame:
    """返回 (suburb, year_ending, category, incidents)，全州 suburb。"""
    if not VIC_XLSX.exists():
        sys.exit(f"ERROR: 找不到源文件:\n  {VIC_XLSX}\n  （确认已下载到 data/crime/<YYYY-MM>/vic/）")

    print(f"  [VIC] Reading {VIC_XLSX.name} [{SHEET}] ...")
    df = pd.read_excel(VIC_XLSX, sheet_name=SHEET)

    needed = {"Suburb/Town Name", "Year", "Year ending", "Offence Subdivision", "Incidents Recorded"}
    missing = needed - set(df.columns)
    if missing:
        sys.exit(f"ERROR: 缺列 {missing}；实际列: {list(df.columns)}（CSA 可能改了表头）")
    ending = set(df["Year ending"].unique())
    if ending != {"June"}:
        sys.exit(f"ERROR: VIC 截止月是 {ending}，库里口径是 year ending June（NSW 按此对齐）")

    df["category"] = df["Offence Subdivision"].map(VIC_MAP).fillna("other")

    # suburb 跨 postcode/LGA → 按 (suburb, year, category) 求和
    g = (df.groupby(["Suburb/Town Name", "Year", "category"])["Incidents Recorded"]
           .sum().reset_index())
    g.columns = ["suburb", "year_ending", "category", "incidents"]
    print(f"  [VIC] {len(df)} 源行 → {len(g)} 聚合行；{g['suburb'].nunique()} 个 suburb（全州）")
    return g


def load_nsw(suburbs: set[str]) -> pd.DataFrame:
    """返回 (suburb, year_ending, category, incidents)，只含 norm_nsw 后落在 suburbs 里的 suburb。

    源是宽表（一行 = suburb × subcategory，一列 = 一个月）。先按悉尼 suburb 筛行、按起始年筛列，
    再 melt，内存小得多。只保留 12 个月齐全的年度，最新一年不完整时不会被低估。
    """
    if not NSW_CSV.exists():
        sys.exit(f"ERROR: 找不到源文件:\n  {NSW_CSV}\n  （确认已下载并解压到 data/crime/<YYYY-MM>/nsw/）")

    print(f"  [NSW] Reading {NSW_CSV.name} ...")
    header = pd.read_csv(NSW_CSV, nrows=0).columns
    id_cols = ["Suburb", "Offence category", "Subcategory"]
    if not set(id_cols) <= set(header):
        sys.exit(f"ERROR: 缺列 {set(id_cols) - set(header)}（BOCSAR 可能改了表头）")

    months = pd.to_datetime(pd.Series(header[3:]), format="%b %Y")
    year_ending = months.dt.year + (months.dt.month >= 7).astype(int)
    per_year = year_ending.value_counts()
    full_years = set(per_year[(per_year == 12) & (per_year.index >= FIRST_YEAR)].index)
    keep = [col for col, y in zip(header[3:], year_ending) if y in full_years]
    col_year = dict(zip(header[3:], year_ending))

    df = pd.read_csv(NSW_CSV, usecols=id_cols + keep)
    total_suburbs = df["Suburb"].nunique()
    df = df[df["Suburb"].map(norm_nsw).isin(suburbs) & ~df["Offence category"].isin(NSW_EXCLUDE)]

    long = df.melt(id_vars=id_cols, var_name="month", value_name="incidents")
    long["year_ending"] = long["month"].map(col_year)
    long["category"] = long["Subcategory"].map(NSW_MAP).fillna("other")
    g = (long.groupby(["Suburb", "year_ending", "category"])["incidents"]
             .sum().reset_index())
    g.columns = ["suburb", "year_ending", "category", "incidents"]
    g = g[g["incidents"] > 0]            # 与 VIC 一致：缺行 = 0
    print(f"  [NSW] 年度 {min(full_years)}–{max(full_years)}；全州 {total_suburbs} 个 suburb，"
          f"筛出 {g['suburb'].nunique()} 个大悉尼 suburb → {len(g)} 聚合行")
    return g


def match(g: pd.DataFrame, lookup: dict[str, str], key) -> tuple[list[tuple], set[str]]:
    rows, unmatched = [], set()
    for r in g.itertuples(index=False):
        sal = lookup.get(key(r.suburb))
        if sal is None:
            unmatched.add(r.suburb)
            continue
        rows.append((sal, r.category, int(r.year_ending), int(r.incidents)))
    return rows, unmatched


def main() -> None:
    print("=== SuburbLens ETL: Crime (VIC CSA Table 03 + NSW BOCSAR by Suburb) ===\n")

    conn = get_connection()
    try:
        with conn:
            with conn.cursor() as cur:
                # 注意：geo_sal 没有 sal_name_lower 列 —— SELECT sal_name 后在 Python 里归一
                cur.execute("""
                    SELECT sal_name, sal_code FROM geo_sal
                    WHERE state_code = '2' AND gccsa_code = '2GMEL'
                """)
                vic_lookup = {norm(name): code for name, code in cur.fetchall()}
                cur.execute("""
                    SELECT sal_name, sal_code FROM geo_sal
                    WHERE state_code = '1' AND gccsa_code = '1GSYD'
                """)
                nsw_sal = cur.fetchall()
                nsw_lookup = {norm_nsw(name): code for name, code in nsw_sal}
                if len(nsw_lookup) != len(nsw_sal):
                    sys.exit("ERROR: 大悉尼 SAL 名字归一后有重复，norm_nsw 需要调整")
                print(f"  SAL 词典：大墨尔本 {len(vic_lookup)} 个，大悉尼 {len(nsw_lookup)} 个\n")

                vic_rows, vic_unmatched = match(load_vic(), vic_lookup, norm)
                print(f"  [VIC] matched {len(vic_rows)} 行；{len(vic_unmatched)} 个 suburb 未匹配"
                      f"（全州非墨尔本，预期大量落选）\n")

                nsw_rows, _ = match(load_nsw(set(nsw_lookup)), nsw_lookup, norm_nsw)
                nsw_missing = sorted(name for name, code in nsw_sal
                                     if code not in {r[0] for r in nsw_rows})
                print(f"  [NSW] matched {len(nsw_rows)} 行；无数据的大悉尼 SAL："
                      f"{len(nsw_missing)} 个 {nsw_missing[:10]}")

                cur.execute("TRUNCATE crime_by_suburb")
                execute_values(cur, """
                    INSERT INTO crime_by_suburb
                        (sal_code, offence_category, year_ending, incidents)
                    VALUES %s
                    ON CONFLICT (sal_code, offence_category, year_ending)
                    DO UPDATE SET incidents =
                        crime_by_suburb.incidents + EXCLUDED.incidents
                """, vic_rows + nsw_rows)
                print(f"\n  已写入 crime_by_suburb（TRUNCATE 后全量灌，VIC + NSW 同一事务）")
        verify()
    finally:
        conn.close()


def verify() -> None:
    """跑完自检：按城市 × 年汇总 + 各抽查一个 suburb。"""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT s.gccsa_code, c.year_ending, COUNT(DISTINCT c.sal_code), SUM(c.incidents)
                FROM crime_by_suburb c JOIN geo_sal s ON s.sal_code = c.sal_code
                GROUP BY 1, 2 ORDER BY 1, 2
            """)
            print("\n── crime_by_suburb 按城市 × 年 ─────────────")
            print(f"  {'GCCSA':<7}{'Year':<6}{'suburbs':>9}{'incidents':>12}")
            for gccsa, y, n, inc in cur.fetchall():
                print(f"  {gccsa:<7}{y:<6}{n:>9}{inc:>12,}")

            # 注意用 ILIKE 'X (%'：geo_sal 里的名字带消歧后缀，如 'Carlton (Vic.)'
            for pattern, gccsa in (("Carlton (%", "2GMEL"), ("Parramatta", "1GSYD")):
                cur.execute("""
                    SELECT s.sal_name, c.year_ending, c.offence_category, c.incidents
                    FROM crime_by_suburb c JOIN geo_sal s ON s.sal_code = c.sal_code
                    WHERE s.sal_name ILIKE %s AND s.gccsa_code = %s
                      AND c.year_ending = (SELECT max(year_ending) FROM crime_by_suburb)
                    ORDER BY c.incidents DESC
                """, (pattern, gccsa))
                print(f"\n── 抽查 {pattern.rstrip(' (%')}（最新年份）──────────────")
                for name, y, cat, inc in cur.fetchall():
                    print(f"  {name:<16}{y}  {cat:<16}{inc:>6}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
