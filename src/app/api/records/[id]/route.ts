// GET / PATCH / DELETE /api/records/:id — owner-scoped (401, 404, 409, 422).

import { requireSessionId } from "@/lib/server/session";
import {
  deleteRecordOrNotFound,
  getRecordOrNotFound,
  patchRecordWithRevision,
} from "@/lib/server/repo";
import { validationError } from "@/lib/server/errors";
import { withRoute } from "@/lib/server/route";
import { flattenZod, patchRecordSchema } from "@/lib/validation/request";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withRoute(async (_req, ctx) => {
  const sessionId = await requireSessionId();
  const { id } = await (ctx as Ctx).params;
  const record = await getRecordOrNotFound(sessionId, id);
  return Response.json({ record });
});

export const PATCH = withRoute(async (req, ctx) => {
  const sessionId = await requireSessionId();
  const { id } = await (ctx as Ctx).params;
  const parsed = patchRecordSchema.safeParse(await req.json());
  if (!parsed.success) {
    throw validationError("Invalid patch payload.", flattenZod(parsed.error));
  }
  const { expectedRevision, title, status } = parsed.data;
  const record = await patchRecordWithRevision(sessionId, id, expectedRevision, {
    ...(title !== undefined ? { title } : {}),
    ...(status !== undefined ? { status } : {}),
  });
  return Response.json({ record });
});

export const DELETE = withRoute(async (_req, ctx) => {
  const sessionId = await requireSessionId();
  const { id } = await (ctx as Ctx).params;
  const result = await deleteRecordOrNotFound(sessionId, id);
  return Response.json(result);
});
