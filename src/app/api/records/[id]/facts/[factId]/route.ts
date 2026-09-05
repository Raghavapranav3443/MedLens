// PATCH /api/records/:id/facts/:factId — review/correct one fact (401, 404, 409, 422).

import { z } from "zod";
import { requireSessionId } from "@/lib/server/session";
import { updateFactWithRevision } from "@/lib/server/repo";
import { validationError } from "@/lib/server/errors";
import { withRoute } from "@/lib/server/route";
import { flattenZod } from "@/lib/validation/request";

const bodySchema = z.object({
  expectedRevision: z.number().int().min(0),
  review: z.enum(["confirmed", "corrected", "flagged"]).optional(),
  value: z.string().trim().max(200).optional(),
  unit: z.string().trim().max(40).optional(),
});

type Ctx = { params: Promise<{ id: string; factId: string }> };

export const PATCH = withRoute(async (req, ctx) => {
  const sessionId = await requireSessionId();
  const { id, factId } = await (ctx as Ctx).params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    throw validationError("Invalid fact update.", flattenZod(parsed.error));
  }
  const { expectedRevision, ...data } = parsed.data;
  const fact = await updateFactWithRevision(sessionId, id, factId, expectedRevision, data);
  return Response.json({ fact });
});
