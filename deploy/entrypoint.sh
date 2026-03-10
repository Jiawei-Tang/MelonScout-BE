#!/bin/sh
set -e

echo "🌱 Seeding platforms (idempotent)..."
bun run src/db/seed.ts
echo "🚀 Starting server..."
exec bun run src/index.ts
