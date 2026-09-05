// Pure token helpers — no I/O here so they are unit-testable without Next.
// The cookie carries an opaque random token; the database stores only its
// SHA-256. This is access isolation, NOT identity verification.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "medlens_session";
/** 30 days, in seconds. */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** 256-bit opaque token, URL-safe. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Only the SHA-256 of the token is ever persisted. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant-time token-hash comparison (defense in depth). */
export function tokenHashesEqual(a: string, b: string): boolean {
  const ha = Buffer.from(a, "utf8");
  const hb = Buffer.from(b, "utf8");
  if (ha.length !== hb.length) return false;
  return timingSafeEqual(ha, hb);
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" || process.env.FORCE_SECURE_COOKIES === "1",
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
} as const;
