# AGENTS.md

## Cursor Cloud specific instructions

MelonScout-BE is a Bun + Hono backend with PostgreSQL (Drizzle ORM). It scrapes hot search data, runs AI clickbait detection, and serves a REST API.

### Services

| Service | How to start | Port |
|---------|-------------|------|
| PostgreSQL | `sudo docker run -d --name melonscout-pg -e POSTGRES_DB=hot_search_db -e POSTGRES_PASSWORD=melonscout_dev -p 5432:5432 postgres:15-alpine` | 5432 |
| Backend (dev) | `bun run dev` | 3000 |

- PostgreSQL must be running before the backend starts.
- After starting Postgres for the first time, run `bun run db:push && bun run db:seed`.
- The dev server (`bun run dev`) uses `--watch` for hot reload.

### Commands

- **Lint**: `bun run lint` (TypeScript `tsc --noEmit`)
- **Test**: `bun test`
- **DB push**: `bun run db:push`
- **DB seed**: `bun run db:seed`

### Caveats

- Without `GOOGLE_AI_API_KEY`, the AI module falls back to a keyword-based mock provider. Set the key in `.env` to use real Gemini analysis.
- The scraper module currently uses a `PlaceholderScraper` returning mock data. Real scrapers should implement the `ScraperSource` interface in `src/scraper/types.ts`.
- Docker daemon inside Cloud Agent VMs needs `fuse-overlayfs` and `iptables-legacy` (see setup docs).
- `drizzle.config.ts` is excluded from `tsconfig.json` `include` (it sits outside `rootDir`). Drizzle Kit invokes it separately.
