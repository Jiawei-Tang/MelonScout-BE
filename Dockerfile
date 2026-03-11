FROM oven/bun:1-alpine AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS build
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .

FROM base AS release
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/package.json ./
COPY --from=build /app/drizzle.config.ts ./
COPY --from=build /app/melonscout.config.json ./
COPY --from=build /app/deploy/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000
CMD ["./entrypoint.sh"]
