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
| **`doubao-embedding-vision`（多模态）** | **豆包（火山方舟）** | **2048** | ★★★★★ | 极低（复用已有 `DOUBAO_API_KEY`） |
| `text-embedding-v3` | 阿里通义 | 1024 | ★★★★★ | ¥0.0007/千 tokens |
| `text-embedding-3-small` | OpenAI | 1536 | ★★★★ | $0.02/M tokens |

> **首选 `doubao-embedding-vision`（多模态）**：项目已接入豆包 API（`DOUBAO_API_KEY`），无需申请新 key。
>
> ⚠️ 注意：豆包单模态 text embedding 模型已停止新开通，需使用多模态 embedding 模型（仅传文本即可，不必传图片）。多模态模型需要在 ARK 控制台创建**推理接入点**（endpoint），获得 `ep-xxxxx` 格式的 ID。
>
> 调用方式：`POST https://ark.cn-beijing.volces.com/api/v3/embeddings/multimodal`，请求体中每条 input 是 `{ "type": "text", "text": "..." }` 对象（非纯字符串），每次调用返回一个合成向量。比较两条标题需要分别调用。

### 2.3 阈值决策——概念正确，阈值需校准

**结论：分层决策的思路非常好，但具体阈值不能照搬。**

原始提案用的是"距离"（越小越相似），但不同 embedding 模型 + 不同距离度量（余弦距离 vs 欧氏距离 vs 内积）的数值范围完全不同。建议统一用 **余弦相似度**（0–1，越大越相似）：

| 余弦相似度 | 判定 | 处理方式 |
|-----------|------|----------|
| ≥ 0.85 | 几乎确定是同一事件 | 自动合并，不调用 AI |
| 0.70 – 0.85 | 疑似同一事件 | 调用 AI 判断 + 提取归一化标题 |
| < 0.70 | 不同事件 | 创建新的正式热搜条目 |

#### 实测数据（doubao-embedding-vision multimodal, 2048 维）

```
0.9780  "雷军赠送苏炳添小米14"     vs "雷军送苏炳添小米14"                → 几乎相同
0.9714  "雷军赠送苏炳添小米14"     vs "雷军没有赠送苏炳添小米14"          → 同一事件正反面
0.9256  "雷军赠送苏炳添小米14"     vs "苏炳添晒出雷军赠送的小米14定制版"  → 同一事件
0.9162  "雷军送苏炳添小米14"       vs "苏炳添晒出雷军赠送的小米14定制版"  → 同一事件
0.9070  "苏炳添晒出雷军赠送…"     vs "苏炳添否认收到雷军赠送的小米14"    → 同一事件正反面
0.9043  "震惊！雷军竟然给苏炳添…" vs "辟谣：雷军并未给苏炳添送小米14"    → 同一事件正反面
0.8826  "震惊！雷军竟然给苏炳添…" vs "苏炳添晒出雷军赠送的小米14定制版"  → 同一事件（标题党 vs 中性）
0.7737  "雷军送苏炳添小米14"       vs "雷军回应赠送苏炳添手机：向体育精神致敬" → 同话题不同角度
0.3564  "雷军送苏炳添小米14"       vs "华为发布Mate70系列手机"           → 同领域不同事件
0.2949  "雷军送苏炳添小米14"       vs "今天北京暴雨红色预警"             → 完全无关
0.1925  "苏炳添晒出雷军赠送…"     vs "特朗普宣布新一轮关税政策"          → 完全无关
```

> 实测结论：embedding 对否定词不敏感（"赠送" vs "没有赠送" sim=0.97），但这在热搜场景下是合理的——肯定和否定通常是同一事件引发的正反讨论，应当合并。
>
> 阈值 0.85/0.70 可在 `melonscout.config.json` 中调整。

### 2.4 AI 归一化标题——优秀的补充 ✅

**结论：非常好，直接采纳。**

`factTitle` 可以作为聚类的展示标题，在前端以中立、去标题党的方式呈现。Prompt 设计合理，建议增加一个字段 `confidence` 让 AI 表达对 "是否同一事件" 的置信度。

---

## 3. 推荐实施方案：原始表 + 正式表双层架构

### 3.0 架构概述

将热搜数据分为两层：**原始层**（爬虫原样写入，不去重）和**正式层**（去重后，多平台标签，对外使用）。

