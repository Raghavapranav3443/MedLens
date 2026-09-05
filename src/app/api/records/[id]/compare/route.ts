// GET /api/records/:id/compare?previousId=:id — deterministic longitudinal
// comparison between two owner-scoped records (no AI). Incompatible units are
// reported honestly rather than silently compared (docs/PRD.md §4.14).

import { requireSessionId } from "@/lib/server/session";
import { getRecordOrNotFound } from "@/lib/server/repo";
import { validationError } from "@/lib/server/errors";
import { withRoute } from "@/lib/server/route";
import { compareFacts } from "@/lib/engines/compare";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withRoute(async (req, ctx) => {
  const sessionId = await requireSessionId();
  const { id } = await (ctx as Ctx).params;
  const previousId = new URL(req.url).searchParams.get("previousId") ?? "";
  if (previousId === id) {
    throw validationError("previousId must be a different record.");
  }

  const current = await getRecordOrNotFound(sessionId, id);
  const previous = await getRecordOrNotFound(sessionId, previousId);

  const comparisons = compareFacts(previous.facts, current.facts);
  return Response.json({
    current: { id: current.id, title: current.title, revision: current.revision },
    previous: { id: previous.id, title: previous.title, revision: previous.revision },
    comparisons,
  });
});