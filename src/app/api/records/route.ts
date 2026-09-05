// POST /api/records — create a record from a JSON intake payload (401, 422).
// GET  /api/records — list this session's records.

import { getOrCreateSessionId } from "@/lib/server/session";
import { createRecordFromIntake, listRecords } from "@/lib/server/repo";
import { validationError } from "@/lib/server/errors";
import { withRoute } from "@/lib/server/route";
import { createRecordSchema, flattenZod } from "@/lib/validation/request";

export const POST = withRoute(async (req) => {
  const sessionId = await getOrCreateSessionId();
  const parsed = createRecordSchema.safeParse(await req.json());
  if (!parsed.success) {
    throw validationError("Invalid intake payload.", flattenZod(parsed.error));
  }
  const record = await createRecordFromIntake(sessionId, parsed.data);
  return Response.json({ record }, { status: 201 });
});

export const GET = withRoute(async () => {
  const sessionId = await getOrCreateSessionId();
  const records = await listRecords(sessionId);
  return Response.json({ records });
});
