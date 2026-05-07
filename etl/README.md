# SuburbLens ETL — 执行指南

Phase 1 只做 Tenure 数据。脚本从 ABS TSP DataPack CSV 读取数据，写入 Supabase。

---

## 前置条件

| 条件 | 说明 |
|------|------|
| Python 3.11+ | `python --version` 确认 |
| Supabase 项目已创建 | region 选 ap-southeast-2 |
| `db/schema.sql` 已执行 | 在 Supabase SQL Editor 运行一次 |
| NSW TSP 数据已解压 | 见下方数据目录结构 |

### 数据目录结构

ETL 脚本期望以下路径存在（相对于项目根目录）：

```
data/extracted/
├── 2021_TSP_SA2_for_NSW_short-header/
│   └── 2021 Census TSP Statistical Area 2 for NSW/
│       ├── 2021Census_T18A_NSW_SA2.csv
│       └── 2021Census_T18B_NSW_SA2.csv
└── 2021_TSP_SA2_for_VIC_short-header/
    └── 2021 Census TSP Statistical Area 2 for VIC/
        ├── 2021Census_T18A_VIC_SA2.csv
        └── 2021Census_T18B_VIC_SA2.csv
```

如果 zip 还没解压：

```bash
cd data/extracted
unzip 2021_TSP_SA2_for_NSW_short-header.zip
unzip 2021_TSP_SA2_for_VIC_short-header.zip
```

---

## 步骤一：安装依赖

```bash
cd suburblens/etl

python -m venv .venv

# Windows
.venv\Scripts\activate

# Mac / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

---

## 步骤二：配置数据库连接

```bash
copy .env.example .env      # Windows
# cp .env.example .env      # Mac / Linux
```

编辑 `.env`，填入 Supabase 连接串：

```
SUPABASE_DB_URL=postgres://postgres.[project-ref]:[password]@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres
```

> **连接串从哪里找：**
> Supabase Dashboard → Settings → Database → Connection String
> 选 **Transaction pooler**（不要用 Direct connection，Lambda 并发下会耗尽连接数）

---

## 步骤三：执行 ETL

**推荐顺序（完整运行）：**

```bash
python etl.py --step all
```

等价于依次执行 `geo → tsp → verify`，约需 30–60 秒。

**分步执行：**

```bash
# Step 1: 加载地理数据（SAL/SA2 shapefile 空间匹配，约 20 秒）
python etl.py --step geo

# Step 2: 加载 Tenure 跨年数据
python etl.py --step tsp

# Step 3: 验证
python etl.py --step verify
```

`geo` 步骤预期输出：

```
Reading SA2 shapefile ...
  1164 NSW+VIC SA2s loaded
Upserting 1164 geo_sa2 rows ...
Reading SAL shapefile and computing SAL→SA2 overlap ...
  ~1500 SALs in Sydney/Melbourne | xx skipped
Upserting ~1500 geo_sal rows ...
Upserting ~2000 geo_sal_to_sa2 rows ...
geo step complete.
```

`tsp` 步骤预期输出：

```
Reading 2021Census_T18A_NSW_SA2.csv ...
Reading 2021Census_T18B_NSW_SA2.csv ...
Reading 2021Census_T18A_VIC_SA2.csv ...
Reading 2021Census_T18B_VIC_SA2.csv ...
  Merged: ~1300 SA2 rows (NSW=644, VIC=~660)
Ensuring ~1300 geo_sa2 rows exist ...
Upserting ~3900 tsp_tenure rows (~1300 SA2s × 3 years) ...
tsp step complete.
```

---

## 步骤四：验证数据

```bash
python etl.py --step verify
```

预期输出（数字仅供参考）：

```
── tsp_tenure ───────────────────────────────────────
  Year   SA2 rows     Total dwellings
  2011   644              1,234,567
  2016   644              1,298,765
  2021   644              1,345,678

── geo tables ───────────────────────────────────────
  geo_sa2:          1164 rows
  geo_sal:          ~1500 rows
  geo_sal_to_sa2:   ~2000 rows

── Spot-check: Glebe–Forest Lodge (SA2 117031331) ───
  Year   Outright   Mortgage    Rented   Total
  2011    xxx (30.x%)   xxx (34.x%)   xxx (35.x%)   xxxx
  2016    xxx (28.x%)   xxx (32.x%)   xxx (39.x%)   xxxx
  2021    xxx (24.x%)   xxx (30.x%)   xxx (45.x%)   xxxx

── v_tenure_shift: Glebe (SAL 11645) ────────────────
  sal_name=Glebe (NSW)  shift_index=-x.x  trend=strong_rental_shift
```

验证通过的标准：
- 三年各有 644 行（NSW 全部 SA2）
- Glebe 的 Rented 比例从 2011 到 2021 明显上升
- `v_tenure_shift` 能返回 Glebe 数据（说明全链路打通）

---

## 已知限制

| 项目 | 状态 | 何时解决 |
|------|------|---------|
| 几何坐标（geom/centroid）未写入 | 待补 | Phase 1 不需要，Phase 2 地图功能时补 |
| 同时含 NSW + VIC Tenure 数据 | 已完成 | — |
| SAL→SA2 映射基于面积重叠（无精确 Correspondence 文件） | 可接受 | ABS 不提供 SAL→SA2 直接对照，当前方案精度足够 |

---

## 重新运行

脚本幂等，可以重复执行：

- `geo_sa2` 用 `ON CONFLICT DO NOTHING`，stub 行不会被覆盖
- `tsp_tenure` 用 `ON CONFLICT DO UPDATE`，数据会被最新值覆盖
