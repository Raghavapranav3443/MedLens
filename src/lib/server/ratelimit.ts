// Per-session rate limiting on AI routes — in-database counters (no external
// cache dependency). Honest 429 with Retry-After; no hard call ceiling is
// claimed anywhere beyond this configured per-window limit.

import { prisma } from "./db";
import { rateLimited } from "./errors";

const WINDOW_SECONDS = 60;
/** Default per-session AI-route limit per window. Configurable via env. */
const LIMIT = Number(process.env.AI_RATE_LIMIT ?? 12);

function windowStart(): Date {
  return new Date(Math.floor(Date.now() / (WINDOW_SECONDS * 1000)) * WINDOW_SECONDS * 1000);
}

/**
 * Count one AI-route hit for the session; throw a typed 429 with Retry-After
 * when the per-window limit is exceeded.
 */
export async function enforceAiRateLimit(sessionId: string, route: string): Promise<void> {
  const ws = windowStart();
  const counter = await prisma.rateLimitCounter.upsert({
    where: {
      sessionId_route_windowStart: { sessionId, route, windowStart: ws },
    },
    create: { sessionId, route, windowStart: ws, count: 1 },
    update: { count: { increment: 1 } },
  });

  if (counter.count > LIMIT) {
    const windowEnd = ws.getTime() + WINDOW_SECONDS * 1000;
    throw rateLimited((windowEnd - Date.now()) / 1000);
  }
}

/**
 * General per-session rate limit for non-AI mutating routes (record creation,
 * updates). Separate, more generous window so legitimate use is never blocked.
 */
const MUTATION_WINDOW_SECONDS = 60;
const MUTATION_LIMIT = Number(process.env.MUTATION_RATE_LIMIT ?? 30);

export async function enforceRateLimit(sessionId: string, route: string): Promise<void> {
  const ws = new Date(Math.floor(Date.now() / (MUTATION_WINDOW_SECONDS * 1000)) * MUTATION_WINDOW_SECONDS * 1000);
  const counter = await prisma.rateLimitCounter.upsert({
    where: { sessionId_route_windowStart: { sessionId, route, windowStart: ws } },
    create: { sessionId, route, windowStart: ws, count: 1 },
    update: { count: { increment: 1 } },
  });
  if (counter.count > MUTATION_LIMIT) {
    const windowEnd = ws.getTime() + MUTATION_WINDOW_SECONDS * 1000;
    throw rateLimited((windowEnd - Date.now()) / 1000);
  }
}

