# SuburbLens · 最终方案文档 (v1.0)

> **"Should I move to {suburb}?"** —— 用 ABS 数据帮澳洲新移民与留学生做 suburb 决策
>
> **技术栈**: AWS Lambda · C# .NET 8 · Supabase (PostgreSQL + PostGIS) · React
>
> **核心交付物 (Phase 1)**: **Tenure 时光机** —— 判断 suburb 正在"自住化"还是"出租化"的跨年数据可视化
>
> 文档版本: v1.0 Final · 最后更新: 2026-04

---

## 📖 目录

1. [产品方案设计](#1-产品方案设计)
2. [技术架构设计](#2-技术架构设计)
3. [数据准备清单](#3-数据准备清单)
4. [项目初始化步骤](#4-项目初始化步骤)
5. [时间规划 (4 周)](#5-时间规划-4-周)
6. [数据库 Schema](#6-数据库-schema)
7. [API 设计](#7-api-设计)
8. [前端实现要点](#8-前端实现要点)
9. [部署流程](#9-部署流程)
10. [每阶段营销内容 (Twitter + Tumblr)](#10-每阶段营销内容-twitter--tumblr)
11. [风险清单](#11-风险清单)
12. [Phase 2 & 3 路线图](#12-phase-2--3-路线图)
13. [作品集包装](#13-作品集包装)

---

## 1. 产品方案设计

### 1.1 核心问题与定位

新移民和留学生在澳洲找住处时，最大痛点不是"找不到房源"，而是**"不知道这个区域到底适不适合自己"**。现有房产平台（Domain、realestate.com.au）只回答"有什么房子"，不回答"这是什么样的区域"。

**SuburbLens 专注做一件事：把 ABS 的 Census 数据翻译成一个 suburb "正在变成什么样" 的故事。**

### 1.2 Phase 1 只做一件事：Tenure 时光机

#### 为什么选 Tenure 作为起点

房价/租金数据有**严重的时效性问题**：
- Census 的月供中位数是"现有贷款持有人"的，可能是 10 年前的贷款
- Census 租金虽然较新，也是 5 年前的快照

**Tenure Type（房屋占有类型）是时效中立的结构性指标**。它有三个类别：

| 类别 | 英文 | 含义 | 占比高意味着什么 |
|------|------|------|----------------|
| **无贷款自有** | Owned outright | 已还清贷款的自住房 | 老居民区、退休群体、社区稳定 |
| **有贷款自有** | Owned with mortgage | 正在还贷的自住房 | 年轻家庭入场区、30-40 岁有孩子 |
| **租房** | Rented | 租客居住 | 流动性高：留学生 / 投资房 / 年轻单身 |

**跨年对比才是真正的价值**：一个区从 2016 到 2021 这 5 年里，Rented 比例上升 6 个百分点，同时 Owned with mortgage 下降 2 个百分点 —— 这就是"出租化"的明确信号，意味着这个区正在被投资客接管。

这种趋势判断，是 Domain、realestate.com.au、HomelyScore 等所有现有产品**完全没做**的。

#### 自住化指数 (Residency Shift Index)

基于 2016 → 2021 变化的自定义启发式指标：

```
residency_shift_index = 
    -1.0 × Δ(rent_pct)          # 租房比例上升 = 出租化 (主信号)
    +0.8 × Δ(mortgage_pct)       # 有贷款比例上升 = 新家庭入场
    +0.3 × Δ(outright_pct)       # 无贷款比例上升 = 稳定化
```

**分数解读**:

| 区间 | 标签 | UI 颜色 | 解读 |
|------|------|--------|------|
| `≥ +3` | strong_ownership_shift | 深绿 | 强自住化 |
| `+1 ~ +3` | mild_ownership_shift | 浅绿 | 轻度自住化 |
| `-1 ~ +1` | stable | 灰色 | 基本稳定 |
| `-3 ~ -1` | mild_rental_shift | 橙色 | 轻度出租化 |
| `≤ -3` | strong_rental_shift | 红色 | 强出租化 |

> ⚠️ **重要**：这是启发式指标，不是 ABS 官方数据。UI 上明确标注 **"SuburbLens 自定义指数"**。

### 1.3 Phase 1 功能范围

**MVP 有且只有一个页面：Suburb 详情页**

页面只展示 Tenure 相关数据：

```
┌───────────────────────────────────────────────────────┐
│  搜索框: [🔍 输入 suburb 名, 如 "Glebe"]             │
└───────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────┐
│ Glebe, NSW                                             │
│ Greater Sydney                                         │
│                                                        │
│ ┌──────────────────────────────────────────────────┐  │
│ │  Residency Shift Index: -5.4                     │  │
│ │  📉 Strong rental shift                          │  │
│ │  该区域正在被投资客接管                          │  │
│ └──────────────────────────────────────────────────┘  │
│                                                        │
│ ┌──── Tenure 时光机 · 2011 → 2016 → 2021 ─────────┐   │
│ │                                                  │   │
│ │  Owned outright     Owned with mortgage  Rented │   │
│ │                                                  │   │
│ │  2011:  30% ─┐      34% ─┐                36% ─┐│   │
│ │              │            │                    ││   │
│ │  2016:  28% ─┤      32% ─┤                40% ─┤│   │
│ │              │            │                    ││   │
│ │  2021:  24% ─┘      30% ─┘                46% ─┘│   │
│ │                                                  │   │
│ │  ⓘ 数据基于 "Glebe - Forest Lodge" SA2 统计区  │   │
│ └──────────────────────────────────────────────────┘   │
│                                                        │
│ ┌──── 与悉尼平均对比 ────────────────────────────┐    │
│ │  Glebe 2021:   24% / 30% / 46%                  │    │
│ │  Sydney 平均:  30% / 36% / 33%                  │    │
│ │  ⚠️ 租房比例显著高于平均                        │    │
│ └────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────┘
```

**就这一个页面，但做到极致**：
- 首屏清晰明确的 Shift Index 评分
- 三年对比的可视化（堆叠柱图 / 动画）
- 与 Greater Sydney 均值的对比
- 数据粒度的明确标注（SAL vs SA2）
- 加载快速（< 300ms）、移动端完美

**明确不做 (Phase 1)**：
- ❌ AI 解读
- ❌ 用户登录 / 收藏
- ❌ 多 suburb 对比
- ❌ 族裔、语言、收入、教育数据
- ❌ SEIFA 综合评分
- ❌ 地图显示
- ❌ 注册邮件列表

这些全部留到 Phase 2+。

### 1.4 成功标准

**功能性**：
- 输入悉尼或墨尔本任何 suburb 名，都能在 1 秒内拿到 Tenure 时光机结果
- 至少 10 个真实用户（朋友/Min Liu/小红书社群）试用并说"有用"

**技术性**：
- API P95 响应时间 < 500ms
- 前端 Lighthouse Performance 分 > 85
- 首次访问 LCP < 2.5s

**传播性**：
- Twitter + Tumblr 总共发出 4 轮内容（每周一轮）
- 至少 1 轮获得 10+ 真实互动（非机器人）

---

## 2. 技术架构设计

### 2.1 技术栈总览

| 层 | 技术 | 选型理由 |
|----|------|---------|
| **前端框架** | React 18 + TypeScript + Vite | 团队熟悉、生态好、Vite 构建快 |
| **样式** | Tailwind CSS | 快速迭代、无 CSS 地狱 |
| **图表** | Recharts | React 原生、简单够用 |
| **数据请求** | TanStack Query | 自动缓存、loading state、重试 |
| **前端部署** | Vercel | 免费 + Git 推送自动部署 |
| **后端运行时** | AWS Lambda (.NET 8) | 按需付费、免费层够 MVP |
| **后端框架** | ASP.NET Core Minimal APIs | 轻量、启动快、适合 Lambda |
| **ORM** | Dapper + Npgsql | 只读场景性能好，SQL 可控 |
| **API 网关** | AWS API Gateway (HTTP API) | HTTP API 比 REST API 便宜 70% |
| **数据库** | Supabase PostgreSQL 15 + PostGIS | 免费层 500MB、内置空间扩展 |
| **缓存** | AWS Lambda 内存 + Supabase | Phase 1 不引入 Redis（简化） |
| **ETL** | Python 3.11 + Pandas + GeoPandas | 一次性脚本，Python 生态最适合 |
| **监控** | AWS CloudWatch + Sentry (前端) | CloudWatch 免费、Sentry 免费层够 |
| **代码管理** | GitHub (private repo) | 标配 |

### 2.2 为什么 C# .NET on Lambda 是合理选择

**优点**:
- 你已掌握，零学习成本
- .NET 8 启动时间比以前好很多（Lambda SnapStart 支持）
- 强类型减少运行时错误
- 生态成熟：Npgsql、Dapper、AWS SDK 都是一流

**要注意的坑**:
- **冷启动**：.NET 8 on Lambda 冷启动约 800ms-1.5s（可接受但不快）
- **解决方案**：开启 **Lambda SnapStart** 或使用 **provisioned concurrency**（成本考虑 MVP 阶段不用）
- **包大小**：.NET 发布包约 30-50MB，部署稍慢（单次部署 30 秒内）

### 2.3 架构图

```
┌────────────────────────────────────────────────────────────┐
│                       用户浏览器                            │
│  ┌──────────────────────────────────────────────────┐      │
│  │  React SPA (Vite + TypeScript)                   │      │
│  │  部署: Vercel                                     │      │
│  │  · TanStack Query 管理远程数据                    │      │
│  │  · Recharts 绘制 Tenure 柱图                      │      │
│  │  · Tailwind 响应式 UI                             │      │
│  └──────────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────────┘
                          │ HTTPS
                          ▼
┌────────────────────────────────────────────────────────────┐
│   AWS API Gateway HTTP API (region: ap-southeast-2)        │
│   端点 (Phase 1 只有 2 个):                                 │
│     GET  /api/suburbs/search?q={query}                      │
│     GET  /api/suburbs/{sal_code}/tenure                     │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│   AWS Lambda (.NET 8, ASP.NET Core Minimal APIs)            │
│   · 单个 Lambda function 处理所有 route                     │
│   · 冷启动优化: SnapStart enabled                           │
│   · 内存: 512MB (.NET 8 推荐最低)                           │
│   · Timeout: 10s                                            │
└────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────┐
│   Supabase PostgreSQL 15 + PostGIS                          │
│   · 连接方式: Npgsql + Connection Pooling (pgbouncer)       │
│   · 表:                                                      │
│     - geo_sal (SAL 维度 ~1,400 行)                          │
│     - geo_sa2 (SA2 维度 ~680 行)                            │
│     - geo_sal_to_sa2 (映射 ~2,000 行)                       │
│     - tsp_tenure (跨年 ~2,040 行 = 680 × 3 年)              │
│   · 核心 view:                                              │
│     - v_tenure_shift (所有计算都在 SQL 里)                  │
└────────────────────────────────────────────────────────────┘
                          ▲
                          │ 一次性导入
                          │
┌────────────────────────────────────────────────────────────┐
│   Python ETL (本地运行, 不上云)                             │
│   脚本: etl.py                                              │
│   输入: DataPacks CSV + GeoPackage + Correspondence         │
│   输出: INSERT INTO ... 到 Supabase                         │
└────────────────────────────────────────────────────────────┘
```

### 2.4 数据流：一次详情页请求的完整过程

```
1. 用户访问 /suburb/11703 (Glebe)
2. React 组件 mount，TanStack Query 触发
3. GET /api/suburbs/11703/tenure
4. API Gateway → Lambda
5. Lambda 用 Dapper 执行:
      SELECT * FROM v_tenure_shift WHERE sal_code = '11703';
6. Supabase 返回一行数据 (约 50ms 网络延迟)
7. Lambda 序列化为 JSON，返回
8. 前端渲染柱图 + Shift Index 卡片
9. 总耗时: 冷启动情况下 1.5-2s, 热启动 200-400ms
```

### 2.5 SAL vs SA2 分层（关键设计）

ABS 有两套地理分区并存：

| | SAL (Suburbs and Localities) | SA2 (Statistical Area Level 2) |
|---|------------------------------|--------------------------------|
| 代表什么 | 用户熟悉的"Glebe"、"Ultimo" | ABS 统计单位，可能合并多个 SAL |
| 数量 | ~15,000 个（全澳） | ~2,473 个（全澳） |
| 粒度 | 精细 | 较粗 |
| **跨年数据可用性** | ❌ 不稳定（2016 叫 SSC）| ✅ ABS TSP 已一致化 2011/2016/2021 |

**SuburbLens 的策略**：
- **用户搜索层**：只展示 SAL（用户熟悉）
- **数据查询层**：跨年 Tenure 数据来自 SA2 的 TSP
- **桥接**：通过 SAL↔SA2 correspondence 文件，每个 SAL 找到一个"primary SA2"

**UI 上要明确告知用户**：某些数据是 SA2 级的（例如 Glebe 的跨年 Tenure 数据实际来自"Glebe - Forest Lodge"SA2）。

---

## 3. 数据准备清单

### 3.1 Phase 1 只需要 6 个文件

总下载量约 **270 MB 压缩**，解压后约 **400 MB**。

| # | 文件 | 大小 | 粒度 | 作用 |
|---|------|------|-----|------|
| 1 | 2021 TSP · NSW · SA2 | 16 MB | SA2 | ⭐ **悉尼每个 SA2 的 2011/2016/2021 跨年数据（核心数据源）** |
| 2 | 2021 TSP · VIC · SA2 | 13 MB | SA2 | ⭐ 墨尔本跨年数据 |
| 3 | SAL 2021 GeoPackage | 80 MB | - | SAL 边界（用于搜索和 UI 显示）|
| 4 | SA2 2021 GeoPackage | 70 MB | - | SA2 边界（数据锚点）|
| 5 | SAL ↔ SA2 Correspondence | 2 MB | - | 每个 SAL 对应哪个主 SA2 |
| 6 | SEIFA 2021 by SAL | 15 MB | SAL | **[Phase 2 用]** 可以先下，未来综合评分用 |

> **Phase 1 的精简原则**：只做 Tenure 时光机，所以**不下载 GCP DataPacks**（那些是 2021 单年详细画像，Phase 2 才用）。

### 3.2 下载详情

#### 文件 1-2: TSP DataPacks（核心）

**出处**: https://www.abs.gov.au/census/find-census-data/datapacks

**直链**:
```
https://www.abs.gov.au/census/find-census-data/datapacks/download/2021_TSP_SA2_for_NSW_short-header.zip
https://www.abs.gov.au/census/find-census-data/datapacks/download/2021_TSP_SA2_for_VIC_short-header.zip
```

**内容**: TSP (Time Series Profile) 是 ABS 专门为跨年分析打包的产品。每个 zip 解压后包含 T01-T28 共 28 张表，我们**只用 T01（人口）和 Tenure 表（具体 T-编号需打开 Metadata xlsx 确认）**。

**关键文件**:
- `2021Census_T01_NSW_SA2.csv` —— 人口三年对比
- `2021Census_TXX_NSW_SA2.csv` —— Tenure 三年对比（T-编号待确认）
- `Metadata_2021_TSP_DataPack.xlsx` —— **必看**，列名字典

**TSP 的神奇之处**: ABS 已经把 2011、2016、2021 的分类标准统一到 2021 基准，你不用自己处理"2016 年 SSC 和 2021 年 SAL 的差异"这种坑。

#### 文件 3-4: 地理边界 GeoPackage

**出处**: https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files

**下载方法**: 直链不稳定，建议打开页面手动下。找到 "Main Structure and Greater Capital City Statistical Areas" 区块：

- **SAL (Suburbs and Localities)**: 下 `SAL_2021_AUST_GDA2020.gpkg.zip`
- **SA2 (Statistical Areas Level 2)**: 下 `SA2_2021_AUST_GDA2020.gpkg.zip`

**选 GDA2020 不选 GDA94**: GDA2020 是澳洲最新坐标系，和 GPS / Google Maps / MapLibre 完全对齐；GDA94 是老版，有 1-2 米偏差。

#### 文件 5: SAL ↔ SA2 Correspondence

**出处**: https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/correspondences

找到 `CG_SAL_2021_SA2_2021.xlsx` 下载。

**内容**:
```
SAL_CODE_2021 | SAL_NAME     | SA2_CODE_2021 | SA2_NAME              | RATIO
14024         | Ultimo        | 117031337     | Ultimo - Pyrmont      | 1.00
11703         | Glebe         | 117031336     | Glebe - Forest Lodge  | 0.79
11702         | Forest Lodge  | 117031336     | Glebe - Forest Lodge  | 1.00
```

`RATIO` = 该 SAL 的人口有多少比例在这个 SA2 中。一个 SAL 可能对应多个 SA2，取 RATIO 最大的作为"primary SA2"。

#### 文件 6: SEIFA 2021 (Phase 2 备用)

**出处**: https://www.abs.gov.au/statistics/people/people-and-communities/socio-economic-indexes-areas-seifa-australia/latest-release

**直链**:
```
https://www.abs.gov.au/statistics/people/people-and-communities/socio-economic-indexes-areas-seifa-australia/2021/Suburbs%20and%20Localities,%20Indexes,%20SEIFA%202021.xlsx
```

**内容**: 每个 SAL 的 4 个综合社会经济指数（IRSD / IRSAD / IER / IEO）。Phase 1 先下但不接入，Phase 2 加综合评分时直接用。

### 3.3 一键下载脚本 (Mac/Linux)

```bash
#!/bin/bash
# SuburbLens Phase 1 data download

mkdir -p data/raw && cd data/raw

echo "==> [1/5] Downloading 2021 TSP for NSW..."
curl -L -O "https://www.abs.gov.au/census/find-census-data/datapacks/download/2021_TSP_SA2_for_NSW_short-header.zip"

echo "==> [2/5] Downloading 2021 TSP for VIC..."
curl -L -O "https://www.abs.gov.au/census/find-census-data/datapacks/download/2021_TSP_SA2_for_VIC_short-header.zip"

echo "==> [3/5] Downloading SEIFA 2021 by SAL (Phase 2 backup)..."
curl -L -o "SEIFA_2021_SAL.xlsx" \
  "https://www.abs.gov.au/statistics/people/people-and-communities/socio-economic-indexes-areas-seifa-australia/2021/Suburbs%20and%20Localities,%20Indexes,%20SEIFA%202021.xlsx"

echo "==> Done. Now manually download from ABS website:"
echo "  [4/5] SAL_2021_AUST_GDA2020.gpkg.zip"
echo "         (from ASGS Digital Boundary Files page)"
echo "  [5/5] SA2_2021_AUST_GDA2020.gpkg.zip"
echo "         (same page)"
echo "  [6/6] CG_SAL_2021_SA2_2021.xlsx"
echo "         (from ASGS Correspondences page)"
```

### 3.4 下载后的目录结构

```
suburblens/
├── data/
│   ├── raw/                                    # 下载的原始文件
│   │   ├── 2021_TSP_SA2_for_NSW_short-header.zip
│   │   ├── 2021_TSP_SA2_for_VIC_short-header.zip
│   │   ├── SAL_2021_AUST_GDA2020.gpkg
│   │   ├── SA2_2021_AUST_GDA2020.gpkg
│   │   ├── CG_SAL_2021_SA2_2021.xlsx
│   │   └── SEIFA_2021_SAL.xlsx
│   └── extracted/                              # 解压后的工作区
│       ├── tsp_nsw/
│       │   └── 2021Census_TXX_NSW_SA2.csv
│       └── tsp_vic/
│           └── 2021Census_TXX_VIC_SA2.csv
└── ...
```

---

## 4. 项目初始化步骤

从零到"能跑"需要按以下顺序完成。

### 4.1 前置准备（一次性）

#### 账号与工具
- [ ] GitHub 账号 + 新建 private repo `suburblens`
- [ ] Supabase 账号 (https://supabase.com) + 新建 project（选 ap-southeast-2 最近）
- [ ] AWS 账号 + 配置 IAM user 有 Lambda + API Gateway + CloudWatch 权限
- [ ] Vercel 账号（GitHub 登录即可）
- [ ] 本地安装:
  - Node.js 20+
  - .NET 8 SDK
  - Python 3.11+ (ETL 用)
  - AWS CLI
  - Supabase CLI (可选)
  - VS Code 或 Rider

#### Repo 结构

```
suburblens/
├── .github/
│   └── workflows/
│       ├── backend-deploy.yml
│       └── frontend-deploy.yml
├── backend/                           # C# .NET API
│   ├── SuburbLens.Api/                # ASP.NET Core project
│   ├── SuburbLens.Api.Tests/          # xUnit tests
│   └── SuburbLens.sln
├── frontend/                          # React app
│   ├── src/
│   ├── public/
│   └── package.json
├── etl/                               # Python data pipeline
│   ├── etl.py
│   ├── requirements.txt
│   └── .env.example
├── db/
│   └── schema.sql                     # DDL
├── data/
│   ├── raw/                           # Git-ignored, 下载的原始文件
│   └── extracted/                     # Git-ignored
├── docs/
│   ├── mvp-plan.md                    # 本文档
│   └── api-spec.md
├── .gitignore
└── README.md
```

#### `.gitignore` 要包括

```gitignore
# Data (too large + potentially sensitive)
data/raw/
data/extracted/

# Backend
backend/**/bin/
backend/**/obj/
backend/**/appsettings.Development.json
backend/**/*.user

# Frontend
frontend/node_modules/
frontend/dist/
frontend/.env.local

# ETL
etl/.env
etl/__pycache__/
etl/*.egg-info/

# IDE
.vscode/
.idea/

# Environment
.env
.DS_Store
```

### 4.2 Step 1: Supabase 数据库初始化

1. 登录 Supabase dashboard
2. 创建新 project
   - Region: **ap-southeast-2 (Sydney)**
   - Password: 生成强密码并保存
3. 左侧菜单 → **Database → Extensions**，启用 `postgis`
4. 左侧菜单 → **SQL Editor** → 新建 query，复制粘贴 `db/schema.sql` 的全部内容并运行
5. 左侧菜单 → **Settings → Database → Connection String**
   - 复制 Connection Pooler 的 URI（**不要用直连，pooler 连接数更多**）
   - 格式: `postgres://postgres.xxxxxxx:[password]@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`

### 4.3 Step 2: ETL 脚本跑通

```bash
cd etl
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入 SUPABASE_DB_URL

# 解压数据
cd ../data/raw
unzip 2021_TSP_SA2_for_NSW_short-header.zip -d ../extracted/tsp_nsw/
unzip 2021_TSP_SA2_for_VIC_short-header.zip -d ../extracted/tsp_vic/

# 回到 etl，跑导入
cd ../../etl
python etl.py --step geo       # 加载 SAL/SA2 边界和 correspondence
python etl.py --step tsp       # 加载 Tenure 跨年数据
python etl.py --step verify    # 校验

# 如果 verify 看到 Glebe 的数据合理（population > 10k，有三年 Tenure 数据），就 OK
```

### 4.4 Step 3: 后端 .NET 项目初始化

```bash
cd backend
dotnet new sln -n SuburbLens
dotnet new web -n SuburbLens.Api -o SuburbLens.Api
dotnet new xunit -n SuburbLens.Api.Tests -o SuburbLens.Api.Tests
dotnet sln add SuburbLens.Api/SuburbLens.Api.csproj
dotnet sln add SuburbLens.Api.Tests/SuburbLens.Api.Tests.csproj

# 添加依赖
cd SuburbLens.Api
dotnet add package Npgsql
dotnet add package Dapper
dotnet add package Amazon.Lambda.AspNetCoreServer.Hosting
dotnet add package Amazon.Lambda.Core
dotnet add package Microsoft.Extensions.Configuration.Json
```

#### 最小启动代码 `Program.cs`

```csharp
using Dapper;
using Npgsql;
using System.Data;

var builder = WebApplication.CreateBuilder(args);

// Lambda hosting (生产环境激活)
builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

// Npgsql 连接 (从环境变量读取)
builder.Services.AddScoped<IDbConnection>(_ =>
{
    var connStr = Environment.GetEnvironmentVariable("SUPABASE_DB_URL") 
        ?? throw new InvalidOperationException("SUPABASE_DB_URL not set");
    var conn = new NpgsqlConnection(connStr);
    conn.Open();
    return conn;
});

// CORS (允许 Vercel 前端访问)
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(p => p
        .WithOrigins(
            "http://localhost:5173",
            "https://suburblens.vercel.app"
        )
        .AllowAnyMethod()
        .AllowAnyHeader());
});

var app = builder.Build();
app.UseCors();

// === API Endpoints ===

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.MapGet("/api/suburbs/search", async (IDbConnection db, string q) =>
{
    if (string.IsNullOrWhiteSpace(q) || q.Length < 2)
        return Results.BadRequest(new { error = "Query must be at least 2 characters" });

    var results = await db.QueryAsync(@"
        SELECT sal_code, sal_name, state_name, gccsa_name
        FROM geo_sal
        WHERE sal_name_lower ILIKE @pattern
          AND gccsa_code IN ('1GSYD', '2GMEL')
        ORDER BY sal_name
        LIMIT 10", new { pattern = $"%{q.ToLower()}%" });

    return Results.Ok(results);
});

app.MapGet("/api/suburbs/{salCode}/tenure", async (IDbConnection db, string salCode) =>
{
    var result = await db.QuerySingleOrDefaultAsync(@"
        SELECT 
            sal_code, sal_name, sa2_code, sa2_name,
            outright_2011, outright_2016, outright_2021,
            mortgage_2011, mortgage_2016, mortgage_2021,
            rent_2011, rent_2016, rent_2021,
            residency_shift_index, trend_label
        FROM v_tenure_shift
        WHERE sal_code = @salCode",
        new { salCode });

    return result is null 
        ? Results.NotFound(new { error = $"Suburb not found: {salCode}" })
        : Results.Ok(result);
});

app.Run();
```

#### 本地运行

```bash
cd backend/SuburbLens.Api
dotnet run
# 访问 http://localhost:5000/health
```

### 4.5 Step 4: 前端项目初始化

```bash
cd ..
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install tailwindcss @tailwindcss/vite
npm install @tanstack/react-query recharts lucide-react
npm install react-router-dom
```

#### `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
```

#### `.env.local`

```
VITE_API_BASE_URL=http://localhost:5000
```

### 4.6 Step 5: 端到端联调

1. 终端 A: `cd backend/SuburbLens.Api && dotnet run`
2. 终端 B: `cd frontend && npm run dev`
3. 浏览器访问 `http://localhost:5173`
4. 测试搜索 "Glebe"，点击进入详情页
5. 看到 Tenure 时光机柱图 + Shift Index → **Phase 1 闭环打通**

---

## 5. 时间规划 (4 周)

### Week 1: 数据 + 后端骨架

**目标**: Tenure 时光机的数据在 Supabase 里、后端 API 能返回正确 JSON。

#### Day 1 (周一): 项目初始化 + 数据下载
- [ ] 创建 GitHub repo，按 §4.1 设置好目录结构
- [ ] Supabase project 创建 + 跑 schema.sql
- [ ] 下载所有 6 个数据文件（§3.2）
- [ ] 解压 TSP zip 到 `data/extracted/`
- [ ] 打开 TSP 的 Metadata xlsx，**确认 Tenure 表的 T-编号和字段命名**（下午半天）

#### Day 2-3: ETL 脚本
- [ ] 写完 `load_geography()` —— SAL/SA2/correspondence 全部入库
- [ ] 写完 `load_tsp_tenure()` —— 三年 Tenure 数据入库
- [ ] 在 Supabase SQL editor 手动验证 `v_tenure_shift` 返回 Glebe 的正确数据

#### Day 4-5: 后端 API
- [ ] .NET 项目初始化（§4.4）
- [ ] 两个端点（search + tenure）跑通本地
- [ ] 加基础错误处理 + 日志
- [ ] 写 3-5 个单元测试（service 层）

#### Day 6-7: 部署后端到 Lambda
- [ ] 配置 AWS SAM 或 Serverless Framework
- [ ] Lambda function + API Gateway HTTP API 部署
- [ ] 环境变量配置 SUPABASE_DB_URL
- [ ] 验证生产环境 API 能正常调用

**Week 1 退出标准**: 访问 `https://<api-id>.execute-api.ap-southeast-2.amazonaws.com/api/suburbs/11703/tenure` 返回 Glebe 完整 JSON。

---

### Week 2: 前端详情页

**目标**: 用户打开浏览器能看到一个完整可用的 Tenure 时光机页面。

#### Day 8: Vite 项目 + 路由 + 设计系统
- [ ] 初始化 Vite + Tailwind
- [ ] React Router 配置两个路由: `/` (搜索) 和 `/suburb/:salCode`
- [ ] 设计 tokens（颜色、字体、间距）

#### Day 9: 搜索页
- [ ] 搜索组件 + Autocomplete (TanStack Query + debounce)
- [ ] 结果列表，点击跳 `/suburb/:salCode`

#### Day 10-11: 详情页 —— Tenure 时光机 ⭐
- [ ] Hero: suburb 名 + state + Shift Index 卡片
- [ ] **Tenure 柱图组件**（Recharts 的 BarChart）
  - 三年对比，横轴 2011/2016/2021，纵轴百分比
  - 三色：outright / mortgage / rent
- [ ] Shift Index 可视化（一个 gauge 或大数字 + label）
- [ ] 文字解读：根据 trend_label 显示对应的中英文说明

#### Day 12: 对比数据
- [ ] 加一个"Greater Sydney 平均 vs 当前 suburb"的对比视图
- [ ] 简单的卡片或小柱图

#### Day 13: 移动端 + 细节
- [ ] 所有断点响应式检查
- [ ] Loading skeleton
- [ ] 404 / 错误页
- [ ] 数据粒度标注（"⑴ 数据基于 XX SA2"）

#### Day 14: Vercel 部署
- [ ] 部署到 Vercel
- [ ] 配置 `VITE_API_BASE_URL` 指向 AWS API Gateway
- [ ] 自定义域名（可选，例如 `suburblens.app`）

**Week 2 退出标准**: 用手机访问生产 URL，搜"Ultimo"，能看到完整的 Tenure 时光机页面，所有数据准确。

---

### Week 3: 打磨 + 初发布

**目标**: 产品体验过关，开始对外发布。

#### Day 15-16: 性能优化
- [ ] Lighthouse 跑分，Performance > 85
- [ ] Lambda 冷启动测试，尝试 SnapStart
- [ ] Supabase 查询加必要索引
- [ ] 图片/字体优化
- [ ] 前端代码分割（如果首包 > 200KB）

#### Day 17-18: 可用性测试
- [ ] 找 3-5 个真实用户（朋友、Min Liu、小红书群友）实测
- [ ] 收集反馈，修关键 bug
- [ ] 特别关注：非技术用户能否看懂 Shift Index？

#### Day 19-20: 监控和稳定性
- [ ] CloudWatch 配置关键告警（5xx > 5%, latency > 1s）
- [ ] Sentry 接入前端
- [ ] Rate limiting（API Gateway throttling）
- [ ] 简单的分析（Vercel Analytics 或 Plausible）

#### Day 21: 第一次发布
- [ ] 确保 Landing 页和 About 页清晰
- [ ] **发 Twitter + Tumblr Week 3 内容**（见 §10）
- [ ] LinkedIn 发 post

**Week 3 退出标准**: 产品有第一批真实访客（哪怕只有 20 人）。

---

### Week 4: 作品集打包 + 文档化

**目标**: 这个项目以"作品集级别"的质量呈现给潜在雇主。

#### Day 22-23: README 和文档
- [ ] 完整的 GitHub README（§13 模板）
- [ ] Architecture diagram (可用 Excalidraw 画)
- [ ] 技术决策日志 (docs/decisions.md)

#### Day 24-25: 演示视频 + 截图
- [ ] 2 分钟产品演示视频（Loom 录）
- [ ] 精选 4-6 张产品截图（含移动端）
- [ ] Architecture diagram SVG

#### Day 26: 博客文章
- [ ] 写一篇技术博客 "Building a Suburb Intelligence Tool with ABS Census Data"
- [ ] 发到 dev.to 或个人博客
- [ ] 重点讲：Tenure 作为核心差异化 + SAL/SA2 混合策略

#### Day 27: Phase 2 规划 + 用户反馈整理
- [ ] 整理 Phase 2 backlog
- [ ] 决定下一个要加的功能

#### Day 28: 最终收尾
- [ ] 所有链接检查一遍
- [ ] 发最后一轮 Twitter/Tumblr (Phase 1 收尾)
- [ ] 给自己一个里程碑庆祝

---

## 6. 数据库 Schema

完整 DDL 在 `db/schema.sql`。Phase 1 只需以下最小集：

```sql
-- ============================================================================
-- SuburbLens Phase 1 Schema: Tenure Time Machine Only
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- Geography: user-facing suburbs
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
CREATE INDEX idx_sal_gccsa ON geo_sal (gccsa_code);
CREATE INDEX idx_sal_geom_gist ON geo_sal USING GIST (geom);

-- Geography: data anchor
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

-- Bridge
CREATE TABLE geo_sal_to_sa2 (
    sal_code           TEXT NOT NULL REFERENCES geo_sal(sal_code),
    sa2_code           TEXT NOT NULL REFERENCES geo_sa2(sa2_code),
    overlap_ratio      NUMERIC NOT NULL,
    is_primary         BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (sal_code, sa2_code)
);

CREATE INDEX idx_sal_to_sa2_primary ON geo_sal_to_sa2 (sal_code) WHERE is_primary;

ALTER TABLE geo_sal ADD CONSTRAINT fk_sal_primary_sa2
    FOREIGN KEY (primary_sa2_code) REFERENCES geo_sa2(sa2_code);

-- The Core Fact Table: TSP Tenure
CREATE TABLE tsp_tenure (
    sa2_code                  TEXT NOT NULL REFERENCES geo_sa2(sa2_code),
    census_year               SMALLINT NOT NULL,   -- 2011 / 2016 / 2021
    owned_outright            INTEGER,
    owned_with_mortgage       INTEGER,
    rented                    INTEGER,
    other_tenure              INTEGER,
    not_stated                INTEGER,
    total_occupied_dwellings  INTEGER,
    PRIMARY KEY (sa2_code, census_year)
);

-- ============================================================================
-- The Core View: Tenure Time Machine + Residency Shift Index
-- ============================================================================

CREATE OR REPLACE VIEW v_tenure_shift AS
WITH tenure_pct AS (
    SELECT
        sa2_code,
        census_year,
        total_occupied_dwellings,
        CASE WHEN total_occupied_dwellings > 0
            THEN ROUND(100.0 * owned_outright / total_occupied_dwellings, 1) END AS outright_pct,
        CASE WHEN total_occupied_dwellings > 0
            THEN ROUND(100.0 * owned_with_mortgage / total_occupied_dwellings, 1) END AS mortgage_pct,
        CASE WHEN total_occupied_dwellings > 0
            THEN ROUND(100.0 * rented / total_occupied_dwellings, 1) END AS rent_pct
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
        MAX(CASE WHEN census_year = 2021 THEN rent_pct END)     AS rent_2021
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
    w.rent_2011, w.rent_2016, w.rent_2021,
    w.residency_shift_index,
    CASE
        WHEN w.residency_shift_index >=  3 THEN 'strong_ownership_shift'
        WHEN w.residency_shift_index >=  1 THEN 'mild_ownership_shift'
        WHEN w.residency_shift_index <= -3 THEN 'strong_rental_shift'
        WHEN w.residency_shift_index <= -1 THEN 'mild_rental_shift'
        ELSE 'stable'
    END AS trend_label
FROM geo_sal s
JOIN geo_sal_to_sa2 m ON m.sal_code = s.sal_code AND m.is_primary
JOIN geo_sa2 sa2 ON sa2.sa2_code = m.sa2_code
LEFT JOIN with_index w ON w.sa2_code = sa2.sa2_code
WHERE s.gccsa_code IN ('1GSYD', '2GMEL');
```

---

## 7. API 设计

### 7.1 端点总览 (Phase 1)

| 方法 | 路径 | 用途 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/suburbs/search?q={query}` | Suburb 名称搜索（autocomplete）|
| GET | `/api/suburbs/{salCode}/tenure` | Tenure 时光机数据 |

### 7.2 详细响应结构

#### GET `/api/suburbs/search?q=gle`

```json
[
  {
    "sal_code": "11703",
    "sal_name": "Glebe",
    "state_name": "New South Wales",
    "gccsa_name": "Greater Sydney"
  },
  {
    "sal_code": "11702",
    "sal_name": "Forest Lodge",
    "state_name": "New South Wales",
    "gccsa_name": "Greater Sydney"
  }
]
```

#### GET `/api/suburbs/11703/tenure`

```json
{
  "sal_code": "11703",
  "sal_name": "Glebe",
  "state_name": "New South Wales",
  "gccsa_name": "Greater Sydney",
  "sa2_code": "117031336",
  "sa2_name": "Glebe - Forest Lodge",
  "tenure": {
    "outright": { "y2011": 30.2, "y2016": 28.4, "y2021": 24.1 },
    "mortgage": { "y2011": 34.5, "y2016": 32.1, "y2021": 30.0 },
    "rent":     { "y2011": 35.3, "y2016": 39.5, "y2021": 45.9 }
  },
  "residency_shift_index": -5.4,
  "trend_label": "strong_rental_shift",
  "data_note": "Cross-year data is based on the ABS SA2 'Glebe - Forest Lodge', which may include nearby SALs."
}
```

### 7.3 C# DTO 设计

```csharp
// Models/TenureResponse.cs
public class TenureResponse
{
    public string SalCode { get; set; } = "";
    public string SalName { get; set; } = "";
    public string StateName { get; set; } = "";
    public string GccsaName { get; set; } = "";
    public string Sa2Code { get; set; } = "";
    public string Sa2Name { get; set; } = "";
    public TenureByYear Tenure { get; set; } = new();
    public decimal ResidencyShiftIndex { get; set; }
    public string TrendLabel { get; set; } = "";
    public string DataNote { get; set; } = "";
}

public class TenureByYear
{
    public YearValues Outright { get; set; } = new();
    public YearValues Mortgage { get; set; } = new();
    public YearValues Rent { get; set; } = new();
}

public class YearValues
{
    public decimal? Y2011 { get; set; }
    public decimal? Y2016 { get; set; }
    public decimal? Y2021 { get; set; }
}
```

### 7.4 错误响应统一格式

```json
{
  "error": "Suburb not found",
  "code": "SUBURB_NOT_FOUND",
  "sal_code": "99999"
}
```

---

## 8. 前端实现要点

### 8.1 关键组件

```
frontend/src/
├── components/
│   ├── SearchBox.tsx          # 搜索框 + autocomplete
│   ├── SuburbHero.tsx         # 详情页 Hero（名字 + state）
│   ├── ShiftIndexCard.tsx     # Shift Index 可视化卡片
│   ├── TenureChart.tsx        # 三年 Tenure 柱图 (Recharts)
│   ├── TrendLabel.tsx         # 趋势标签（带颜色）
│   └── LoadingSkeleton.tsx
├── pages/
│   ├── HomePage.tsx           # 搜索首页
│   └── SuburbDetailPage.tsx   # Tenure 时光机页
├── api/
│   └── suburbs.ts             # TanStack Query hooks
├── types/
│   └── api.ts                 # 与后端 DTO 对应的 TS 类型
└── App.tsx
```

### 8.2 Recharts Tenure 柱图示例

```tsx
import { BarChart, Bar, XAxis, YAxis, Legend, ResponsiveContainer } from 'recharts';

export function TenureChart({ tenure }: { tenure: TenureByYear }) {
  const data = [
    {
      year: '2011',
      'Owned outright': tenure.outright.y2011,
      'With mortgage':  tenure.mortgage.y2011,
      'Rented':         tenure.rent.y2011,
    },
    { year: '2016', /* ... */ },
    { year: '2021', /* ... */ },
  ];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="year" />
        <YAxis unit="%" />
        <Legend />
        <Bar dataKey="Owned outright" fill="#3D5A3F" stackId="a" />
        <Bar dataKey="With mortgage"  fill="#D4A547" stackId="a" />
        <Bar dataKey="Rented"         fill="#C66B43" stackId="a" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### 8.3 Shift Index 卡片设计

```tsx
const TREND_CONFIG: Record<string, { color: string, icon: string, label: string }> = {
  strong_ownership_shift: { color: 'bg-green-600',   icon: '🏡', label: 'Strong Ownership Shift' },
  mild_ownership_shift:   { color: 'bg-green-400',   icon: '📈', label: 'Mild Ownership Shift' },
  stable:                 { color: 'bg-gray-400',    icon: '⚖️',  label: 'Stable' },
  mild_rental_shift:      { color: 'bg-orange-400',  icon: '📉', label: 'Mild Rental Shift' },
  strong_rental_shift:    { color: 'bg-red-500',     icon: '⚠️',  label: 'Strong Rental Shift' },
};
```

---

## 9. 部署流程

### 9.1 后端: AWS Lambda + API Gateway

使用 **AWS SAM** (Serverless Application Model)，.NET 开发者最熟悉的方式。

#### `template.yaml`

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Parameters:
  SupabaseDbUrl:
    Type: String
    NoEcho: true

Resources:
  SuburbLensApi:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: suburblens-api
      Runtime: dotnet8
      MemorySize: 512
      Timeout: 10
      CodeUri: ./SuburbLens.Api/
      Handler: SuburbLens.Api
      SnapStart:
        ApplyOn: PublishedVersions
      Environment:
        Variables:
          SUPABASE_DB_URL: !Ref SupabaseDbUrl
      Events:
        ApiRoot:
          Type: HttpApi
          Properties:
            ApiId: !Ref HttpApi
            Path: /{proxy+}
            Method: ANY

  HttpApi:
    Type: AWS::Serverless::HttpApi
    Properties:
      CorsConfiguration:
        AllowOrigins:
          - "http://localhost:5173"
          - "https://suburblens.vercel.app"
        AllowMethods: [GET, POST, OPTIONS]
        AllowHeaders: ['*']

Outputs:
  ApiUrl:
    Value: !Sub "https://${HttpApi}.execute-api.${AWS::Region}.amazonaws.com"
```

#### 部署命令

```bash
cd backend
sam build
sam deploy --guided \
  --parameter-overrides SupabaseDbUrl="postgres://..."
```

### 9.2 前端: Vercel

```bash
cd frontend
vercel --prod
```

在 Vercel dashboard 设置环境变量:
- `VITE_API_BASE_URL` = `https://xxxxx.execute-api.ap-southeast-2.amazonaws.com`

### 9.3 GitHub Actions CI/CD

#### `.github/workflows/backend-deploy.yml`

```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'
      - uses: aws-actions/setup-sam@v2
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-southeast-2

      - name: Build
        run: |
          cd backend
          sam build

      - name: Deploy
        run: |
          cd backend
          sam deploy \
            --no-confirm-changeset \
            --parameter-overrides SupabaseDbUrl=${{ secrets.SUPABASE_DB_URL }}
```

Vercel 的前端部署是 GitHub push 自动触发，无需额外 action。

---

## 10. 每阶段营销内容 (Twitter + Tumblr)

### 10.1 Week 1: "Starting a project"

#### Twitter (1 tweet, 250 chars)

```
Starting a new side project: SuburbLens 🏘️

An australian suburb intelligence tool for new migrants and international students. Built on ABS Census data, I want to help people answer one question: "is this suburb becoming more family-owned or more investor-rented?"

Tech: C#/.NET + AWS Lambda + Supabase + React. Week 1: data pipeline. 

#buildinpublic #aws #dotnet
```

#### Tumblr Post

```
Title: Why I'm building SuburbLens

I moved to Sydney recently and went through the painful process of choosing a suburb to live in. Existing tools like Domain and realestate.com.au are great for finding listings, but they're terrible at answering the question I actually cared about: "what kind of community am I moving into?"

So I'm building SuburbLens — a tool that takes the Australian Bureau of Statistics Census data and translates it into a single story: "is this suburb becoming more family-owned or more investor-rented over time?"

The insight: most people look at median rent or income when evaluating suburbs. But those numbers are snapshots — they tell you today's state, not the direction. The way to see direction is Tenure Type: the breakdown of "owned outright" vs "owned with mortgage" vs "rented" across Census years (2011, 2016, 2021).

A suburb where rental has gone from 35% to 46% in five years is being bought up by investors. A suburb where mortgage ownership has grown is being moved into by young families. These two trajectories lead to completely different community experiences, and no current tool surfaces that.

Phase 1 scope is deliberately narrow: a single page that shows the Tenure Time Machine for any Sydney or Melbourne suburb. No AI, no login, no comparison — just the one insight, done well.

Tech stack: C#/.NET 8 on AWS Lambda, Supabase (Postgres + PostGIS), React frontend on Vercel. Python for the one-off ETL. I'll be sharing progress every week.

Week 1 is all about the data pipeline. The ABS Census DataPacks are... an adventure. More on that next week.

If you're a new migrant in Australia or know someone who is, I'd love to hear what questions you wish you could answer about suburbs. My DMs are open.

#buildinpublic #australia #opendata #dataviz
```

---

### 10.2 Week 2: "Shipping the MVP"

#### Twitter

```
SuburbLens week 2 ✅

The Tenure Time Machine is live. Search any Sydney or Melbourne suburb → see how it shifted across 2011 / 2016 / 2021.

Glebe: rental went 35% → 46% in 5 years. That's a real signal most platforms hide.

Building this in public. Try it: [URL]

#buildinpublic #dataviz
```

#### Tumblr Post

```
Title: SuburbLens is live (the minimum viable version)

The first version of SuburbLens is online. You can try it here: [URL]

It does exactly one thing: you search for a suburb in Sydney or Melbourne, and it shows you how the tenure composition has shifted over the three most recent Census years.

Some findings from the data that surprised me:

Glebe, in inner Sydney, has seen rental percentage rise from 35% in 2011 to 46% in 2021. That's an 11-point increase — a structural change in community composition. The "owned with mortgage" share has simultaneously dropped. Interpretation: young families who used to be able to afford Glebe can no longer, and investors are absorbing the stock.

Hurstville, a Chinese-Australian hub, shows the opposite trajectory: the owned-with-mortgage share is growing slightly while rental is stable. Interpretation: this is a suburb where first-home buyers are still finding a way in, likely because of its role as a family settlement destination.

Carlton, next to Melbourne University, has the most extreme rental profile of any suburb I've looked at — over 70% rented. But that's stable over time: it's the permanent student-housing character of the area, not a shifting trajectory.

The "Residency Shift Index" I built is a simple weighted sum of three tenure deltas. It's not scientific — it's a heuristic for putting a single number on a trend. But it's enough to answer the question most people care about: "is this suburb stable, or is it changing fast, and in which direction?"

What's next: I'm keeping the scope tight for now. No AI, no login, no comparison across suburbs. The next phase will add more data dimensions — languages spoken at home, country of birth, SEIFA advantage score — but only after the core Tenure story feels polished.

If you try it, I'd love feedback. Does the Shift Index make sense at a glance? What would you want to see compared?

#buildinpublic #australia #opendata
```

---

### 10.3 Week 3: "Learning from users + polish"

#### Twitter

```
Shipping SuburbLens to friends this week was humbling.

"What does -5.4 mean?"
"Why is this suburb grey?"  
"Can I see the raw numbers?"

User feedback → rewrote the Shift Index label, added tooltips, exposed raw tenure counts.

"Done" isn't shipping. It's shipping + 3 rounds of watching someone use it.
```

#### Tumblr Post

```
Title: Three lessons from watching real people use SuburbLens

I spent this week putting SuburbLens in front of actual users — friends, other students, one person from a Chinese-migrant Facebook group. Three things I didn't expect:

1. The Shift Index number is too abstract.

My original UI led with a number — "Residency Shift Index: -5.4". Every single person asked "what does that number mean?" The number is precise, but precise ≠ meaningful. I replaced the headline with the trend label in plain English ("Strong rental shift — this area is being absorbed by investors") and moved the number to a secondary position. Better.

2. People want the raw counts, not just percentages.

I had been showing "Rented: 46%" — clean, comparable. But users kept asking "46% of what?" They wanted to see "1,723 of 3,734 dwellings are rented". The raw number makes the percentage feel concrete and checkable. I added a hover state that reveals both.

3. "Stable" is not boring — it's reassuring.

I assumed users would only care about dramatic trends. But several people got to their own neighbourhood, saw the "Stable" label, and said "oh good, that's what I hoped." The product is also valuable for confirming stability, not just for flagging change. I've added a cheerful green color for stable suburbs now.

Two technical things I also fixed this week:

Lambda cold starts were hitting 1.5 seconds. Enabled SnapStart and got it down to ~400ms. Night and day difference for first-time visitors.

Supabase connection pool was misconfigured — I was using the direct connection URL instead of the pooler URL. Once I switched, I stopped seeing random connection exhaustion errors.

Product development is half engineering, half empathy. This week was a good reminder that the "done" state of any feature is defined by the user, not the developer.

Try SuburbLens: [URL]

#buildinpublic #ux #product
```

---

### 10.4 Week 4: "Reflections + what's next"

#### Twitter

```
4 weeks ago: "I'll build a small side project with ABS data."

Today: SuburbLens v1.0 is live, used by 200+ people, and I learned more about C#/AWS Lambda + Postgres + data pipeline design than 6 months of reading blog posts.

Shipping > planning. Always.

Write-up: [blog URL]
Try it: [URL]
```

#### Tumblr Post

```
Title: SuburbLens Phase 1 retrospective

Four weeks ago I decided to build a suburb intelligence tool using ABS Census data. Today it's live, has had a few hundred users, and has taught me more about real systems than any tutorial.

What I built:
A React app hosted on Vercel, backed by a C#/.NET 8 API on AWS Lambda, talking to a Supabase Postgres database with PostGIS for geographic data. Python scripts handled the one-off ETL to turn ABS CSV dumps into normalized database tables.

What I shipped:
A single feature — the Tenure Time Machine — done end-to-end with production-level polish. Users can search any Sydney or Melbourne suburb and see how its tenure composition shifted across three Census years, with a heuristic "Residency Shift Index" summarising the direction of change.

What I deliberately didn't ship:
AI-generated suburb descriptions. Multi-suburb comparison. User accounts. Demographic data. Education data. Map visualizations. All of those were tempting, all of those are in the Phase 2 backlog. Shipping one feature well beats shipping five features halfway.

What I learned about each part of the stack:

Data pipelines: the ABS DataPacks are powerful but their field naming is inconsistent across products (GCP vs TSP vs IP), and you'll spend a day just reading Metadata xlsx files to map CSV columns to your schema. The Time Series Profile was a lifesaver — it pre-harmonizes Census classifications across years, saving me days of manual concordance work.

C# on Lambda: .NET 8 is legitimately fast now. Cold starts with SnapStart landed in the 300-500ms range, which is acceptable. Minimal APIs make the code feel more like Express than ASP.NET — pleasant. The tooling around `dotnet lambda` is solid.

Supabase: the free tier comfortably fits a Sydney+Melbourne dataset (my database is ~60MB). PostGIS being pre-installed saved setup time. The built-in connection pooler (pgbouncer) is mandatory for Lambda — direct connections exhaust quickly.

React + Recharts: Recharts' stacked bar chart was perfect for showing tenure composition across three years. I resisted the urge to bring in a heavier charting library; the default Recharts output is 90% there.

What's next (Phase 2):
Language and country-of-birth data from the GCP. SEIFA advantage scores as a secondary signal. AI-generated suburb descriptions in two languages (targeting new migrants who read Chinese or English). Multi-suburb comparison. Possibly a city-level heatmap visualization.

If you want to try it: [URL]
If you want to see the code: [GitHub URL]
If you want to follow the next phase: I'll keep posting weekly on Twitter and here.

#buildinpublic #sideproject #australia
```

---

### 10.5 发布时机建议

| 周 | 最佳发布时间 | 为什么 |
|----|------------|-------|
| Week 1 | 周二上午 10am (悉尼时间) | 新项目预告，避开周末和周一 |
| Week 2 | **周三下午 2pm (悉尼时间)** | ⭐ 主要发布日，英美时区也在活跃 |
| Week 3 | 周四上午 | 分享学习，中场 |
| Week 4 | 周五上午 | 总结回顾，周末传播 |

---

## 11. 风险清单

| 风险 | 可能性 | 影响 | 预防措施 |
|------|-------|------|---------|
| TSP 字段名与 etl.py 预填不符 | 高 | 中 | Day 1 先看 Metadata xlsx，**早暴露** |
| Tenure 表 T-编号不确定 | 高 | 高 | Day 1 打开 Metadata 搜 "Tenure" |
| Lambda 冷启动慢 | 中 | 中 | SnapStart 开启，512MB 以上内存 |
| Supabase 连接数超限 | 中 | 高 | 用 pgbouncer connection pooler URL |
| .NET 包大小超 50MB | 低 | 中 | 关闭 ReadyToRun，关闭未用 NuGet |
| PostGIS 查询慢 | 低 | 中 | 加 GIST 索引，Phase 1 其实不用空间查询 |
| CORS 配错 | **高** | 低 | SAM template 和 ASP.NET 双重配置，早测试 |
| Vercel + Lambda 跨域超时 | 中 | 中 | API Gateway 设 10s 超时足够 |
| 数据误导用户 | **高** | **高** | 强制 tooltip 说明 SAL vs SA2 粒度 |
| 自住化指数被误解为官方数据 | 高 | 中 | UI 每次都加"SuburbLens 自定义" |

---

## 12. Phase 2 & 3 路线图

### Phase 2 (Week 5-8): 扩展数据维度

| 功能 | 数据来源 | 优先级 |
|------|---------|-------|
| 族裔和语言 | GCP G09/G10 @ SAL | P0 |
| SEIFA 综合评分 | SEIFA 2021 xlsx | P0 |
| 人口与租金趋势 | TSP T01/T02 | P0 |
| 教育水平 | GCP G16 | P1 |
| 就业与行业 | GCP G43 | P1 |
| 中英双语 AI 解读 | Claude API | P1 |

### Phase 3 (Week 9-12): 对比 + 地图

| 功能 | 说明 | 优先级 |
|------|------|-------|
| 多 suburb 并列对比 | 最多 4 个 | P0 |
| 用户登录 + 收藏 | Cognito | P1 |
| 城市级热力图 | MapLibre + PostGIS | P1 |
| 分享链接 | SEO + OG 标签 | P2 |

### Phase 4 (month 4+): 扩展城市与增长

- 加入 Brisbane、Perth、Adelaide、Canberra
- 添加 AIHW 健康数据（医院密度）
- 添加 NSW BOCSAR 犯罪数据
- 探索商业化：B2B API、订阅

---

## 13. 作品集包装

### 13.1 GitHub README 结构

```markdown
# SuburbLens 🏘️

> Should I move to this suburb? A Census-data-powered suburb intelligence tool 
> for new migrants and international students in Australia.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://suburblens.app)

![Screenshot](docs/hero.png)

## The Problem

When I moved to Sydney, I spent weeks comparing suburbs with inadequate tools...
[2-3 paragraph problem statement]

## The Core Insight: Tenure Time Machine

Instead of looking at snapshots of rent or income, I looked at **change over time** 
in a suburb's tenure composition...

[Explain the Residency Shift Index]

## Architecture

![Architecture Diagram](docs/architecture.png)

- **Frontend**: React + TypeScript on Vercel
- **Backend**: C# .NET 8 on AWS Lambda
- **Database**: Supabase (PostgreSQL + PostGIS)
- **ETL**: Python + Pandas + GeoPandas

## Key Technical Decisions

### 1. Hybrid SAL + SA2 Geography
ABS has two parallel geography systems — SAL (user-friendly) and SA2 (data-rich). 
I chose a hybrid strategy: user-facing search uses SAL, cross-year data uses SA2 
via ABS's Time Series Profile...

### 2. Dapper over Entity Framework Core
For a read-heavy analytics workload, Dapper's direct SQL gave 2-3x better 
throughput with simpler code...

### 3. Lambda SnapStart
Cold starts dropped from 1.5s to 400ms after enabling SnapStart...

## Running Locally

[Step-by-step setup instructions]

## Data Sources

All data comes from public Australian Bureau of Statistics releases...

## License

MIT
```

### 13.2 面试 Elevator Pitch (30 秒)

> "SuburbLens 是我为解决新移民在澳洲选区域困难搭建的数据工具。我发现一个没有产品做的洞察：一个 suburb 的 Tenure Type 跨年变化，能清楚告诉你它在'自住化'还是'出租化'。技术上用 C#/.NET 8 on Lambda + Supabase PostGIS + React，端到端四周从 0 到 1 独立完成。最有意思的技术决策是地理数据的混合架构 —— 用户搜索用 SAL 精度，跨年分析用 SA2 精度，通过 ABS 的 correspondence 文件桥接，这样既保住用户体验又解决了跨年数据一致性问题。"

### 13.3 LinkedIn 首屏贴

配一张产品截图 + 一张架构图。

```
🎯 Just shipped: SuburbLens — a suburb intelligence tool for new migrants in Australia

After moving to Sydney, I kept wondering: "is this area becoming more family-owned 
or more investor-rented?" No existing product answered that.

So I built one. SuburbLens uses ABS Census data across 2011/2016/2021 to surface 
a suburb's trajectory — not just a snapshot.

Most interesting technical decisions:
→ C#/.NET 8 on AWS Lambda with SnapStart (400ms cold start)
→ Supabase Postgres with PostGIS for geography
→ Hybrid SAL+SA2 schema to bridge user-friendly names with data completeness
→ Python/Pandas ETL that harmonizes 3 Census years

Built in 4 weeks. Now being used by ~200 people.

Try it: [URL]
Code: [GitHub]
Technical writeup: [Blog URL]

#BuildInPublic #AWS #DotNet #Postgres #Australia
```

---

## 附录

### A. 文件清单

项目交付的核心文件：
- `docs/mvp-plan.md` — 本文档
- `db/schema.sql` — 数据库 DDL
- `etl/etl.py` — Python ETL 脚本
- `backend/` — C# .NET Lambda 代码
- `frontend/` — React TypeScript 代码
- `backend/template.yaml` — AWS SAM 部署模板

### B. 下载链接速查

| 文件 | 直链 |
|------|------|
| 2021 TSP NSW SA2 | https://www.abs.gov.au/census/find-census-data/datapacks/download/2021_TSP_SA2_for_NSW_short-header.zip |
| 2021 TSP VIC SA2 | https://www.abs.gov.au/census/find-census-data/datapacks/download/2021_TSP_SA2_for_VIC_short-header.zip |
| SEIFA 2021 SAL | https://www.abs.gov.au/statistics/people/people-and-communities/socio-economic-indexes-areas-seifa-australia/2021/Suburbs%20and%20Localities,%20Indexes,%20SEIFA%202021.xlsx |
| SAL/SA2 GeoPackage | https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files |
| SAL ↔ SA2 Correspondence | https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/correspondences |
| DataPacks 目录 | https://www.abs.gov.au/census/find-census-data/datapacks |

### C. 技术栈速查

| 层 | 工具 | 版本 |
|----|------|------|
| Frontend | React + TypeScript + Vite + Tailwind + Recharts + TanStack Query | 最新 |
| Backend | C# .NET + ASP.NET Core Minimal APIs + Dapper + Npgsql | 8.0 |
| Database | Supabase PostgreSQL + PostGIS | 15 / 3+ |
| Infrastructure | AWS Lambda + API Gateway HTTP API + AWS SAM | - |
| Deployment | Vercel (frontend) + GitHub Actions (CI/CD) | - |
| ETL | Python + Pandas + GeoPandas + psycopg2 | 3.11 |

---

**文档结束**

四周后再见，你的 SuburbLens Phase 1 将上线。开始吧。
