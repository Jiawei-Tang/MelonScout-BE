# MelonScout API Reference

Base URL: `http://localhost:3000`

---

## Health Check

### `GET /health`

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-03-09T12:00:00.000Z"
}
```

---

## Platforms

### `GET /api/platforms`

List all supported platforms.

**Response:**

```json
{
  "data": [
    { "id": 1, "name": "weibo", "displayName": "微博" },
    { "id": 2, "name": "zhihu", "displayName": "知乎" }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `number` | Platform ID |
| `name` | `string` | Platform slug |
| `displayName` | `string` | Display name |

---

## Hot Searches

### `GET /api/hot-searches`

List hot searches with AI analysis results.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `platformId` | `number` | — | Filter by platform ID |
| `hasAnalysis` | `boolean` | — | Only return items with AI analysis when `true`; omit this param for all items |
| `onlyClickbait` | `boolean` | — | Only return problematic analyzed items (`isClickbait=true` or `score>=50`) when `true` |
| `days` | `number` | `7` | Query window in days (max 7) |
| `limit` | `number` | `30` | Max items (capped at 200) |
| `offset` | `number` | `0` | Pagination offset |

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "platformId": 1,
      "title": "某明星深夜被拍到疑似出轨",
      "url": "https://s.weibo.com/weibo?q=...",
      "heatValue": "9999万",
      "rank": 1,
      "createdAt": "2026-03-09T12:00:00.000Z",
      "extra": null,
      "analysis": {
        "needsFactCheck": true,
        "triageReason": "涉及名人丑闻，需核实来源",
        "category": "celebrity_scandal",
        "isClickbait": false,
        "score": 54,
        "reason": "名人丑闻消息来源未经证实",
        "deepAnalysis": "【表述手法】标题以爆料口吻呈现未经证实的名人负面消息。...",
        "verdict": "消息未经证实，建议关注官方回应",
        "deepAnalyzedAt": "2026-03-09T12:01:00.000Z"
      }
    }
  ],
  "meta": {
    "limit": 30,
    "offset": 0,
    "days": 7,
    "hasAnalysis": false,
    "hasMore": true,
    "nextOffset": 30
  }
}
```

> `analysis` is `null` if the title has not yet been triaged.

#### `analysis` Fields

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `needsFactCheck` | `boolean` | No | Does this title need fact-checking? |
| `triageReason` | `string` | No | Why it needs / doesn't need fact-checking |
| `category` | `string` | No | Triage category (see [Category Values](#category-values)) |
| `isClickbait` | `boolean` | Yes | Is it clickbait? `null` if not yet fact-checked |
| `score` | `number` | Yes | Misleading score 0–100. `null` if not yet fact-checked |
| `reason` | `string` | Yes | One-line fact-check conclusion |
| `deepAnalysis` | `string` | Yes | Detailed analysis report |
| `verdict` | `string` | Yes | One-line final verdict |
| `deepAnalyzedAt` | `string` | Yes | ISO timestamp of fact-check completion |

---

### `GET /api/hot-searches/highlights/top`

Get top 3 highlighted hot searches (AI-analyzed only) for the header spotlight area.

Selection logic (composite score):
- Clickbait/high-risk items are prioritized first (`isClickbait=true` or `score>=51`)
- Heat value (supports `万` / `亿` parsing)
- AI update recency (`analysis.updatedAt`)
- User votes (`upVotes`, `downVotes`)

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | `number` | `7` | Query window in days (max 7) |

**Response:**

```json
{
  "data": [
    {
      "id": 1,
      "title": "某热点标题",
      "analysis": {
        "score": 82,
        "verdict": "标题夸张，核心信息缺失",
        "upVotes": 12,
        "downVotes": 2
      },
      "compositeScore": 19.32
    }
  ],
  "meta": { "days": 7, "size": 3 }
}
```

---

### `POST /api/hot-searches/:id/votes`

Vote for AI judgment quality on a hot search.

**Request Body:**

```json
{ "action": "up" }
```

`action` supports:
- `up` — “我觉得准”
- `down` — “AI 被骗了”

**Response (200):**

```json
{
  "data": {
    "hotSearchId": 1,
    "upVotes": 13,
    "downVotes": 2
  }
}
```

---

### `GET /api/hot-searches/:id`

Get a single hot search with full analysis details.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `number` | Hot search ID |

**Response (200):**

```json
{
  "data": {
    "id": 3,
    "platformId": 1,
    "title": "震惊！你绝对想不到这件事的真相",
    "url": "https://example.com/3",
    "heatValue": "7777万",
    "rank": 3,
    "createdAt": "2026-03-09T12:00:00.000Z",
    "extra": null,
    "analysis": {
      "id": 5,
      "needsFactCheck": true,
      "triageReason": "标题包含典型标题党用语",
      "category": "clickbait",
      "aiModel": "gemini-2.0-flash",
      "isClickbait": true,
      "score": 96,
      "reason": "标题使用夸张修辞，核心事实被隐瞒或扭曲",
      "deepAnalysis": "【表述手法】标题使用了煽动性词汇和悬念手法...",
      "verdict": "高度标题党，内容与标题严重不符",
      "deepAiModel": "gemini-2.0-flash",
      "deepAnalyzedAt": "2026-03-09T12:01:00.000Z"
    }
  }
}
```

**Response (404):**

```json
{ "error": "Hot search not found" }
```

> The detail endpoint returns two additional fields in `analysis`: `id`, `aiModel`, `deepAiModel` (the AI models used for triage and fact-check).

---

## Weibo Hot

### `GET /api/weibo-hot`

Fetch and return the current Weibo hot search list via 天行数据 API. Items are also saved to the database. Requires `TIANAPI_API_KEY`.

**Response (200):**

```json
{
  "code": 200,
  "msg": "success",
  "result": {
    "list": [
      {
        "hotword": "某话题",
        "hotwordnum": "9999999",
        "hottag": "新",
        "rank": 1,
        "heatValue": "9999999"
      }
    ],
    "fetchedAt": "2026-03-09T12:00:00.000Z",
    "saved": 50
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `hotword` | `string` | Hot search title |
| `hotwordnum` | `string` | Heat value |
| `hottag` | `string` | Tag (e.g. `新`, `热`, `沸`) |
| `rank` | `number` | Rank position |
| `heatValue` | `string` | Heat value |

**Response (503):**

```json
{ "error": "TIANAPI_API_KEY is not configured" }
```

---

## Reference

### Category Values

| Value | Description |
|-------|-------------|
| `clickbait` | 标题党 / 夸张表述 |
| `celebrity_scandal` | 名人丑闻 / 未经证实的爆料 |
| `corporate_claim` | 企业成就归属存疑 |
| `policy` | 重大政策 / 法规声明 |
| `health_science` | 健康 / 科学断言 |
| `data_claim` | 数据 / 统计声明 |
| `normal` | 正常话题，无需核查 |

### Score Range

| Range | Meaning |
|-------|---------|
| 0–20 | 基本真实可信 |
| 21–50 | 存在一定争议或夸大 |
| 51–70 | 可信度存疑 |
| 71–100 | 高度标题党 / 误导 / 虚假 |

> Score strategy:
> - AI analyzed + needs deep fact-check: score comes from phase-2 fact-check result.
> - AI analyzed + no deep fact-check needed: backend writes a low-risk score (`0-20`) during triage.
> - Not yet analyzed: score is `null`, frontend can show `--`.