```
之前:  scraper ──▶ hot_searches (带简单去重) ──▶ ai_analysis

现在:  scraper ──▶ raw_hot_searches (不去重，原样追加)
                          │
                   ┌──────▼───────┐
                   │  ingest()    │  embedding 匹配 + 阈值决策
                   └──────┬───────┘
                          │
                   hot_searches (正式表，去重，多平台) ──▶ ai_analysis
```

优势：
- **原始数据永不丢失**——爬虫只管写入，不做任何判断
- **正式表天然去重**——API 和前端只查正式表，无需额外 cluster join
- **多平台标签内置**——一条正式热搜可以标记为"微博+抖音+百度"
- **AI 分析只跑一次**——同一事件只在正式表有一行，不会重复分析

### 3.1 数据模型

#### 表 1：`raw_hot_searches`（原始热搜，新建）

爬虫的直接写入目标。每次爬取的每条结果都原样插入，**不做任何去重**。

```
raw_hot_searches
├── id              serial PRIMARY KEY
├── platformId      integer FK→platforms.id
├── title           text NOT NULL
├── url             text NOT NULL
├── heatValue       varchar(50)
├── rank            integer
├── extra           jsonb
├── createdAt       timestamp DEFAULT now()
├── hotSearchId     integer FK→hot_searches.id  -- 归入的正式热搜（ingest 后回填）
```

`hotSearchId` 在写入时为 NULL，`ingest()` 流程处理后回填，标记"这条原始记录归属于哪条正式热搜"。

#### 表 2：`hot_searches`（正式热搜，改造现有表）

去重后的正式热搜，对外使用的唯一表。一行 = 一个事件。

```
hot_searches
├── id              serial PRIMARY KEY
├── title           text NOT NULL              -- 归一化标题（首次入库时用原始标题，AI 可后续更新）
├── embedding       vector(2048)               -- 向量（pgvector）
├── platforms       jsonb NOT NULL DEFAULT '[]' -- 来源平台列表，如 [{"id":1,"name":"weibo"},{"id":4,"name":"douyin"}]
├── sourceCount     integer DEFAULT 1          -- 有多少条原始热搜指向此条
├── maxHeatValue    varchar(50)                -- 所有来源中最高热度值
├── maxRank         integer                    -- 所有来源中最高排名（最小 rank 值）
├── representativeUrl text NOT NULL            -- 代表性链接（热度最高的来源 URL）
├── createdAt       timestamp DEFAULT now()
├── updatedAt       timestamp DEFAULT now()
```

> 与现有 `hot_searches` 的区别：去掉了 `platformId`（单平台字段），改为 `platforms`（jsonb 多平台数组）；新增 `embedding`、`sourceCount`、`maxHeatValue` 等聚合字段。

#### 表 3：`ai_analysis`（不变）

继续 1:1 关联到 `hot_searches`。因为正式表已去重，AI 分析自动不会重复。

### 3.2 Ingest 流程

爬虫写入 `raw_hot_searches` 后，触发 `ingest()` 将原始数据"入库"到正式表。

```
  raw_hot_searches (新增条目)
          │
    ┌─────▼──────────┐
    │ exactMatch()   │  精确标题匹配（纯 SQL，0 成本）
    └─────┬──────────┘
          │
       命中？──YES──▶ 直接合并，跳过后续步骤
          │
          NO
          │
    ┌─────▼──────┐
    │  embed()   │  调用 doubao embedding API
    └─────┬──────┘
          │
    ┌─────▼──────┐
    │  search()  │  pgvector KNN: 在正式表中找最相似的
    └─────┬──────┘
          │
     ┌────▼────┐
     │ decide  │
     └────┬────┘
          │
    ┌─────┼──────────────────┐
    ▼     ▼                  ▼
  ≥0.85  0.70-0.85          <0.70
  合并    AI判断              新建
```

#### 伪代码

