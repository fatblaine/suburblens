#!/usr/bin/env python3
"""
etl_amenities.py — 载入 OSM 本地生活配套 POI 计数（大悉尼 + 大墨尔本）。

从 Overpass API 按 城市 x 类别 拉 POI（共 6 次请求，原始响应缓存到 data/osm/），
点位批量插入临时表后在 Postgres 里用 ST_Contains 空间 JOIN 到 geo_sal，
聚合成每区每类计数写入 amenity_counts。幂等（TRUNCATE 后全量灌）。

方案见 docs/planning/local-amenities-plan.md。三个容易踩的坑（都不会报错，只是数字悄悄错）：
  1. 必须用 nwr 而不是 node —— 超市/商场在 OSM 里多是建筑轮廓(way)，只查 node 会漏掉大半。
  2. 必须用 `out center` —— out body / out tags 拿不到 way 的坐标。
  3. HTTP 200 也可能是残缺结果 —— 要检查 JSON 里的 remark 字段。

数据源：OpenStreetMap，(c) OpenStreetMap contributors，ODbL。

依赖：requests, psycopg2；连接串来自 etl/.env 的 SUPABASE_DB_URL。

Usage:
    cd etl
    python etl_amenities.py                  # 有缓存就用缓存
    python etl_amenities.py --refresh        # 强制重新下载
    python etl_amenities.py --only food      # 只跑一个类别（首次验证空间 JOIN 用）
"""
import json
import os
import sys
import time
import requests
from pathlib import Path
from dotenv import load_dotenv
from etl import get_connection                 # 复用 etl/etl.py:128 的连接函数
from psycopg2.extras import execute_values

CACHE = Path(__file__).resolve().parent.parent / "data" / "osm"

# —— Overpass 端点（按顺序轮换，主站挂了自动换下一个）——
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]
# Overpass 运维方要求 User-Agent 里带来源 + 联系方式，否则可能被限流。
# 在 etl/.env 里加一行 OSM_CONTACT=you@example.com。
# HTTP 头只能是 latin-1：非 ASCII（比如中文占位符）会让 requests 在发请求前
# 就抛 UnicodeEncodeError，所以这里强制过滤成 ASCII。
load_dotenv()
CONTACT = (os.environ.get("OSM_CONTACT") or "").strip()
CONTACT = CONTACT.encode("ascii", "ignore").decode() or "OSM_CONTACT-not-set"
HEADERS = {"User-Agent": f"SuburbLens-ETL/1.0 (+https://suburblens.com; {CONTACT})"}

# —— 大悉尼 / 大墨尔本 bbox：(south, west, north, east) ——
# 故意比 GCCSA 边界开大一圈：框外的点会在空间 JOIN 时自然丢弃（多抓无害），
# 而抓少了会让边缘郊区永远是 0 且不报错（抓少才是灾难）。
BBOX = {
    "syd": (-34.40, 150.00, -32.90, 151.60),   # 含蓝山、中央海岸、Wollondilly
    "mel": (-38.55, 144.30, -37.20, 146.30),   # 含莫宁顿半岛、Yarra Ranges
}

# —— 类别 → OSM tag 显式映射（照 etl_crime.py 的 VIC_MAP 范式）——
# 映射之外的一律不查。v1 先不做 retail。
CATEGORIES = {
    "food":      {"amenity": ["restaurant", "cafe", "fast_food"]},
    "nightlife": {"amenity": ["bar", "pub", "nightclub"]},
    "grocery":   {"shop":    ["supermarket", "convenience", "greengrocer"]},
}

QUERY_TIMEOUT = 180      # Overpass 服务端允许的查询秒数（504 频繁时调到 300）
HTTP_TIMEOUT = 300       # 本地 socket 超时，必须大于 QUERY_TIMEOUT
POLITE_SLEEP = 5         # 两次真实请求之间的礼貌间隔（读缓存时不 sleep）


def build_query(bbox: tuple, spec: dict) -> str:
    """拼 Overpass QL。

    nwr = node + way + relation（坑 1）；out center 让服务器算好 way/relation
    的几何中心（坑 2）。正则的 ^...$ 必须加，否则会匹配到含该子串的其它 tag 值。
    """
    s, w, n, e = bbox
    clauses = "".join(
        f'  nwr["{key}"~"^({"|".join(vals)})$"];\n'
        for key, vals in spec.items()
    )
    return (f"[out:json][timeout:{QUERY_TIMEOUT}][bbox:{s},{w},{n},{e}];\n"
            f"(\n{clauses});\n"
            f"out center;\n")


