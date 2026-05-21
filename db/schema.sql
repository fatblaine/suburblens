-- ============================================================================
-- SuburbLens Phase 1 Schema: Tenure Time Machine Only
-- Target: Supabase PostgreSQL 15 + PostGIS
-- Run once in Supabase SQL Editor before ETL
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- ----------------------------------------------------------------------------
-- Geography: user-facing suburbs (SAL)
-- ----------------------------------------------------------------------------
CREATE TABLE geo_sal (
    sal_code           TEXT PRIMARY KEY,
    sal_name           TEXT NOT NULL,
    sal_name_lower     TEXT GENERATED ALWAYS AS (LOWER(sal_name)) STORED,
    state_code         TEXT NOT NULL,
    state_name         TEXT NOT NULL,
    gccsa_code         TEXT NOT NULL,
    gccsa_name         TEXT NOT NULL,
    primary_sa2_code   TEXT,
    area_sqkm          NUMERIC,
    geom               GEOMETRY(MULTIPOLYGON, 4326),
    centroid           GEOGRAPHY(POINT, 4326)
);

CREATE INDEX idx_sal_name_lower ON geo_sal (sal_name_lower);
CREATE INDEX idx_sal_gccsa      ON geo_sal (gccsa_code);
CREATE INDEX idx_sal_geom_gist  ON geo_sal USING GIST (geom);

COMMENT ON TABLE  geo_sal                    IS 'ABS Suburb and Locality（SAL）区域表，作为用户可见的搜索层';
COMMENT ON COLUMN geo_sal.sal_code           IS 'SAL 区域唯一编码（ABS 标准），主键';
COMMENT ON COLUMN geo_sal.sal_name           IS '郊区名称（原始大小写，如 "Surry Hills"）';
COMMENT ON COLUMN geo_sal.sal_name_lower     IS '郊区名称小写形式，由 sal_name 自动生成，供大小写不敏感搜索使用';
COMMENT ON COLUMN geo_sal.state_code         IS '所在州/领地代码（ABS 数字编码，如 1=NSW，2=VIC）';
COMMENT ON COLUMN geo_sal.state_name         IS '所在州/领地全称（如 "New South Wales"）';
COMMENT ON COLUMN geo_sal.gccsa_code         IS '大首府城市统计区代码（如 1GSYD=大悉尼，2GMEL=大墨尔本）';
COMMENT ON COLUMN geo_sal.gccsa_name         IS '大首府城市统计区名称（如 "Greater Sydney"）';
COMMENT ON COLUMN geo_sal.primary_sa2_code   IS '与该 SAL 面积重叠最大的 SA2 区域代码，外键关联 geo_sa2';
COMMENT ON COLUMN geo_sal.area_sqkm          IS '区域面积，单位平方公里';
COMMENT ON COLUMN geo_sal.geom               IS 'SAL 边界多边形几何体，WGS84（EPSG:4326），用于地图展示';
COMMENT ON COLUMN geo_sal.centroid           IS 'SAL 中心点地理坐标，WGS84，用于距离计算及地图定位';

-- ----------------------------------------------------------------------------
-- Geography: ABS statistical units (SA2) — data anchor for cross-year TSP
-- ----------------------------------------------------------------------------
CREATE TABLE geo_sa2 (
    sa2_code           TEXT PRIMARY KEY,
    sa2_name           TEXT NOT NULL,
    gccsa_code         TEXT NOT NULL,
    gccsa_name         TEXT NOT NULL,
    state_code         TEXT NOT NULL,
    state_name         TEXT NOT NULL,
    area_sqkm          NUMERIC,
    geom               GEOMETRY(MULTIPOLYGON, 4326)
);

CREATE INDEX idx_sa2_gccsa ON geo_sa2 (gccsa_code);

COMMENT ON TABLE  geo_sa2                IS 'ABS Statistical Area Level 2（SA2）区域表，作为跨普查年数据锚点';
COMMENT ON COLUMN geo_sa2.sa2_code       IS 'SA2 区域唯一编码（ABS 标准 9 位数字），主键';
COMMENT ON COLUMN geo_sa2.sa2_name       IS 'SA2 区域名称';
COMMENT ON COLUMN geo_sa2.gccsa_code     IS '大首府城市统计区代码';
COMMENT ON COLUMN geo_sa2.gccsa_name     IS '大首府城市统计区名称';
COMMENT ON COLUMN geo_sa2.state_code     IS '所在州/领地代码';
COMMENT ON COLUMN geo_sa2.state_name     IS '所在州/领地全称';
COMMENT ON COLUMN geo_sa2.area_sqkm      IS '区域面积，单位平方公里';
COMMENT ON COLUMN geo_sa2.geom           IS 'SA2 边界多边形几何体，WGS84（EPSG:4326）';