```typescript
// src/ingest/index.ts

export async function ingestRawItems(rawIds: number[]): Promise<void> {
  for (const rawId of rawIds) {
    const raw = await getRawHotSearch(rawId);

    // ── Step 0: 精确标题匹配（免费，零延迟）────────────────
    //    同一事件在同平台不同批次、或不同平台使用完全相同标题时命中。
    //    SQL: SELECT id FROM hot_searches
    //         WHERE title = $1
    //           AND created_at > now() - interval '7 days'
    //         LIMIT 1;
    const exactMatch = await findExactTitle(raw.title, { days: 7 });
    if (exactMatch) {
      await mergeIntoExisting(exactMatch.id, raw, 1.0);  // similarity = 1.0
      continue;
    }

    // ── Step 1: 生成 embedding ────────────────────────────
    const embedding = await embeddingProvider.embed(raw.title);

    // ── Step 2: 向量近邻搜索（7 天窗口）───────────────────
    //    SQL: SELECT id, title, 1 - (embedding <=> $1) AS similarity
    //         FROM hot_searches
    //         WHERE created_at > now() - interval '7 days'
    //           AND embedding IS NOT NULL
    //         ORDER BY embedding <=> $1
    //         LIMIT 5;
    const neighbors = await findSimilar(embedding, { days: 7, limit: 5 });
    const best = neighbors[0];

    // ── Step 3: 阈值决策 ──────────────────────────────────
    if (best && best.similarity >= THRESHOLD_AUTO_MERGE) {
      // ≥ 0.85: 自动合并到已有正式热搜
      await mergeIntoExisting(best.id, raw, best.similarity);
    } else if (best && best.similarity >= THRESHOLD_AI_JUDGE) {
      // 0.70–0.85: AI 判断
      const ai = await aiJudgeSimilarity(raw.title, best.title);
      if (ai.isSame) {
        await mergeIntoExisting(best.id, raw, best.similarity, ai.factTitle);
      } else {
        await createNewHotSearch(raw, embedding);
      }
    } else {
      // < 0.70: 全新事件
      await createNewHotSearch(raw, embedding);
    }
  }
}

async function mergeIntoExisting(
  hotSearchId: number, raw: RawHotSearch, similarity: number, newTitle?: string
): Promise<void> {
  // 1. 回填 raw 的 hotSearchId
  await db.update(rawHotSearches).set({ hotSearchId }).where(eq(rawHotSearches.id, raw.id));

  // 2. 更新正式热搜的聚合字段
  const existing = await getHotSearch(hotSearchId);
  const platforms = addPlatform(existing.platforms, raw.platformId);
  const maxHeat = maxHeatValue(existing.maxHeatValue, raw.heatValue);
  const maxRank = minRank(existing.maxRank, raw.rank);

  await db.update(hotSearches).set({
    platforms,
    sourceCount: sql`source_count + 1`,
    maxHeatValue: maxHeat,
    maxRank,
    title: newTitle ?? existing.title,  // AI 归一化标题覆盖
    updatedAt: new Date(),
  }).where(eq(hotSearches.id, hotSearchId));
}

async function createNewHotSearch(raw: RawHotSearch, embedding: number[]): Promise<void> {
  const [inserted] = await db.insert(hotSearches).values({
    title: raw.title,
    embedding: sql`${JSON.stringify(embedding)}::vector`,
    platforms: JSON.stringify([{ id: raw.platformId, name: raw.platformName }]),
    sourceCount: 1,
    maxHeatValue: raw.heatValue,
    maxRank: raw.rank,
    representativeUrl: raw.url,
  }).returning({ id: hotSearches.id });

  // 回填 raw
  await db.update(rawHotSearches).set({ hotSearchId: inserted.id }).where(eq(rawHotSearches.id, raw.id));
}
```

### 3.3 Embedding 服务

```typescript
// src/ingest/embedding.ts

export interface EmbeddingProvider {
  readonly modelName: string;
  readonly dimensions: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
```

实现策略与现有 `AIProvider` 一致——config-driven，支持多家：

| Provider | 模型 | 维度 | 端点 | 配置方式 |
|----------|------|------|------|----------|
| **`doubao`** | `doubao-embedding-vision`（多模态） | 2048 | `/api/v3/embeddings/multimodal` | **复用已有 `DOUBAO_API_KEY`** + 推理接入点 `ep-xxxxx` |
| `openai` | `text-embedding-3-small` | 1536 | `/v1/embeddings` | `OPENAI_API_KEY` |

新增 `melonscout.config.json` 配置：