def overpass(query: str, label: str, tries: int = 4) -> list:
    """发查询，带端点轮换 + 退避重试。返回 elements 列表；重试用尽则退出。"""
    for attempt in range(tries):
        url = ENDPOINTS[attempt % len(ENDPOINTS)]
        print(f"    [{label}] 尝试 {attempt + 1}/{tries} -> {url.split('/')[2]}")
        try:
            r = requests.post(url, data={"data": query},
                              headers=HEADERS, timeout=HTTP_TIMEOUT)
        except requests.RequestException as exc:
            print(f"    网络错误：{type(exc).__name__}: {exc}")
            r = None

        if r is not None:
            if r.status_code == 400:
                # 语法错误重试多少次都没用，直接停并把服务器原话打出来
                sys.exit(f"ERROR: Overpass 拒绝了查询（语法错）：\n{r.text[:800]}\n\n"
                         f"出错的查询：\n{query}")
            if r.status_code == 200:
                try:
                    data = r.json()
                except ValueError:
                    print(f"    返回的不是 JSON（前 200 字）：{r.text[:200]}")
                    data = None
                if data is not None:
                    if "remark" in data:
                        # 坑 3：200 也可能是残缺结果，remark 里写着 runtime error
                        print(f"    服务器 remark（当失败处理）：{data['remark']}")
                    else:
                        els = data.get("elements", [])
                        print(f"    OK：{len(els)} 个 element")
                        return els
            else:
                note = "（限流，排队中）" if r.status_code == 429 else ""
                print(f"    HTTP {r.status_code}{note}")

        if attempt < tries - 1:
            wait = 30 * (attempt + 1)
            print(f"    等待 {wait}s 后重试 ...")
            time.sleep(wait)

    sys.exit(f"ERROR: [{label}] 重试 {tries} 次仍失败。稍后再跑，"
             f"或改用方案 §2.2 的 Geofabrik pbf 离线备选。")


def fetch(city: str, category: str, refresh: bool) -> list:
    """取一个 (城市, 类别) 的 elements；优先读 data/osm/ 缓存。"""
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"osm_{city}_{category}.json"

    if path.exists() and not refresh:
        els = json.loads(path.read_text(encoding="utf-8"))
        print(f"  {city}/{category}: 用缓存 {path.name}（{len(els)} 个 element）")
        return els

    print(f"  {city}/{category}: 向 Overpass 请求 ...")
    els = overpass(build_query(BBOX[city], CATEGORIES[category]), f"{city}/{category}")
    path.write_text(json.dumps(els), encoding="utf-8")
    print(f"  {city}/{category}: 已缓存到 {path.name}")
    time.sleep(POLITE_SLEEP)          # 礼貌间隔，别连着轰公共服务器
    return els


def to_points(elements: list, category: str) -> list:
    """element -> (lng, lat, category, name)。node 取 lat/lon，way/relation 取 center。"""
    out, no_coord = [], 0
    for el in elements:
        if el.get("type") == "node":
            lng, lat = el.get("lon"), el.get("lat")
        else:
            c = el.get("center") or {}
            lng, lat = c.get("lon"), c.get("lat")
        if lng is None or lat is None:
            no_coord += 1                                # 没坐标的（极少）直接丢
            continue
        name = (el.get("tags") or {}).get("name") or ""
        out.append((lng, lat, category, name))
    if no_coord:
        print(f"    （{no_coord} 个 element 无坐标，已丢弃；若数量很大说明 out 语句写错了）")
    return out


def dedupe(points: list) -> list:
    """同一家店同时被画成点和面时会重复。按 (类别, 名字, 坐标 4 位小数约 11m) 去重。

    无名 POI 不参与去重（没有可靠标识，宁可多算也别误删两家挨着的店）。
    """
    seen, out = set(), []
    for lng, lat, cat, name in points:
        key = (cat, name.strip().lower(), round(lat, 4), round(lng, 4))
        if name and key in seen:
            continue
        if name:
            seen.add(key)
        out.append((lng, lat, cat))
    dropped = len(points) - len(out)
    if dropped:
        print(f"  去重丢弃 {dropped} 个重复点（同名同位置）")
    return out


def parse_args() -> tuple[bool, dict]:
    argv = sys.argv[1:]
    refresh = "--refresh" in argv
    cats = dict(CATEGORIES)
    if "--only" in argv:
        i = argv.index("--only")
        if i + 1 >= len(argv):
            sys.exit("ERROR: --only 后面要跟类别名，如 --only food")
        name = argv[i + 1]
        if name not in CATEGORIES:
            sys.exit(f"ERROR: 未知类别 {name!r}；可选：{', '.join(CATEGORIES)}")
        cats = {name: CATEGORIES[name]}
        print(f"  （--only {name}：本次只处理这一个类别，"
              f"amenity_counts 会被清空成只剩它）\n")
    return refresh, cats


