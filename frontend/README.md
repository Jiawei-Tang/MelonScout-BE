# MelonScout-FE (瓜田侦探前端)

“拨开瓜皮看真相”的 Web 前端实现。该前端与当前仓库内后端代码完全独立，放在单独的 `frontend/` 目录，拥有自己的依赖、构建和运行命令，不会影响后端构建流程。

## 1) 目标与定位

- 面向中文用户的热搜“卷宗化”展示页面
- 连接后端 `http://localhost:3000` API，展示 AI 判定结果
- 视觉语言结合“吃瓜”亲切感 + “侦探”专业感
- 支持深色模式，适配长期阅读和分析场景

## 2) 视觉规范落地

### 品牌色

- 侦探绿：`#10B981`（真相/通过）
- 深邃黑：`#0F172A`（理性/侦探感）
- 警示红：`#EF4444`（误导/高风险）

以上颜色已写入 `tailwind.config.ts` 的 `detective` 颜色组。

### 设计理念

- 原则：简洁、直观、快速扫读
- 重点信息优先：标题 -> 真相指数 -> AI 结论
- 减少装饰性噪声，保留“卷宗感”的结构层次

## 3) 页面结构对应需求

### A. 顶部导航 The Briefing

- 左侧：Logo（西瓜）+ 瓜田侦探标题
- 中间：实时巡查统计（巡查数量 + 标题党数量）
- 右侧：平台切换（全网 + 动态平台标签）+ 明暗模式切换

### B. 核心列表区 The Case Files

每条热搜以“卷宗卡片”展示：

- 来源标签：平台 + 排名 + 抓取时间
- 标题：粗体高可读性
- 侦探判定区：
  - 真相指数（圆形进度）
  - 脱水标签（如 标题党 / 反转风险 / 事实陈述）
  - AI 简评（优先 `verdict`，回退 `reason`）
- 详情区：
  - 分诊原因、深度分析
  - 原始链接跳转
- 微交互：
  - 展开详情时触发 “切瓜” 动画（`melon-cut`）

### C. 侧边栏 Evidence Lab

- 热词云：从当前列表标题做轻量分词统计
- 避雷榜：按平台计算高风险占比
- 项目动态：展示后端 AI 模型版本（优先 `deepAiModel`）

## 4) API 对接说明（来自 API.md）

前端默认访问 `VITE_API_BASE_URL=http://localhost:3000`。

- `GET /api/platforms`
  - 用途：构建平台切换按钮
- `GET /api/hot-searches?platformId=&limit=&offset=`
  - 用途：主列表数据、统计、侧栏分析

当前页面使用了以下核心字段：

- 基础信息：`id`, `platformId`, `title`, `url`, `rank`, `createdAt`
- AI 信息：`analysis.score`, `analysis.isClickbait`, `analysis.category`, `analysis.triageReason`, `analysis.reason`, `analysis.verdict`, `analysis.deepAnalysis`, `analysis.aiModel`, `analysis.deepAiModel`

## 5) 目录结构

```txt
frontend/
  ├─ src/
  │  ├─ components/
  │  │  ├─ melon-card.tsx
  │  │  ├─ evidence-lab.tsx
  │  │  └─ ui.tsx
  │  ├─ lib/
  │  │  ├─ api.ts
  │  │  └─ types.ts
  │  ├─ App.tsx
  │  ├─ main.tsx
  │  └─ index.css
  ├─ index.html
  ├─ tailwind.config.ts
  ├─ vite.config.ts
  ├─ package.json
  └─ .env.example
```

## 6) 本地启动

```bash
# 1) 启动后端（仓库根目录）
bun run dev

# 2) 新开终端，进入前端目录
cd frontend
bun install
cp .env.example .env

# 3) 启动前端
bun run dev
```

访问：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3000`

## 7) 构建与隔离策略

- 后端命令在仓库根目录执行，前端命令只在 `frontend/` 执行
- 两侧分别维护自己的 `package.json` 和依赖树
- 前端 `build` 产物仅输出到 `frontend/dist`
- 不修改后端 `tsconfig.json` / 构建脚本，确保后端构建行为保持不变

## 8) 已实现交互建议映射

- “切瓜”动画：已实现（详情展开动效）
- 深色模式：已实现（右上角切换，`localStorage` 持久化）
- 用户投票：已实现前端 UI 计数（本地状态）

> 用户投票写回 PostgreSQL 需要后端新增接口（例如 `POST /api/hot-searches/:id/feedback`），当前前端已预留交互入口。

## 9) 后续建议

- 新增详情路由（`/case/:id`），承载完整深度分析报告
- 接入真实热词分词（如结巴）替代当前轻量规则
- 平台筛选增加“抖音”等来源（后端平台表同步后自动显示）
- 增加列表自动刷新与最近更新时间提示
