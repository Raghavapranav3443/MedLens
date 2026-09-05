// DELETE /api/session — right to delete: clears the session's whole data set
// (records, facts, sources, audits cascade) and the cookie.

import { destroySession } from "@/lib/server/session";
import { withRoute } from "@/lib/server/route";

export const DELETE = withRoute(async () => {
  await destroySession();
  return Response.json({ deleted: true });
});
