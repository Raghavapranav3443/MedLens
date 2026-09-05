// POST /api/records/:id/summary — plan + render the summary.
// Phase-5 implements the AI plan call; the deterministic template rendering
// lands with it. Skeleton: validates session/ownership/quota, then 503s as
// ai_unavailable until the pipeline is wired.

import { requireSessionId } from "@/lib/server/session";
import { getRecordOrNotFound } from "@/lib/server/repo";
import { aiUnavailable } from "@/lib/server/errors";
import { withRoute } from "@/lib/server/route";
import { enforceAiRateLimit } from "@/lib/server/ratelimit";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withRoute(async (_req, ctx) => {
  const sessionId = await requireSessionId();
  const { id } = await (ctx as Ctx).params;
  await getRecordOrNotFound(sessionId, id);
  await enforceAiRateLimit(sessionId, "summary");

  // Not yet wired (Phase 5): structured plan call + server-owned templates.
  throw aiUnavailable("Summary generation is not wired yet. No data was sent anywhere.");
});
