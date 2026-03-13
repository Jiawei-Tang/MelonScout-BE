# 热搜聚合（Hot Search Clustering）设计文档

## 1. 问题描述

来自同一平台或不同平台的热搜经常描述同一事件，但用词不同，目前系统无法识别它们的关联性。

```
微博: "震惊！雷军竟然给苏炳添送了部小米14"
抖音: "苏炳添晒出雷军赠送的小米14定制版"
百度: "雷军送苏炳添小米14"
```

当前 `runPlatformScraper`（`src/scraper/runner.ts`）的去重仅限于 **同平台 + 完全相同标题 + 3 天窗口**，无法处理上述情况。

---

## 2. 方案评估

### 原始提案

| 步骤 | 方案 | 评估 |
|------|------|------|
| 第一步：关键词倒排索引 | 分词 → 建立 Map → 只比有交集的 | ⚠️ 当前规模不必要，但思路正确 |
| 第二步：pgvector 向量检索 | Embedding → 存入 PG → HNSW 近邻查询 | ✅ **核心方案，强烈推荐** |
| 第三步：阈值决策 | 距离分层 → AI 仅处理灰区 | ✅ 概念正确，阈值需校准 |
| AI 归一化标题 | 让 AI 输出 `factTitle` | ✅ 很好的补充 |

### 2.1 关键词倒排索引——暂缓

**结论：当前阶段不需要，作为未来扩展保留。**

理由：

- **数据规模过小**。3 个启用平台（微博/百度/抖音），每 6–12 小时爬一次，每批 10–50 条。7 天窗口内最多 ~2000 条。全量两两比对 = 2000² = 4M 次，每次只是一个向量内积运算（pgvector 在 HNSW 索引下 < 1ms），完全不需要预过滤。
- **中文分词复杂度高**。需要引入 `jieba` 或类似分词库（C++ native binding），在 Bun 运行时下兼容性不确定，且分词质量直接决定 blocking 效果。命名实体（人名、品牌名）比通用分词更有用，但 NER 是更重的依赖。
- **收益有限**。即使未来数据量增长 10 倍（~20,000 条/周），pgvector HNSW 查询仍然 < 5ms，blocking 带来的加速微乎其微。

> 📌 保留意见：如果日后单批次数据超过 5000 条，或 embedding API 调用成为成本瓶颈（需要减少调用次数），可以引入关键词 blocking 作为 **embedding 前的预过滤**——只对有关键词交集的候选对调用 embedding。届时推荐使用 Bun 原生 WASM 版分词器（如 `@aspect-build/aspect-wasm-jieba`）以避免 C++ binding 兼容问题。

### 2.2 pgvector 向量检索——核心方案 ✅

**结论：强烈推荐，是本方案的核心。**

理由：

- **语义匹配是正确的抽象层**。"雷军送苏炳添小米14" 和 "苏炳添晒雷军赠送小米14定制版" 的关键词重叠不高，但语义接近。Embedding 天然解决这个问题。
- **pgvector 与现有架构无缝集成**。项目已用 PostgreSQL + Drizzle ORM，pgvector 只需 `CREATE EXTENSION vector`，无需引入新数据库。
- **HNSW 索引性能极好**。在万级数据上，近邻查询 < 1ms，远优于需要的性能。
- **成本极低**。`text-embedding-3-small`（OpenAI）或 `text-embedding-v3`（阿里通义）定价约 ¥0.001/千 tokens，每天 300 条热搜的 embedding 费用 < ¥0.01。

Embedding 模型推荐优先级：

| 模型 | 提供商 | 维度 | 中文效果 | 价格 |
|------|--------|------|----------|------|
| `text-embedding-v3` | 阿里通义 | 1024 | ★★★★★ | ¥0.0007/千 tokens |
| `text-embedding-3-small` | OpenAI | 1536 | ★★★★ | $0.02/M tokens |
| `BAAI/bge-m3` | 自建/HuggingFace | 1024 | ★★★★★ | 免费（需自建） |

> 建议首选通义千问 `text-embedding-v3`：中文效果最好、价格最低、国内访问快。

### 2.3 阈值决策——概念正确，阈值需校准

**结论：分层决策的思路非常好，但具体阈值不能照搬。**

原始提案用的是"距离"（越小越相似），但不同 embedding 模型 + 不同距离度量（余弦距离 vs 欧氏距离 vs 内积）的数值范围完全不同。建议统一用 **余弦相似度**（0–1，越大越相似）：

