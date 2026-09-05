import { writeFileSync } from "node:fs";
const content = String.raw`// Extraction pipeline orchestration: cache check → masking → Groq extraction
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
import { resolveAlias } from "@/lib/engines/aliases";
import { regexExtract } from "@/lib/engines/regex";

function cacheKey(normalizedText: string): string {
  return createHash("sha256")
    .update(\`\${normalizedText}|\${PROMPT_VERSION}|\${groqModel()}\`)
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

  const normalized = input.text.replace(/\\r\\n/g, "\\n").trim();
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
    try {
      const { masked } = maskIdentifiers(normalized);
      const { data, attempts } = await chatJson({
        system: extractionSystem,
        user: extractionUser(masked),
        json: true,
      });
      aiAttempts = attempts;
      const parsed = extractionResponseSchema.safeParse(data);
      rows = parsed.success ? parsed.data.rows : [];
      await prisma.extractionCache.create({
        data: { key, payload: JSON.stringify({ rows }), model, promptVersion: PROMPT_VERSION },
      });
    } catch (err) {
      // Degraded mode: AI unavailable → regex fallback, rows quarantined.
      console.warn(\`[extract] AI unavailable (\${err instanceof Error ? err.message : err}); using regex fallback.\`);
      rows = regexExtract(normalized).map((r) => ({
        rawName: r.rawName,
        value: r.value,
        unit: r.unit,
        rangeText: r.rangeText,
      }));
      aiAttempts = 0;
    }
  }

  const result = await persistExtraction(record.id, rows, {
    kind: "pasted_text",
    rawText: normalized,
    reportedAt: input.reportedAt ?? null,
  });

  return { ...result, cacheHit, aiAttempts, quarantined: result.facts.filter((f) => !f.verified).length };
}
`;
writeFileSync("src/lib/server/extract.ts", content);
console.log("extract part1");
