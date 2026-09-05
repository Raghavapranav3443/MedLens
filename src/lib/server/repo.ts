// Owner-scoped repository — the ONLY module that queries the database for
// records. Every function takes `sessionId`, and cross-session reads are
// structurally impossible: the session id is part of every where-clause.
// Owner mismatch returns not_found — never reveal that a record exists for
// another session (docs/ARCHITECTURE.md §5).

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { conflict, notFound } from "./errors";
import type { IntakeInput } from "@/lib/validation/request";

const RECORD_INCLUDE = {
  facts: { orderBy: [{ kind: "asc" as const }, { rawName: "asc" as const }] },
  sources: { orderBy: { createdAt: "asc" as const } },
  audits: { orderBy: { createdAt: "desc" as const } },
  summaries: { orderBy: { createdAt: "desc" as const } },
} satisfies Prisma.RecordInclude;

export type FullRecord = Prisma.RecordGetPayload<{ include: typeof RECORD_INCLUDE }>;

/** Create a record from validated intake, stamping every fact origin: user. */
export async function createRecordFromIntake(sessionId: string, input: IntakeInput) {
  const factCreates: Prisma.FactCreateNestedManyWithoutRecordInput["create"] = [
    ...(input.symptoms ?? []).map((s) => ({
      kind: "symptom",
      rawName: s.text,
      value: s.onset ?? null,
      origin: "user",
      verified: true,
      review: "confirmed",
      meta: {
        ...(s.frequency !== undefined ? { frequency: s.frequency } : {}),
        ...(s.severity !== undefined ? { severity: s.severity } : {}),
      },
    })),
    ...(input.medications ?? []).map((m) => ({
      kind: "medication",
      rawName: m.name,
      value: m.dose ?? null,
      origin: "user",
      verified: true,
      review: "confirmed",
      meta: m.frequency !== undefined ? { frequency: m.frequency } : {},
    })),
    ...(input.allergies ?? []).map((a) => ({
      kind: "allergy",
      rawName: a.substance,
      value: a.reaction ?? null,
      origin: "user",
      verified: true,
      review: "confirmed",
      meta: a.severity !== undefined ? { severity: a.severity } : {},
    })),
    ...(input.conditions ?? []).map((c) => ({
      kind: "condition",
      rawName: c,
      origin: "user",
      verified: true,
      review: "confirmed",
    })),
    ...(input.notes
      ? [{
          kind: "note",
          rawName: input.notes.slice(0, 200),
          value: input.notes,
          origin: "user",
          verified: true,
          review: "confirmed",
        }]
      : []),
    ...(input.noKnownAllergies
      ? [{ kind: "note", rawName: "No known allergies", origin: "user", verified: true, review: "confirmed" }]
      : []),
  ];

  return prisma.record.create({
    data: {
      sessionId,
      title: input.title,
      facts: { create: factCreates },
      audits: {
        create: { action: "create", target: "record", after: input.title },
      },
    },
    include: { facts: true },
  });
}

/** Full record or typed 404. Owner mismatch is indistinguishable from absence. */
export async function getRecordOrNotFound(sessionId: string, recordId: string): Promise<FullRecord> {
  const record = await prisma.record.findFirst({
    where: { id: recordId, sessionId },
    include: RECORD_INCLUDE,
  });
  if (!record) throw notFound();
  return record;
}

/** Revision-checked update; a stale PATCH is a typed 409 with current revision. */
export async function patchRecordWithRevision(
  sessionId: string,
  recordId: string,
  expectedRevision: number,
  data: { title?: string; status?: "draft" | "reviewed" },
): Promise<FullRecord> {
  const owned = await prisma.record.findFirst({
    where: { id: recordId, sessionId },
    select: { id: true, revision: true },
  });
  if (!owned) throw notFound();
  if (owned.revision !== expectedRevision) {
    throw conflict("The record changed since you loaded it. Re-read and retry.", owned.revision);
  }
  return prisma.record.update({
    where: { id: owned.id },
    data: { ...data, revision: { increment: 1 } },
    include: RECORD_INCLUDE,
  });
}

/** Correct/confirm/flag a single fact + audit entry, revision-checked. */
export async function updateFactWithRevision(
  sessionId: string,
  recordId: string,
  factId: string,
  expectedRevision: number,
  data: { review?: string; value?: string; unit?: string },
) {
  const record = await prisma.record.findFirst({
    where: { id: recordId, sessionId },
    select: { id: true, revision: true },
  });
  if (!record) throw notFound();
  if (record.revision !== expectedRevision) {
    throw conflict("The record changed since you loaded it. Re-read and retry.", record.revision);
  }

  return prisma.$transaction(async (tx) => {
    const fact = await tx.fact.findFirst({ where: { id: factId, recordId: record.id } });
    if (!fact) throw notFound();

    const before = JSON.stringify({ value: fact.value, unit: fact.unit, review: fact.review });
    const after = JSON.stringify({
      value: data.value ?? fact.value,
      unit: data.unit ?? fact.unit,
      review: data.review ?? fact.review,
    });

    const updated = await tx.fact.update({
      where: { id: fact.id },
      data: {
        ...(data.review ? { review: data.review } : {}),
        ...(data.value !== undefined ? { value: data.value } : {}),
        ...(data.unit !== undefined ? { unit: data.unit } : {}),
        ...(data.value !== undefined ? { corrections: { increment: 1 }, verified: true } : {}),
      },
    });

    await tx.auditEvent.create({
      data: {
        recordId: record.id,
        action: data.review ?? "correct",
        target: fact.id,
        before,
        after,
      },
    });
    await tx.record.update({
      where: { id: record.id },
      data: { revision: { increment: 1 } },
    });
    return updated;
  });
}

/** Cascade delete — the right-to-delete endpoint. */
export async function deleteRecordOrNotFound(sessionId: string, recordId: string) {
  const owned = await prisma.record.findFirst({
    where: { id: recordId, sessionId },
    select: { id: true },
  });
  if (!owned) throw notFound();
  await prisma.record.delete({ where: { id: owned.id } });
  return { deleted: true };
}

export async function listRecords(sessionId: string) {
  return prisma.record.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    include: {
      facts: { select: { id: true, kind: true, status: true, verified: true, review: true } },
    },
  });
}

/** Append-only audit helper used by later phases (extract, summarize, …). */
export async function audit(
  recordId: string,
  action: string,
  target?: string,
  before?: string,
  after?: string,
) {
  return prisma.auditEvent.create({
    data: { recordId, action, target, before, after },
  });
}