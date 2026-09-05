# Cloud Run (free tier) multi-stage build for MedLens.
# Stage 1: install deps (incl. Prisma CLI) so we can generate the client.
FROM node:22-slim AS deps
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npm cache clean --force

# Stage 2: build the Next.js standalone output + generate Prisma client.
FROM node:22-slim AS builder
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 3: minimal runtime image. Non-root, openssl for the Prisma engine.
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=8080
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Standalone server + static assets.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Prisma engine binaries (Next's file tracing can miss these on slim images).
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Cloud Run injects PORT (default 8080); Next standalone respects it.
EXPOSE 8080
USER node
CMD ["node", "server.js"]