-- ----------------------------------------------------------------------------
-- Bridge: SAL ↔ SA2 correspondence
-- One SAL may map to multiple SA2s; is_primary flags the dominant one.
-- ----------------------------------------------------------------------------
CREATE TABLE geo_sal_to_sa2 (
    sal_code           TEXT    NOT NULL REFERENCES geo_sal(sal_code),
    sa2_code           TEXT    NOT NULL REFERENCES geo_sa2(sa2_code),
    overlap_ratio      NUMERIC NOT NULL,
    is_primary         BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (sal_code, sa2_code)
);

-- Partial index: fast lookup of primary SA2 for each SAL
CREATE INDEX idx_sal_to_sa2_primary ON geo_sal_to_sa2 (sal_code) WHERE is_primary;

COMMENT ON TABLE  geo_sal_to_sa2                  IS 'SAL 与 SA2 的空间对应关系桥接表；一个 SAL 可对应多个 SA2';
COMMENT ON COLUMN geo_sal_to_sa2.sal_code          IS 'SAL 区域编码，外键关联 geo_sal';
COMMENT ON COLUMN geo_sal_to_sa2.sa2_code          IS 'SA2 区域编码，外键关联 geo_sa2';
COMMENT ON COLUMN geo_sal_to_sa2.overlap_ratio     IS 'SAL 与 SA2 的面积重叠比例（0~1），值越大表示重合度越高';
COMMENT ON COLUMN geo_sal_to_sa2.is_primary        IS '是否为该 SAL 对应的主要 SA2（重叠比例最大），每个 SAL 仅一条为 TRUE';

ALTER TABLE geo_sal
    ADD CONSTRAINT fk_sal_primary_sa2
    FOREIGN KEY (primary_sa2_code) REFERENCES geo_sa2(sa2_code);

-- ----------------------------------------------------------------------------
-- Core fact table: TSP Tenure counts (2011 / 2016 / 2021)
-- One row per SA2 per census year — ~2,040 rows for NSW + VIC
-- ----------------------------------------------------------------------------
CREATE TABLE tsp_tenure (
    sa2_code                  TEXT     NOT NULL REFERENCES geo_sa2(sa2_code),
    census_year               SMALLINT NOT NULL,   -- 2011 | 2016 | 2021
    owned_outright            INTEGER,
    owned_with_mortgage       INTEGER,
    rented                    INTEGER,
    other_tenure              INTEGER,
    not_stated                INTEGER,
    total_occupied_dwellings  INTEGER,
    PRIMARY KEY (sa2_code, census_year)
);

COMMENT ON TABLE  tsp_tenure                           IS 'TSP 住宅产权统计事实表，每行为一个 SA2 在某普查年的产权分布数据';
COMMENT ON COLUMN tsp_tenure.sa2_code                  IS 'SA2 区域编码，外键关联 geo_sa2';
COMMENT ON COLUMN tsp_tenure.census_year               IS '人口普查年份，取值 2011、2016 或 2021';
COMMENT ON COLUMN tsp_tenure.owned_outright            IS '完全自有（无贷款）住宅数量';
COMMENT ON COLUMN tsp_tenure.owned_with_mortgage       IS '有贷款自有住宅数量';
COMMENT ON COLUMN tsp_tenure.rented                    IS '租赁住宅数量';
COMMENT ON COLUMN tsp_tenure.other_tenure              IS '其他产权类型住宅数量（如社会住房等）';
COMMENT ON COLUMN tsp_tenure.not_stated                IS '产权类型未申报住宅数量';
COMMENT ON COLUMN tsp_tenure.total_occupied_dwellings  IS '已占用住宅总数（用作百分比计算的分母）';