| 余弦相似度 | 判定 | 处理方式 |
|-----------|------|----------|
| ≥ 0.92 | 几乎确定是同一事件 | 自动合并，不调用 AI |
| 0.80 – 0.92 | 疑似同一事件 | 调用 AI 判断 + 提取归一化标题 |
| < 0.80 | 不同事件 | 跳过 |

> ⚠️ 以上阈值是基于 `text-embedding-3-small` 对中文短文本的经验估计。**必须用真实热搜数据做一轮标注和校准**。建议收集 100 对人工标注的「相同/不同」热搜对，画 ROC 曲线确定最优阈值。
>
> 阈值应放在 `melonscout.config.json` 中，方便调整而不需要改代码。

### 2.4 AI 归一化标题——优秀的补充 ✅

**结论：非常好，直接采纳。**

`factTitle` 可以作为聚类的展示标题，在前端以中立、去标题党的方式呈现。Prompt 设计合理，建议增加一个字段 `confidence` 让 AI 表达对 "是否同一事件" 的置信度。

---

## 3. 推荐实施方案

### 3.1 数据模型

#### 新增表：`hot_search_clusters`

聚类（Cluster）是聚合的核心实体。一个 Cluster 代表一个"事件"，包含多条来自不同平台的热搜。

```
hot_search_clusters
├── id              serial PRIMARY KEY
├── canonicalTitle  text NOT NULL          -- AI 归一化标题（factTitle）
├── representativeId integer FK→hot_searches.id  -- 热度最高的热搜作为代表
├── memberCount     integer DEFAULT 1      -- 成员数量（冗余，加速查询）
├── totalHeat       bigint  DEFAULT 0      -- 所有成员热度之和（排序用）
├── createdAt       timestamp DEFAULT now()
├── updatedAt       timestamp DEFAULT now()
```

#### 新增表：`hot_search_cluster_members`

聚类成员的多对多关系表（一条热搜只能属于一个聚类）。

```
hot_search_cluster_members
├── id              serial PRIMARY KEY
├── clusterId       integer FK→hot_search_clusters.id
├── hotSearchId     integer FK→hot_searches.id UNIQUE  -- 一条热搜只属于一个聚类
├── similarity      real                               -- 与代表项的余弦相似度
├── joinedAt        timestamp DEFAULT now()
```

#### 修改表：`hot_searches`

新增列存储 embedding 向量。

```sql
-- 需要先安装 pgvector 扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 添加向量列（维度取决于 embedding 模型）
ALTER TABLE hot_searches ADD COLUMN embedding vector(1024);

-- 创建 HNSW 索引（余弦距离）
CREATE INDEX idx_hot_searches_embedding ON hot_searches
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

#### Drizzle Schema 定义

```typescript
// src/db/schema.ts 新增

import { vector } from "drizzle-orm/pg-core";  // 需要 drizzle-orm 支持 pgvector

