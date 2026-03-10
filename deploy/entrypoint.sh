#!/bin/sh
set -e

echo "🔄 Running database migrations..."
bunx drizzle-kit push --force
echo "🌱 Seeding platforms..."
bun run src/db/seed.ts
echo "🚀 Starting server..."
exec bun run src/index.ts