-- ----------------------------------------------------------------------------
-- Core view: Tenure Time Machine + Residency Shift Index
-- All calculations live here; the API reads this view via Dapper.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_tenure_shift AS
WITH tenure_pct AS (
    SELECT
        sa2_code,
        census_year,
        total_occupied_dwellings,
        CASE WHEN total_occupied_dwellings > 0
            THEN ROUND(100.0 * owned_outright        / total_occupied_dwellings, 1) END AS outright_pct,
        CASE WHEN total_occupied_dwellings > 0
            THEN ROUND(100.0 * owned_with_mortgage   / total_occupied_dwellings, 1) END AS mortgage_pct,
        CASE WHEN total_occupied_dwellings > 0
            THEN ROUND(100.0 * rented                / total_occupied_dwellings, 1) END AS rent_pct
    FROM tsp_tenure
),
pivoted AS (
    SELECT
        sa2_code,
        MAX(CASE WHEN census_year = 2011 THEN outright_pct END) AS outright_2011,
        MAX(CASE WHEN census_year = 2016 THEN outright_pct END) AS outright_2016,
        MAX(CASE WHEN census_year = 2021 THEN outright_pct END) AS outright_2021,
        MAX(CASE WHEN census_year = 2011 THEN mortgage_pct END) AS mortgage_2011,
        MAX(CASE WHEN census_year = 2016 THEN mortgage_pct END) AS mortgage_2016,
        MAX(CASE WHEN census_year = 2021 THEN mortgage_pct END) AS mortgage_2021,
        MAX(CASE WHEN census_year = 2011 THEN rent_pct END)     AS rent_2011,
        MAX(CASE WHEN census_year = 2016 THEN rent_pct END)     AS rent_2016,
        MAX(CASE WHEN census_year = 2021 THEN rent_pct END)     AS rent_2021,
        MAX(CASE WHEN census_year = 2011 THEN total_occupied_dwellings END) AS total_dwellings_2011,
        MAX(CASE WHEN census_year = 2016 THEN total_occupied_dwellings END) AS total_dwellings_2016,
        MAX(CASE WHEN census_year = 2021 THEN total_occupied_dwellings END) AS total_dwellings_2021
    FROM tenure_pct
    GROUP BY sa2_code
),
with_index AS (
    SELECT *,
        ROUND(
            -1.0 * COALESCE(rent_2021     - rent_2016, 0)
           + 0.8 * COALESCE(mortgage_2021 - mortgage_2016, 0)
           + 0.3 * COALESCE(outright_2021 - outright_2016, 0)
        , 2) AS residency_shift_index
    FROM pivoted
)
SELECT
    s.sal_code,
    s.sal_name,
    s.state_name,
    s.gccsa_name,
    sa2.sa2_code,
    sa2.sa2_name,
    w.outright_2011, w.outright_2016, w.outright_2021,
    w.mortgage_2011, w.mortgage_2016, w.mortgage_2021,
    w.rent_2011,     w.rent_2016,     w.rent_2021,
    w.total_dwellings_2011, w.total_dwellings_2016, w.total_dwellings_2021,
    w.residency_shift_index,
    CASE
        WHEN w.residency_shift_index >=  3 THEN 'strong_ownership_shift'
        WHEN w.residency_shift_index >=  1 THEN 'mild_ownership_shift'
        WHEN w.residency_shift_index <= -3 THEN 'strong_rental_shift'
        WHEN w.residency_shift_index <= -1 THEN 'mild_rental_shift'
        ELSE 'stable'
    END AS trend_label
FROM geo_sal s
JOIN geo_sal_to_sa2 m  ON m.sal_code  = s.sal_code  AND m.is_primary
JOIN geo_sa2 sa2       ON sa2.sa2_code = m.sa2_code
LEFT JOIN with_index w ON w.sa2_code  = sa2.sa2_code
WHERE s.gccsa_code IN ('1GSYD', '2GMEL');

COMMENT ON VIEW v_tenure_shift IS
    'Tenure Time Machine 核心视图：将 tsp_tenure 各普查年数据转为百分比并横向展开，'
    '计算 Residency Shift Index（SuburbLens Custom 指标），并 JOIN SAL/SA2 地理信息供 API 直接查询';

