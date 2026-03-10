# AGENTS.md

## General Preferences

- **Frontend**: Use React with TypeScript by default.
- **Backend**: Use JavaScript/TypeScript tech stacks by default (Bun + Hono, Node.js, etc.).
- **Package manager**: Use `bun` or `pnpm` instead of `npm`. Prefer `bun` when the project already uses it.

## Cursor Cloud specific instructions

MelonScout-BE is a Bun + Hono backend with PostgreSQL (Drizzle ORM). It scrapes hot search data from Chinese platforms, runs AI fact-check analysis, and serves a REST API.

### Services

| Service | How to start | Port |
|---------|-------------|------|
| PostgreSQL | `sudo docker run -d --name melonscout-pg -e POSTGRES_DB=hot_search_db -e POSTGRES_PASSWORD=melonscout_dev -p 5432:5432 postgres:15-alpine` | 5432 |
| Backend (dev) | `bun run dev` | 3000 |

- PostgreSQL must be running before the backend starts.
- After starting Postgres for the first time, run `bun run db:push && bun run db:seed`.
- The dev server (`bun run dev`) uses `--watch` for hot reload.

### Commands

See `package.json` scripts for the full list. Key commands:
- **Lint**: `bun run lint` (TypeScript `tsc --noEmit`)
- **Test**: `bun test`
- **DB push**: `bun run db:push` / **DB seed**: `bun run db:seed`

### Scraper Sources

Set `SCRAPER_SOURCE` in `.env`:
- `placeholder` — mock data, no network needed (default for dev)
- `tianapi` — live Weibo data from 天行数据 API (needs `TIANAPI_API_KEY`)
- `cheerio` — self-built Weibo HTML scraper

### AI Providers

Set `AI_PROVIDER` in `.env`:
- `google` — Gemini 2.0 Flash (needs `GOOGLE_AI_API_KEY`)
- `openai` — GPT-4o-mini (needs `OPENAI_API_KEY`)
- `deepseek` — DeepSeek-V3 (needs `DEEPSEEK_API_KEY`)
- `minimax` — MiniMax-M2.5 (needs `MINIMAX_API_KEY`)
- Falls back to keyword-based mock if no API key is set.

### Caveats

- Docker daemon inside Cloud Agent VMs needs `fuse-overlayfs` and `iptables-legacy`.
- `drizzle.config.ts` is excluded from `tsconfig.json` include (sits outside rootDir). Drizzle Kit invokes it separately.
- The `ANALYSIS_TOP_N` setting (default 10) limits Phase 1 triage to top-N titles per batch.
- `DEEP_ANALYSIS_MAX` (default 5) caps Phase 2 fact-checks per batch to save AI tokens.
- cheerio/tianapi scrapers require external network. Use `placeholder` source in sandboxed environments.
