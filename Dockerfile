# Production image: SQLite DB on a mounted volume (path via DATABASE_URL or PB_DATA_DIR).
FROM node:20-bookworm-slim AS base
WORKDIR /app
# gosu: drop root after fixing named-volume permissions on /app/data (see docker-entrypoint.sh)
RUN apt-get update -y && apt-get install -y openssl ca-certificates gosu && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

COPY package.json package-lock.json* ./
COPY --from=builder /app/prisma ./prisma
RUN npm ci --omit=dev && npm install prisma tsx

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Run as non-root (official node image includes user `node`, uid 1000).
RUN mkdir -p /app/data \
  && chown -R node:node /app \
  && chown node:node /docker-entrypoint.sh

# Entrypoint starts as root, chowns mounted volume, then gosu → node (see docker-entrypoint.sh).

EXPOSE 3000
ENV PORT=3000
ENTRYPOINT ["/docker-entrypoint.sh"]
