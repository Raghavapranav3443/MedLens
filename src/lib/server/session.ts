// Cookie-bound session lifecycle (Next.js server side).
// Opaque random token in an HttpOnly cookie; only its SHA-256 is persisted.
// This is access isolation, NOT identity verification.

import { cookies } from "next/headers";
import { prisma } from "./db";
import { unauthenticated } from "./errors";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  generateToken,
  hashToken,
  sessionCookieOptions,
} from "./tokens";

/** Resolve the current session from the cookie. Returns null when absent/unknown. */
export async function getSessionId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const id = hashToken(token);
  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) return null;
  // 30-day sliding window.
  await prisma.session.update({ where: { id }, data: { lastSeenAt: new Date() } });
  return id;
}

/** Require a session or throw the typed 401. */
export async function requireSessionId(): Promise<string> {
  const id = await getSessionId();
  if (!id) throw unauthenticated();
  return id;
}

/** Get or create the anonymous session and set the cookie. */
export async function getOrCreateSessionId(): Promise<string> {
  const existing = await getSessionId();
  if (existing) return existing;

  const token = generateToken();
  const id = hashToken(token);
  await prisma.session.create({ data: { id } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    ...sessionCookieOptions,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return id;
}

/** Delete the session row (cascades all its records) and clear the cookie. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const id = hashToken(token);
    await prisma.session.deleteMany({ where: { id } });
  }
  jar.delete(SESSION_COOKIE);
}

