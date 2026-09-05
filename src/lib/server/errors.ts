// Typed error envelope — the only error shape any route returns.
// Codes per docs/ARCHITECTURE.md §5.

export type ErrorCode =
  | "unauthenticated"
  | "not_found"
  | "conflict"
  | "payload_too_large"
  | "validation_error"
  | "rate_limited"
  | "ai_unavailable";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  unauthenticated: 401,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  validation_error: 422,
  rate_limited: 429,
  ai_unavailable: 503,
};

export interface FieldErrors {
  [field: string]: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: FieldErrors;
  /** Extra headers, e.g. Retry-After on 429. */
  readonly headers?: Record<string, string>;
  /** Owner mismatch returns not_found — never reveal existence. */
  readonly meta?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    opts?: {
      fieldErrors?: FieldErrors;
      headers?: Record<string, string>;
      meta?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = opts?.fieldErrors;
    this.headers = opts?.headers;
    this.meta = opts?.meta;
  }

  get status(): number {
    return STATUS_BY_CODE[this.code];
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.fieldErrors ? { fieldErrors: this.fieldErrors } : {}),
      },
    };
  }
}

export const unauthenticated = (msg = "No valid session. Open the app to start a session.") =>
  new AppError("unauthenticated", msg);

export const notFound = (msg = "Record not found.") => new AppError("not_found", msg);

export const conflict = (
  msg: string,
  currentRevision: number,
): AppError =>
  new AppError("conflict", msg, { meta: { currentRevision } });

export const payloadTooLarge = (msg: string) => new AppError("payload_too_large", msg);

export const validationError = (msg: string, fieldErrors?: FieldErrors) =>
  new AppError("validation_error", msg, { fieldErrors });

export const rateLimited = (retryAfterSeconds: number) =>
  new AppError("rate_limited", "Too many AI requests for this session. Try again shortly.", {
    headers: { "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))) },
  });

export const aiUnavailable = (msg = "The AI provider is unavailable. Nothing was saved from this attempt.") =>
  new AppError("ai_unavailable", msg);

/** Uniform JSON response for an AppError. */
export function errorResponse(err: AppError): Response {
  return Response.json(err.toJSON(), {
    status: err.status,
    headers: err.headers,
  });
}

/** Convert any thrown value into the envelope (never leaks internals). */
export function toErrorResponse(err: unknown): Response {
  if (err instanceof AppError) return errorResponse(err);
  console.error("[unhandled]", err instanceof Error ? err.message : err);
  return Response.json(
    { error: { code: "ai_unavailable", message: "Unexpected server error." } },
    { status: 503 },
  );
}
