// POST /api/records/:id/sources — add pasted text (PDF path lands in Phase 2).
// Failure modes: 401, 404, 413, 422, 429. Caps are enforced BEFORE anything else.

import { requireSessionId } from "@/lib/server/session";
import { getRecordOrNotFound } from "@/lib/server/repo";
import { payloadTooLarge, validationError } from "@/lib/server/errors";
import { withRoute } from "@/lib/server/route";
import { enforceAiRateLimit } from "@/lib/server/ratelimit";
import { addSourceSchema } from "@/lib/validation/request";
import { MAX_SOURCE_CHARS } from "@/lib/ingest/limits";
import { flattenZod } from "@/lib/validation/request";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withRoute(async (req, ctx) => {
  const sessionId = await requireSessionId();
  const { id } = await (ctx as Ctx).params;
  await getRecordOrNotFound(sessionId, id);
  await enforceAiRateLimit(sessionId, "sources");

  // Cap the body size before buffering without bound (doc'd: 40,000 chars).
  const text = await req.text();
  if (text.length > MAX_SOURCE_CHARS + 2048) {
    throw payloadTooLarge(`Report text exceeds ${MAX_SOURCE_CHARS} characters.`);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw validationError("Body must be JSON.");
  }
  const parsed = addSourceSchema.safeParse(json);
  if (!parsed.success) {
    throw validationError("Invalid source payload.", flattenZod(parsed.error));
  }

  // Phase 2 will run: masking → extraction (cache/AI) → evidence validation →
  // transaction persist. The skeleton validates + acknowledges for now.
  return Response.json({ received: true, kind: parsed.data.kind }, { status: 202 });
});
