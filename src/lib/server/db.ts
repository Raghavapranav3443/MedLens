// Prisma client singleton (dev hot-reload safe).
// Instantiation is lazy-safe; queries without a configured DATABASE_URL fail
// per-query and surface as a typed 503 through the route error envelope.

import { PrismaClient } from "@prisma/client";

declare global {
  // Singleton cache across dev hot-reloads; undefined in production.
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

