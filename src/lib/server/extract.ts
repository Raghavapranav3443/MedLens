// Extraction pipeline orchestration: cache check → masking → Groq extraction
// → Zod validation → evidence validation → transactional persist with
// write-time status derivation. Route handlers stay thin; DB access lives here
// behind the owner-scoped check done by the caller.

import { createHash } from "node:crypto";
import { prisma } from "./db";
import { notFound } from "./errors";
import { maskIdentifiers } from "@/lib/ingest/masking";
import { chatJson, groqModel } from "@/lib/ai/groq";
import { extractionSystem, extractionUser, PROMPT_VERSION } from "@/lib/ai/prompts";
import { extractionResponseSchema, type ExtractionRow } from "@/lib/validation/extraction";
import { verifyRow } from "./evidence";
import { computeStatus, parseRangeText } from "@/lib/engines/ranges";

function cacheKey(normalizedText: string): string {
  return createHash("sha256")
    .update(`${normalizedText}|${PROMPT_VERSION}|${groqModel()}`)
    .digest("hex");
}

export interface ExtractionOutcome {
  facts: Awaited<ReturnType<typeof persistExtraction>>["facts"];
  cacheHit: boolean;
  aiAttempts: number;
  quarantined: number;
}

/** Run the pipeline for one pasted source. Caller has already 401/404'd. */
export async function extractAndPersist(
  sessionId: string,
  recordId: string,
  input: { text: string; reportedAt?: Date },
): Promise<ExtractionOutcome> {
  const record = await prisma.record.findFirst({
    where: { id: recordId, sessionId },
    select: { id: true },
  });
  if (!record) throw notFound();

  const normalized = input.text.replace(/\r\n/g, "\n").trim();
  const key = cacheKey(normalized);
  const model = groqModel();

  let rows: ExtractionRow[];
  let cacheHit = false;
  let aiAttempts = 0;

  const cached = await prisma.extractionCache.findUnique({ where: { key } });
  if (cached) {
    rows = extractionResponseSchema.parse(JSON.parse(cached.payload)).rows;
    cacheHit = true;
  } else {
    const { masked } = maskIdentifiers(normalized);
    const { data, attempts } = await chatJson({
      system: extractionSystem,
      user: extractionUser(masked),
      json: true,
    });
    aiAttempts = attempts;
    const parsed = extractionResponseSchema.safeParse(data);
    rows = parsed.success ? parsed.data.rows : [];
    // Cache the VALIDATED raw response (even an empty row set) — same input,
    // same model, same prompt ⇒ 0 AI calls on re-upload.
    await prisma.extractionCache.create({
      data: { key, payload: JSON.stringify({ rows }), model, promptVersion: PROMPT_VERSION },
    });
  }

  const result = await persistExtraction(record.id, rows, {
    kind: "pasted_text",
    rawText: normalized,
    reportedAt: input.reportedAt ?? null,
  });

  return { ...result, cacheHit, aiAttempts, quarantined: result.facts.filter((f) => !f.verified).length };
}

async function persistExtraction(
  recordId: string,
  rows: ExtractionRow[],
  source: { kind: string; rawText: string; reportedAt: Date | null },
) {
  const sha256 = createHash("sha256").update(source.rawText).digest("hex");

  return prisma.$transaction(async (tx) => {
    const doc = await tx.sourceDocument.create({
      data: {
        recordId,
        kind: source.kind,
        rawText: source.rawText,
        sha256,
        reportedAt: source.reportedAt,
      },
    });

    const factRows = rows.map((row) => {
      const range = parseRangeText(row.rangeText || null);
      const { status } = computeStatus(row.value, range);
      return {
        recordId,
        sourceDocId: doc.id,
        kind: "lab",
        rawName: row.rawName,
        canonicalName: null as string | null, // alias resolver lands next; never guessed
        value: row.value,
        unit: row.unit || null,
        rangeText: row.rangeText || null,
        rangeLow: range?.type === "closed" ? range.low : null,
        rangeHigh: range?.type === "closed" ? range.high : null,
        status,
        evidenceStart: null as number | null,
        evidenceEnd: null as number | null,
        origin: "ai" as const,
        verified: false,
      };
    });

    // Evidence validation fills spans + verification before insert.
    for (const fact of factRows) {
      const row = rows[factRows.indexOf(fact)];
      const ev = verifyRow(source.rawText, row);
      fact.evidenceStart = ev.start;
      fact.evidenceEnd = ev.end;
      fact.verified = ev.verified;
    }

    await tx.fact.createMany({ data: factRows });

    await tx.auditEvent.create({
      data: {
        recordId,
        action: "extract",
        target: doc.id,
        after: `${factRows.length} rows extracted (${factRows.filter((f) => f.verified).length} verified)`,
      },
    });

    const record = await tx.record.update({
      where: { id: recordId },
      data: { revision: { increment: 1 } },
      include: { facts: { where: { sourceDocId: doc.id }, orderBy: { rawName: "asc" } } },
    });
    return { facts: record.facts, sourceDocId: doc.id };
  });
}
