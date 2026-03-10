# MelonScout-BE 🍉🔍

Backend of MelonScout (瓜田侦探) — a hot search clickbait detection service.

## Architecture

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Scraper    │───▸│  PostgreSQL  │◂───│   Hono API   │◂───│   Frontend   │
│  (Cron 15m)  │    │  (Drizzle)   │    │   (REST)     │    │              │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
       │                   ▲
       ▼                   │
┌──────────────┐           │
│  AI Agent    │───────────┘
│ (Clickbait)  │
└──────────────┘
```

- **Scraper**: Fetches hot searches from platforms (vvhan API / cheerio / placeholder)
- **AI Agent**: Analyzes titles for clickbait using DeepSeek / OpenAI / Google Gemini
- **PostgreSQL + Drizzle**: Type-safe storage for hot searches and AI analysis
- **Hono API**: REST endpoints for the frontend

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Framework**: [Hono](https://hono.dev/)
- **Database**: PostgreSQL + [Drizzle ORM](https://orm.drizzle.team/)
- **AI**: DeepSeek-V3 / OpenAI GPT-4o-mini / Google Gemini
- **Scraping**: [vvhan API](https://api.vvhan.com) / [cheerio](https://cheerio.js.org/) / placeholder mock
- **Scheduling**: node-cron

## Quick Start

```bash
# Install dependencies
bun install

# Start PostgreSQL (Docker)
docker run -d --name melonscout-pg \
  -e POSTGRES_DB=hot_search_db \
  -e POSTGRES_PASSWORD=melonscout_dev \
  -p 5432:5432 postgres:15-alpine

# Configure environment
cp .env.example .env
# Edit .env — set API keys, scraper source, etc.

# Push database schema & seed platforms
bun run db:push
bun run db:seed

# Start dev server (with hot reload)
bun run dev
```

## API Reference

See **[API.md](./API.md)** for full API documentation with request parameters and response schemas.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/platforms` | List all platforms |
| GET | `/api/hot-searches` | List hot searches with AI analysis |
| GET | `/api/hot-searches/:id` | Single hot search with full analysis |
| GET | `/api/weibo-hot` | Fetch live Weibo hot searches (tianapi) |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `AI_PROVIDER` | `google` | `google` / `openai` / `deepseek` |
| `GOOGLE_AI_API_KEY` | — | Gemini API key |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `DEEPSEEK_API_KEY` | — | DeepSeek API key |
| `SCRAPER_SOURCE` | `vvhan` | `vvhan` / `cheerio` / `placeholder` |
| `ANALYSIS_TOP_N` | `10` | Only AI-analyze top N + keyword-matching titles (0 = all) |
| `PORT` | `3000` | Server port |
| `CRON_SCHEDULE` | `*/15 * * * *` | Cron expression for scraping interval |

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Dev server with hot reload |
| `bun run start` | Production server |
| `bun run lint` | TypeScript type check |
| `bun test` | Run unit tests |
| `bun run db:push` | Push schema to database |
| `bun run db:generate` | Generate migration files |
| `bun run db:migrate` | Run migrations |
| `bun run db:seed` | Seed platform data |

## Cost Optimization

The AI analyzer uses smart filtering to save API costs:
1. Only titles with **rank ≤ ANALYSIS_TOP_N** are analyzed
2. Titles matching clickbait keywords (震惊, 竟然, 真相, etc.) are always analyzed regardless of rank
3. Other low-rank titles are skipped

## Docker Compose (Production)

```bash
docker compose up -d
```

## License

MIT