```jsonc
{
  "ingest": {
    "enabled": true,
    "embedding": {
      "provider": "doubao",          // "doubao" | "openai"
      "apiKeyEnv": "DOUBAO_API_KEY", // 复用已有 key
      "endpointId": "ep-20260316113906-t5wmb", // 推理接入点 ID
      "dimensions": 2048
    },
    "thresholds": {
      "autoMerge": 0.85,             // ≥ 此值自动合并
      "aiJudge": 0.70                // ≥ 此值进入 AI 判断
    },
    "windowDays": 7,                 // 只在 N 天内查找相似项
    "neighborsLimit": 5              // KNN 取 top-K
  }
}
```

### 3.4 AI 相似度判定 Prompt

当余弦相似度落在 0.70–0.85 灰区时，调用 AI 做最终判断。

```typescript
// src/ingest/prompts.ts

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

### 3.5 Scraper 改造

`runPlatformScraper` 改为写入 `raw_hot_searches`，不再自行去重：

```typescript
// src/scraper/runner.ts（改造后）

export async function runPlatformScraper(
  platformName: string, scraper: ScraperSource
): Promise<number[]> {            // 返回新增 raw IDs
  const items = await scraper.fetch();
  const platform = await getPlatform(platformName);
  const rawIds: number[] = [];

  for (const item of items) {
    const [row] = await db.insert(rawHotSearches).values({
      platformId: platform.id,
      title: item.title,
      url: item.url,
      heatValue: item.heatValue ?? null,
      rank: item.rank ?? null,
      extra: item.extra ?? null,
    }).returning({ id: rawHotSearches.id });
    rawIds.push(row.id);
  }
  return rawIds;
}
```

### 3.6 API 变更

**现有 `GET /api/hot-searches` 基本不需要大改**——它继续查 `hot_searches` 表。区别是：

- `platformId` 筛选变为 `platforms @> '[{"id": N}]'`（jsonb 包含查询）
- 返回新增 `platforms`（数组）、`sourceCount` 字段
- 去掉原来的单 `platformId` 字段

#### 新增路由

```
GET /api/hot-searches/:id/sources   -- 查看某条正式热搜的所有原始来源
```

### 3.7 Cron 集成

```typescript
// src/cron/index.ts

// 改造后：scrape → ingest → analyze
const rawIds = await runPlatformScraper(name, scraper);
if (rawIds.length > 0) {
  await ingestRawItems(rawIds);     // 去重入库
}
// AI 分析仍然跑在正式表上，逻辑不变
```

### 3.8 与 AI 分析的关系

AI 分析（Phase 1 + Phase 2）继续在 `hot_searches` 上运行，**无需改动**。因为正式表已经去重，每个事件只有一行，AI 自动不会重复分析。

```
  scraper ──▶ raw_hot_searches
                    │
              ingest (embedding + dedup)
                    │
              hot_searches ──▶ ai_analysis
              (正式，去重)      (1:1，不变)
```

协同优势：同一事件从 3 个平台爬到 3 条原始热搜，但正式表只有 1 行，AI 分析只需调用 1 次。

---

## 4. 文件结构

```
src/ingest/                        ← 新模块（取代原 cluster/）
├── DESIGN.md                      ← 本文档
├── index.ts                       -- ingestRawItems() 主入口
├── embedding.ts                   -- EmbeddingProvider 接口 + Doubao 实现
├── similarity.ts                  -- findSimilar()（pgvector KNN 查询）
├── prompts.ts                     -- AI 相似度判定 prompt
└── types.ts                       -- IngestResult, SimilarityJudgment 等

src/scraper/
└── runner.ts                      ← 改造：写入 raw_hot_searches，返回 rawIds

src/db/
└── schema.ts                      ← 新增 rawHotSearches 表，改造 hotSearches 表
```

---

## 5. 依赖变更

| 依赖 | 类型 | 用途 |
|------|------|------|
| `pgvector` PG 扩展 | 数据库层 | `CREATE EXTENSION vector`，Docker 镜像用 `pgvector/pgvector:pg15` |
| `drizzle-orm` | 已有 | Schema 定义（向量列用 raw SQL） |
| Doubao 多模态 Embedding API | 外部服务 | `doubao-embedding-vision` 通过推理接入点 `ep-xxxxx` 调用 |

无需新增 npm 包。Embedding API 通过原生 `fetch` 调用。pgvector SQL 通过 Drizzle 的 `sql` tagged template。

#### Doubao 多模态 Embedding 实现参考

```typescript
// src/ingest/embedding.ts

