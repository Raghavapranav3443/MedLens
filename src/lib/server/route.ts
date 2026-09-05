// Route-handler wrapper: uniform error envelope + same-origin check on
// mutating routes. Handlers throw AppError; this converts to the envelope.

import { AppError, toErrorResponse } from "./errors";

type Handler = (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

/**
 * Mutating requests must be same-origin (CSRF posture: SameSite=Lax cookie +
 * origin check; no cross-site form posts). Requests without an Origin header
 * (curl, same-origin fetch in some browsers) pass — session auth still guards.
 */
function checkOrigin(req: Request): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("host");
  try {
    const o = new URL(origin);
    if (host && o.host !== host) {
      throw new AppError("unauthenticated", "Cross-origin request rejected.");
    }
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError("unauthenticated", "Invalid Origin header.");
  }
}

export function withRoute(handler: Handler): Handler {
  return async (req, ctx) => {
    try {
      checkOrigin(req);
      return await handler(req, ctx);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}