def main() -> None:
    print("=== SuburbLens ETL: Local Amenities (OpenStreetMap / Overpass) ===\n")
    if CONTACT == "OSM_CONTACT-not-set":
        print("  WARN: etl/.env 里没设 OSM_CONTACT。Overpass 建议留联系方式，"
              "不设也能跑，但被限流时对方无法通知你。")
    refresh, cats = parse_args()

    print("── 1. 拉取 OSM POI ──────────────────────")
    raw = []
    for city in BBOX:
        for category in cats:
            raw += to_points(fetch(city, category, refresh), category)
    print(f"\n  合计 {len(raw)} 个原始 POI（两城 bbox 内，含框外冗余）")
    if not raw:
        sys.exit("ERROR: 一个 POI 都没拿到。检查 bbox 顺序（南,西,北,东）和 out 语句，"
                 "见方案 §3.3 故障对照表。")

    points = dedupe(raw)

    print("\n── 2. 空间 JOIN + 入库 ──────────────────")
    conn = get_connection()
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TEMP TABLE tmp_poi (
                        lng float8, lat float8, category text
                    ) ON COMMIT DROP
                """)
                execute_values(cur,
                               "INSERT INTO tmp_poi (lng, lat, category) VALUES %s",
                               points, page_size=2000)
                print(f"  临时表载入 {len(points)} 点")

                cur.execute("TRUNCATE amenity_counts")
                # 计算下推 Postgres（项目约定）；geo_sal.geom 上的 GIST 索引会被用上。
                # ST_MakePoint 是 (经度, 纬度) —— 别写反。
                cur.execute("""
                    INSERT INTO amenity_counts (sal_code, category, poi_count)
                    SELECT s.sal_code, p.category, COUNT(*)
                    FROM tmp_poi p
                    JOIN geo_sal s
                      ON s.gccsa_code IN ('1GSYD', '2GMEL')
                     AND ST_Contains(s.geom,
                                     ST_SetSRID(ST_MakePoint(p.lng, p.lat), 4326))
                    GROUP BY s.sal_code, p.category
                """)
                inserted = cur.rowcount
                print(f"  写入 amenity_counts：{inserted} 行")

                cur.execute("SELECT COALESCE(SUM(poi_count), 0) FROM amenity_counts")
                kept = (cur.fetchone() or (0,))[0]
                print(f"  {len(points)} 个点里 {kept} 个落在两城 SAL 内"
                      f"（{kept / len(points):.0%}；其余在 bbox 内但在城界外，预期丢弃）")
        verify()
    finally:
        conn.close()


def verify() -> None:
    """跑完自检：类别汇总 + 按城市 + 抽查两个已知 suburb + 零 POI 的大区。"""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT category, COUNT(DISTINCT sal_code) AS suburbs,
                       SUM(poi_count) AS pois
                FROM amenity_counts GROUP BY category ORDER BY category
            """)
            print("\n── amenity_counts 按类别 ────────────────")
            print(f"  {'category':<12}{'suburbs':>10}{'pois':>10}")
            for cat, n, pois in cur.fetchall():
                print(f"  {cat:<12}{n:>10}{pois:>10,}")

            cur.execute("""
                SELECT s.gccsa_name, SUM(c.poi_count)
                FROM amenity_counts c JOIN geo_sal s USING (sal_code)
                GROUP BY 1 ORDER BY 1
            """)
            print("\n── 按城市 ───────────────────────────────")
            for city, pois in cur.fetchall():
                print(f"  {city:<24}{pois:>8,}")

            # 两个典型内城餐饮区，food 应是几十家量级；个位数 = 有问题
            for pattern, label in [("Glebe%", "Glebe (SYD)"),
                                   ("Carlton (%", "Carlton (MEL)")]:
                cur.execute("""
                    SELECT s.sal_name, c.category, c.poi_count
                    FROM amenity_counts c JOIN geo_sal s USING (sal_code)
                    WHERE s.sal_name ILIKE %s
                    ORDER BY s.sal_name, c.category
                """, (pattern,))
                print(f"\n── 抽查 {label} ──────────────────────")
                rows = cur.fetchall()
                if not rows:
                    print("  （没有任何记录 —— 可疑，检查 bbox / tag 映射）")
                for name, cat, n in rows:
                    print(f"  {name:<24}{cat:<12}{n:>5}")

            # 零 POI 的大面积 suburb 应该是国家公园/水库/工业地；
            # 若出现 Palm Beach / Portsea / Wollondilly 这类有人住的地方 → bbox 切小了
            cur.execute("""
                SELECT s.sal_name, s.gccsa_name, ROUND(s.area_sqkm::numeric, 1)
                FROM geo_sal s
                LEFT JOIN amenity_counts c ON c.sal_code = s.sal_code
                WHERE s.gccsa_code IN ('1GSYD', '2GMEL') AND c.sal_code IS NULL
                ORDER BY s.area_sqkm DESC
                LIMIT 10
            """)
            print("\n── 零 POI 的 suburb（按面积倒序 Top 10）─")
            print("   预期是国家公园/水库/工业地；出现有人住的地方 = bbox 切小了")
            for name, city, area in cur.fetchall():
                print(f"  {name:<30}{city:<22}{area:>8} km2")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