class DoubaoEmbeddingProvider implements EmbeddingProvider {
  readonly modelName = "doubao-embedding-vision";
  readonly dimensions = 2048;
  private apiKey: string;
  private endpointId: string;
  private baseUrl = "https://ark.cn-beijing.volces.com/api/v3/embeddings/multimodal";

  constructor(apiKey: string, endpointId: string) {
    this.apiKey = apiKey;
    this.endpointId = endpointId;
  }

  async embed(text: string): Promise<number[]> {
    const resp = await fetch(this.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.endpointId,
        input: [{ type: "text", text }],
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Doubao embedding API ${resp.status}: ${body}`);
    }

    const json = (await resp.json()) as {
      data: { embedding: number[] };
      usage: { prompt_tokens: number; total_tokens: number };
    };
    return json.data.embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const CONCURRENCY = 5;
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += CONCURRENCY) {
      const batch = texts.slice(i, i + CONCURRENCY);
      const vecs = await Promise.all(batch.map((t) => this.embed(t)));
      results.push(...vecs);
    }
    return results;
  }
}
```

> ⚠️ 豆包多模态端点每次调用返回单个向量。批量处理需并发调用。实测单次延迟 ~200ms，5 并发处理 50 条约 2 秒。

---

## 6. Migration 步骤

```sql
-- migration: raw_and_formal_hot_searches

-- 1. 启用 pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 创建原始热搜表
CREATE TABLE raw_hot_searches (
  id              SERIAL PRIMARY KEY,
  platform_id     INTEGER REFERENCES platforms(id),
  title           TEXT NOT NULL,
  url             TEXT NOT NULL,
  heat_value      VARCHAR(50),
  rank            INTEGER,
  extra           JSONB,
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  hot_search_id   INTEGER REFERENCES hot_searches(id)  -- ingest 后回填
);

CREATE INDEX idx_raw_hs_platform ON raw_hot_searches(platform_id);
CREATE INDEX idx_raw_hs_hot_search ON raw_hot_searches(hot_search_id);

-- 3. 改造正式热搜表
--    新增字段
ALTER TABLE hot_searches ADD COLUMN embedding    vector(2048);
ALTER TABLE hot_searches ADD COLUMN platforms    JSONB NOT NULL DEFAULT '[]';
ALTER TABLE hot_searches ADD COLUMN source_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE hot_searches ADD COLUMN max_heat_value VARCHAR(50);
ALTER TABLE hot_searches ADD COLUMN max_rank     INTEGER;
ALTER TABLE hot_searches ADD COLUMN representative_url TEXT;
ALTER TABLE hot_searches ADD COLUMN updated_at   TIMESTAMP DEFAULT now();

--    迁移已有数据：用现有 platform_id 填充 platforms jsonb
--    （具体 SQL 取决于是否需要保留旧数据，此处略）

-- 4. 创建 HNSW 索引
CREATE INDEX idx_hot_searches_embedding
  ON hot_searches USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

---

## 7. 实施建议

### Phase 1（MVP，建议 2-3 天）

1. PostgreSQL 换用 `pgvector/pgvector:pg15` Docker 镜像
2. 新建 `raw_hot_searches` 表
3. 改造 `hot_searches` 表：新增 `embedding`、`platforms`、`sourceCount` 等字段
4. 实现 `DoubaoEmbeddingProvider`
5. 实现 `ingestRawItems()` 核心入库逻辑
6. 改造 `runPlatformScraper` → 写入 `raw_hot_searches`，返回 rawIds
7. Cron 中串联：scrape → ingest → analyze
8. 改造 `GET /api/hot-searches` 适配新字段

### Phase 2（增强，建议 2-3 天）

1. AI 灰区判定 + 归一化标题
2. `GET /api/hot-searches/:id/sources` 查看原始来源
3. 前端展示"N 个平台在讨论"标签
4. 迁移历史数据（旧 `hot_searches` → `raw_hot_searches` + 重新 ingest）

### Phase 3（优化，视需求）

1. 阈值调优（收集人工标注数据）
2. 关键词 blocking 预过滤（数据量 > 5000/批时）
3. 历史数据回填 embedding
