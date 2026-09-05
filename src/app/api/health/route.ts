// Liveness + config sanity + DB connectivity; zero PHI (docs/ARCHITECTURE.md §5).
// Always returns HTTP 200 so Cloud Run liveness probes never restart the instance
// during a Neon cold start — component status is reported in the body instead.

import { prisma } from "@/lib/server/db";

export async function GET() {
  const hasDb = Boolean(process.env.DATABASE_URL);
  const hasAi = Boolean(process.env.GROQ_API_KEY) && Boolean(process.env.GROQ_MODEL);

  let database: "connected" | "configured" | "missing" = "missing";
  if (hasDb) {
    database = "configured";
    try {
      await prisma.$queryRaw`SELECT 1`;
      database = "connected";
    } catch {
      database = "configured"; // env set but DB unreachable right now
    }
  }

  return Response.json({
    status: "ok",
    service: "medlens",
    config: {
      database,
      ai: hasAi ? "configured" : "missing",
      model: process.env.GROQ_MODEL ?? null,
    },
    time: new Date().toISOString(),
  });
}
