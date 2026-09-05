// POST /api/records/:id/sources — add pasted text and run the extraction
// pipeline. Failure modes: 401, 404, 413, 422, 429, 503.
// Caps are enforced BEFORE parsing or any AI call.

import { requireSessionId } from "@/lib/server/session";
import { getRecordOrNotFound } from "@/lib/server/repo";
import { payloadTooLarge, validationError } from "@/lib/server/errors";
import { withRoute } from "@/lib/server/route";
import { enforceAiRateLimit } from "@/lib/server/ratelimit";
import { addSourceSchema, flattenZod } from "@/lib/validation/request";
import { MAX_SOURCE_CHARS } from "@/lib/ingest/limits";
import { extractAndPersist } from "@/lib/server/extract";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withRoute(async (req, ctx) => {
  const sessionId = await requireSessionId();
  const { id } = await (ctx as Ctx).params;
  await getRecordOrNotFound(sessionId, id);
  await enforceAiRateLimit(sessionId, "sources");

  // Cap the body size before buffering without bound.
  const body = await req.text();
  if (body.length > MAX_SOURCE_CHARS + 2048) {
    throw payloadTooLarge(`Report text exceeds ${MAX_SOURCE_CHARS} characters.`);
  }

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw validationError("Body must be JSON.");
  }
  const parsed = addSourceSchema.safeParse(json);
  if (!parsed.success) {
    throw validationError("Invalid source payload.", flattenZod(parsed.error));
  }

  const outcome = await extractAndPersist(sessionId, id, {
    text: parsed.data.text,
    ...(parsed.data.reportedAt ? { reportedAt: new Date(parsed.data.reportedAt) } : {}),
  });

  return Response.json(
    {
      sourceDocId: outcome.facts[0]?.sourceDocId ?? null,
      rowCount: outcome.facts.length,
      verifiedCount: outcome.facts.length - outcome.quarantined,
      quarantined: outcome.quarantined,
      cacheHit: outcome.cacheHit,
      aiAttempts: outcome.aiAttempts,
      facts: outcome.facts,
    },
    { status: 201 },
  );
});

