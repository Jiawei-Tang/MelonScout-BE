# MelonScout-BE 🍉

Backend of MelonScout (瓜田侦探) — a hot search clickbait detection service.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh/)
- **Framework**: [Hono](https://hono.dev/)
- **Database**: PostgreSQL + [Drizzle ORM](https://orm.drizzle.team/)
- **AI**: Google Generative AI (Gemini) / Mock fallback
- **Scheduling**: node-cron

## Quick Start

```bash
# Install dependencies
bun install

# Start PostgreSQL (Docker required)
docker run -d --name melonscout-pg \
  -e POSTGRES_DB=hot_search_db \
  -e POSTGRES_PASSWORD=melonscout_dev \
  -p 5432:5432 postgres:15-alpine

# Copy and edit environment variables
cp .env.example .env

# Push database schema
bun run db:push

# Seed platforms
bun run db:seed

# Start dev server (with hot reload)
bun run dev
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/platforms` | List all platforms |
| GET | `/api/hot-searches` | List hot searches (supports `?platformId=`, `?limit=`, `?offset=`) |
| GET | `/api/hot-searches/:id` | Single hot search with AI analysis |
| GET | `/api/analysis` | List AI analysis results |
| POST | `/api/analysis/trigger` | Trigger AI analysis for unanalyzed titles |
| POST | `/api/analysis/scrape` | Trigger scraping + AI analysis |

## Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server with hot reload |
| `bun run start` | Start production server |
| `bun run lint` | TypeScript type check |
| `bun test` | Run unit tests |
| `bun run db:push` | Push schema to database |
| `bun run db:generate` | Generate migration files |
| `bun run db:migrate` | Run migrations |
| `bun run db:seed` | Seed platform data |

## Docker Compose (Production)

```bash
docker compose up -d
```

## Environment Variables

See [`.env.example`](.env.example) for all available configuration.

## License

MIT
