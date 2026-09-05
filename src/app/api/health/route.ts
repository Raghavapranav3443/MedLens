// Liveness + config sanity; zero PHI (docs/ARCHITECTURE.md §5).

export async function GET() {
  const hasDb = Boolean(process.env.DATABASE_URL);
  const hasAi = Boolean(process.env.GEMINI_API_KEY) && Boolean(process.env.GEMINI_MODEL);
  return Response.json({
    status: "ok",
    service: "medlens",
    config: {
      database: hasDb ? "configured" : "missing",
      ai: hasAi ? "configured" : "missing",
    },
    time: new Date().toISOString(),
  });
}