-- ----------------------------------------------------------------------------
-- Phase 2: Language spoken at home (TSP T10A + T10B)
-- One row per SA2 per census year — same PK pattern as tsp_tenure.
-- Source: ABS 2021 Census TSP Table 10 (Uses of Language, UOL).
-- chinese_total = cantonese + mandarin + chinese_other (ABS pre-aggregated).
-- total_persons  = sum of all individual language columns (excl. chinese_total).
-- ----------------------------------------------------------------------------
CREATE TABLE tsp_language (
    sa2_code          TEXT     NOT NULL REFERENCES geo_sa2(sa2_code),
    census_year       SMALLINT NOT NULL,   -- 2011 | 2016 | 2021

    total_persons     INTEGER,             -- response denominator (sum of all below)

    -- English
    english_only      INTEGER,

    -- Non-English languages (alphabetical)
    arabic            INTEGER,
    aus_indigenous    INTEGER,
    bengali           INTEGER,
    cantonese         INTEGER,
    mandarin          INTEGER,
    chinese_other     INTEGER,
    chinese_total     INTEGER,             -- ABS pre-aggregated: cantonese + mandarin + chinese_other
    croatian          INTEGER,
    filipino          INTEGER,
    french            INTEGER,
    german            INTEGER,
    greek             INTEGER,
    gujarati          INTEGER,
    hindi             INTEGER,
    indonesian        INTEGER,
    italian           INTEGER,
    japanese          INTEGER,
    korean            INTEGER,
    macedonian        INTEGER,
    malayalam         INTEGER,
    nepali            INTEGER,
    persian_dari      INTEGER,
    portuguese        INTEGER,
    punjabi           INTEGER,
    russian           INTEGER,
    serbian           INTEGER,
    sinhalese         INTEGER,
    spanish           INTEGER,
    tagalog           INTEGER,
    tamil             INTEGER,
    thai              INTEGER,
    turkish           INTEGER,
    urdu              INTEGER,
    vietnamese        INTEGER,
    other_language    INTEGER,

    PRIMARY KEY (sa2_code, census_year)
);

COMMENT ON TABLE  tsp_language              IS 'TSP 家庭用语统计事实表，每行为一个 SA2 在某普查年的语言分布人数';
COMMENT ON COLUMN tsp_language.sa2_code     IS 'SA2 区域编码，外键关联 geo_sa2';
COMMENT ON COLUMN tsp_language.census_year  IS '人口普查年份，取值 2011、2016 或 2021';
COMMENT ON COLUMN tsp_language.total_persons IS '语言申报总人数，等于以下所有语言列之和（不含 chinese_total，避免重复计算）';
COMMENT ON COLUMN tsp_language.chinese_total IS 'ABS 预合计：粤语 + 普通话 + 其他中文方言，便于快速查询，不计入 total_persons';