export const hotSearchClusters = pgTable("hot_search_clusters", {
  id: serial("id").primaryKey(),
  canonicalTitle: text("canonical_title").notNull(),
  representativeId: integer("representative_id").references(() => hotSearches.id),
  memberCount: integer("member_count").default(1).notNull(),
  totalHeat: integer("total_heat").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const hotSearchClusterMembers = pgTable("hot_search_cluster_members", {
  id: serial("id").primaryKey(),
  clusterId: integer("cluster_id").references(() => hotSearchClusters.id).notNull(),
  hotSearchId: integer("hot_search_id").references(() => hotSearches.id).unique().notNull(),
  similarity: real("similarity"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});
```

> 注：`embedding` 向量列不通过 Drizzle 管理（Drizzle 对 pgvector 支持有限），用 raw SQL migration 创建。

### 3.2 聚类流程

聚类在 **爬虫写入后** 触发，作为 scraper pipeline 的后置步骤。

```
                    ┌─────────────┐
  scraper.fetch()──▶│ saveBatch() │──▶ 返回 newItemIds[]
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  cluster()  │  ◀── 本方案的核心新增
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
   getEmbedding()    findNeighbors()    mergeOrCreate()
   (embedding API)   (pgvector KNN)    (AI 或自动合并)
```

#### 伪代码

```typescript
// src/cluster/index.ts

export async function clusterNewItems(newItemIds: number[]): Promise<void> {
  for (const itemId of newItemIds) {
    // 1. 获取该热搜的标题
    const item = await getHotSearch(itemId);

    // 2. 生成 embedding（如果还没有）
    const embedding = await getOrCreateEmbedding(item.id, item.title);

    // 3. 在 7 天窗口内查找最相似的已有热搜（排除自身）
    //    SQL: SELECT id, title, 1 - (embedding <=> $1) AS similarity
    //         FROM hot_searches
    //         WHERE created_at > now() - interval '7 days'
    //           AND id != $2
    //           AND embedding IS NOT NULL
    //         ORDER BY embedding <=> $1
    //         LIMIT 5;
    const neighbors = await findSimilarItems(embedding, item.id, {
      days: 7,
      limit: 5,
    });

    // 4. 阈值决策
    const bestMatch = neighbors[0];

    if (!bestMatch || bestMatch.similarity < THRESHOLD_DIFFERENT) {
      // < 0.80: 全新事件，创建单成员聚类
      await createNewCluster(item);
      continue;
    }

    if (bestMatch.similarity >= THRESHOLD_AUTO_MERGE) {
      // ≥ 0.92: 自动合并到已有聚类
      const cluster = await getClusterByHotSearchId(bestMatch.id);
      if (cluster) {
        await addToCluster(cluster.id, item, bestMatch.similarity);
      } else {
        // bestMatch 还没有聚类，创建新聚类并把两者都加入
        await createNewCluster(item, bestMatch);
      }
      continue;
    }

    // 0.80–0.92: 灰区，调用 AI 判断
    const aiResult = await aiJudgeSimilarity(item.title, bestMatch.title);
    if (aiResult.isSame) {
      const cluster = await getClusterByHotSearchId(bestMatch.id);
      if (cluster) {
        await addToCluster(cluster.id, item, bestMatch.similarity, aiResult.factTitle);
      } else {
        await createNewCluster(item, bestMatch, aiResult.factTitle);
      }
    } else {
      await createNewCluster(item);
    }
  }
}
```

### 3.3 Embedding 服务

```typescript
// src/cluster/embedding.ts

export interface EmbeddingProvider {
  readonly modelName: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
```

实现策略与现有 `AIProvider` 一致——config-driven，支持多家：

| Provider | 模型 | 维度 | 配置方式 |
|----------|------|------|----------|
| `dashscope` | `text-embedding-v3` | 1024 | `DASHSCOPE_API_KEY` |
| `openai` | `text-embedding-3-small` | 1536 | `OPENAI_API_KEY`（复用已有） |

新增 `melonscout.config.json` 配置：

```jsonc
{
  "cluster": {
    "enabled": true,
    "embedding": {
      "provider": "dashscope",       // "dashscope" | "openai"
      "apiKeyEnv": "DASHSCOPE_API_KEY",
      "model": "text-embedding-v3",
      "dimensions": 1024
    },
    "thresholds": {
      "autoMerge": 0.92,             // ≥ 此值自动合并
      "mayBeSame": 0.80              // ≥ 此值进入 AI 判断
    },
    "windowDays": 7,                 // 只在 N 天内查找相似项
    "neighborsLimit": 5              // KNN 取 top-K
  }
}
```

### 3.4 AI 相似度判定 Prompt

当两条热搜的余弦相似度落在灰区时，调用 AI 做最终判断。

```typescript
// src/cluster/prompts.ts

export const SIMILARITY_SYSTEM_PROMPT = `你是一个数据清洗专家。我会给你两个热搜标题。

请完成以下任务：
1. 判断它们是否指代同一个核心新闻事件（不要求用词相同，只要核心事件一致即可）
2. 如果是同一事件，提取出一个最中立、不带标题党色彩的"核心事实标题"
3. 给出你的置信度

Output Format: 必须返回 JSON:
{
  "isSame": boolean,
  "factTitle": "string | null",
  "confidence": number,
  "reason": "一句话解释判断依据"
}

注意：
- factTitle 只在 isSame=true 时非 null
- confidence 是 0-1 的浮点数（1 = 完全确定）
- 仅返回 JSON，不要添加其他文字
- 全部使用中文`;

export function buildSimilarityPrompt(titleA: string, titleB: string): string {
  return `请判断以下两个热搜标题是否指代同一个核心新闻事件：

标题A: ${titleA}
标题B: ${titleB}`;
}
```

### 3.5 API 变更

#### 新增路由

```
GET /api/clusters                  -- 聚类列表（支持分页、按平台筛选）
GET /api/clusters/:id              -- 聚类详情（含所有成员热搜）
```

#### 修改现有路由

`GET /api/hot-searches` 返回中增加 `clusterId` 字段，前端可据此展示"N 个平台在讨论同一话题"。

### 3.6 Cron 集成

在 `src/cron/index.ts` 中，`runPlatformScraper` 返回的新增条目 IDs 传给 `clusterNewItems`：

```typescript
// 现有流程
const inserted = await runPlatformScraper(name, scraper);

// 新增：对新入库的条目执行聚类
if (inserted > 0) {
  await clusterNewItems(newItemIds);
}
```

> 注：需要小幅修改 `runPlatformScraper` 使其返回新增条目的 ID 列表。

---

## 4. 文件结构

```
src/cluster/
├── DESIGN.md              ← 本文档
├── index.ts               -- clusterNewItems() 主入口
├── embedding.ts           -- EmbeddingProvider 接口 + 实现
├── similarity.ts          -- findSimilarItems()（pgvector 查询）
├── prompts.ts             -- AI 相似度判定 prompt
├── merge.ts               -- createNewCluster() / addToCluster()
└── types.ts               -- ClusterResult, SimilarityJudgment 等类型
```

---

## 5. 依赖变更

| 依赖 | 类型 | 用途 |
|------|------|------|
| `pgvector` PG 扩展 | 数据库层 | `CREATE EXTENSION vector`，Docker 镜像用 `pgvector/pgvector:pg15` |
| `drizzle-orm` | 已有 | Schema 定义（向量列用 raw SQL） |
| Embedding API | 外部服务 | 通义千问 / OpenAI embedding 接口 |

无需新增 npm 包——embedding API 调用通过原生 `fetch` 即可。pgvector 的 SQL 操作通过 Drizzle 的 `sql` tagged template 处理。

---

## 6. Migration 步骤

```sql
-- migration: add_clustering_support

-- 1. 启用 pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 热搜表添加向量列
ALTER TABLE hot_searches ADD COLUMN embedding vector(1024);

-- 3. 创建 HNSW 索引
CREATE INDEX idx_hot_searches_embedding
  ON hot_searches USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 4. 聚类表
CREATE TABLE hot_search_clusters (
  id              SERIAL PRIMARY KEY,
  canonical_title TEXT NOT NULL,
  representative_id INTEGER REFERENCES hot_searches(id),
  member_count    INTEGER NOT NULL DEFAULT 1,
  total_heat      BIGINT  NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP NOT NULL DEFAULT now()
);

-- 5. 聚类成员表
CREATE TABLE hot_search_cluster_members (
  id              SERIAL PRIMARY KEY,
  cluster_id      INTEGER NOT NULL REFERENCES hot_search_clusters(id),
  hot_search_id   INTEGER NOT NULL REFERENCES hot_searches(id) UNIQUE,
  similarity      REAL,
  joined_at       TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX idx_cluster_members_cluster ON hot_search_cluster_members(cluster_id);
```

---

## 7. 与现有 AI 分析的关系

聚类和 AI 分析（Phase 1 Triage + Phase 2 Fact-check）是**两个独立流水线**，但有协同价值：

```
                     聚类流水线（本方案）
                     ┌─────────────────┐
  scraper ──▶ save ──▶  cluster()      │
                     └────────┬────────┘
                              │
                     AI 分析流水线（已有）
                     ┌────────▼────────┐
                     │  phaseOneTriage  │
                     │  phaseTwoFact    │
                     └─────────────────┘
```

协同策略：
- **聚类先于 AI 分析**。如果一个 cluster 已有一条热搜做过 fact-check，后续加入的同事件热搜可以复用分析结果（不必重复调用 AI），显著节省 AI 成本。
- **cluster 级别的分析结果**。未来可以在 `hot_search_clusters` 上添加 `analysis_id` 字段，让整个 cluster 共享一份 AI 分析。

---

## 8. 实施建议

### Phase 1（MVP，建议 1-2 天）

1. PostgreSQL 换用 `pgvector/pgvector:pg15` Docker 镜像
2. 新增 `hot_search_clusters` + `hot_search_cluster_members` 表
3. `hot_searches` 添加 `embedding vector(1024)` 列 + HNSW 索引
4. 实现 `EmbeddingProvider`（先只做一家，如 OpenAI）
5. 实现 `clusterNewItems` 核心逻辑
6. 修改 `runPlatformScraper` 返回新增 IDs
7. Cron 中调用聚类
8. `GET /api/clusters` 基础 API

### Phase 2（增强，建议 2-3 天）

1. AI 相似度判定（灰区 prompt）
2. `GET /api/clusters/:id` 详情 API
3. 修改 `GET /api/hot-searches` 增加 `clusterId`
4. 前端展示"N 个平台在讨论同一话题"
5. Cluster 级别的 AI 分析复用

### Phase 3（优化，视需求）

1. 阈值自动校准（收集人工标注数据）
2. 关键词 blocking 预过滤（如果数据量 > 5000/批）
3. 批量 embedding（`embedBatch`）降低 API 延迟
4. 历史数据回填（对已有热搜补生成 embedding 并聚类）