-- ----------------------------------------------------------------------------
-- View: Language Profile per suburb per census year
-- Returns one row per (sal_code, census_year) with raw counts + percentages.
-- The API groups the 3 rows into a year-keyed object.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_language_profile AS
SELECT
    s.sal_code,
    s.sal_name,
    s.state_name,
    s.gccsa_name,
    sa2.sa2_code,
    sa2.sa2_name,
    l.census_year,
    l.total_persons,

    -- raw counts
    l.english_only,
    l.arabic,
    l.aus_indigenous,
    l.bengali,
    l.cantonese,
    l.mandarin,
    l.chinese_other,
    l.chinese_total,
    l.croatian,
    l.filipino,
    l.french,
    l.german,
    l.greek,
    l.gujarati,
    l.hindi,
    l.indonesian,
    l.italian,
    l.japanese,
    l.korean,
    l.macedonian,
    l.malayalam,
    l.nepali,
    l.persian_dari,
    l.portuguese,
    l.punjabi,
    l.russian,
    l.serbian,
    l.sinhalese,
    l.spanish,
    l.tagalog,
    l.tamil,
    l.thai,
    l.turkish,
    l.urdu,
    l.vietnamese,
    l.other_language,

    -- percentages (1 decimal place, NULL-safe)
    ROUND(100.0 * l.english_only   / NULLIF(l.total_persons, 0), 1) AS english_only_pct,
    ROUND(100.0 * l.arabic         / NULLIF(l.total_persons, 0), 1) AS arabic_pct,
    ROUND(100.0 * l.aus_indigenous / NULLIF(l.total_persons, 0), 1) AS aus_indigenous_pct,
    ROUND(100.0 * l.bengali        / NULLIF(l.total_persons, 0), 1) AS bengali_pct,
    ROUND(100.0 * l.cantonese      / NULLIF(l.total_persons, 0), 1) AS cantonese_pct,
    ROUND(100.0 * l.mandarin       / NULLIF(l.total_persons, 0), 1) AS mandarin_pct,
    ROUND(100.0 * l.chinese_other  / NULLIF(l.total_persons, 0), 1) AS chinese_other_pct,
    ROUND(100.0 * l.chinese_total  / NULLIF(l.total_persons, 0), 1) AS chinese_total_pct,
    ROUND(100.0 * l.croatian       / NULLIF(l.total_persons, 0), 1) AS croatian_pct,
    ROUND(100.0 * l.filipino       / NULLIF(l.total_persons, 0), 1) AS filipino_pct,
    ROUND(100.0 * l.french         / NULLIF(l.total_persons, 0), 1) AS french_pct,
    ROUND(100.0 * l.german         / NULLIF(l.total_persons, 0), 1) AS german_pct,
    ROUND(100.0 * l.greek          / NULLIF(l.total_persons, 0), 1) AS greek_pct,
    ROUND(100.0 * l.gujarati       / NULLIF(l.total_persons, 0), 1) AS gujarati_pct,
    ROUND(100.0 * l.hindi          / NULLIF(l.total_persons, 0), 1) AS hindi_pct,
    ROUND(100.0 * l.indonesian     / NULLIF(l.total_persons, 0), 1) AS indonesian_pct,
    ROUND(100.0 * l.italian        / NULLIF(l.total_persons, 0), 1) AS italian_pct,
    ROUND(100.0 * l.japanese       / NULLIF(l.total_persons, 0), 1) AS japanese_pct,
    ROUND(100.0 * l.korean         / NULLIF(l.total_persons, 0), 1) AS korean_pct,
    ROUND(100.0 * l.macedonian     / NULLIF(l.total_persons, 0), 1) AS macedonian_pct,
    ROUND(100.0 * l.malayalam      / NULLIF(l.total_persons, 0), 1) AS malayalam_pct,
    ROUND(100.0 * l.nepali         / NULLIF(l.total_persons, 0), 1) AS nepali_pct,
    ROUND(100.0 * l.persian_dari   / NULLIF(l.total_persons, 0), 1) AS persian_dari_pct,
    ROUND(100.0 * l.portuguese     / NULLIF(l.total_persons, 0), 1) AS portuguese_pct,
    ROUND(100.0 * l.punjabi        / NULLIF(l.total_persons, 0), 1) AS punjabi_pct,
    ROUND(100.0 * l.russian        / NULLIF(l.total_persons, 0), 1) AS russian_pct,
    ROUND(100.0 * l.serbian        / NULLIF(l.total_persons, 0), 1) AS serbian_pct,
    ROUND(100.0 * l.sinhalese      / NULLIF(l.total_persons, 0), 1) AS sinhalese_pct,
    ROUND(100.0 * l.spanish        / NULLIF(l.total_persons, 0), 1) AS spanish_pct,
    ROUND(100.0 * l.tagalog        / NULLIF(l.total_persons, 0), 1) AS tagalog_pct,
    ROUND(100.0 * l.tamil          / NULLIF(l.total_persons, 0), 1) AS tamil_pct,
    ROUND(100.0 * l.thai           / NULLIF(l.total_persons, 0), 1) AS thai_pct,
    ROUND(100.0 * l.turkish        / NULLIF(l.total_persons, 0), 1) AS turkish_pct,
    ROUND(100.0 * l.urdu           / NULLIF(l.total_persons, 0), 1) AS urdu_pct,
    ROUND(100.0 * l.vietnamese     / NULLIF(l.total_persons, 0), 1) AS vietnamese_pct,
    ROUND(100.0 * l.other_language / NULLIF(l.total_persons, 0), 1) AS other_language_pct

FROM geo_sal s
JOIN geo_sal_to_sa2 m  ON m.sal_code  = s.sal_code  AND m.is_primary
JOIN geo_sa2 sa2       ON sa2.sa2_code = m.sa2_code
LEFT JOIN tsp_language l ON l.sa2_code = sa2.sa2_code
WHERE s.gccsa_code IN ('1GSYD', '2GMEL');

COMMENT ON VIEW v_language_profile IS
    '家庭用语视图：tsp_language 原始人数 + 百分比，每郊区每普查年一行，JOIN SAL/SA2 地理信息供 API 查询';
