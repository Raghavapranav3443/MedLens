// POST /api/records/:id/sources — add a report (pasted text JSON or text-layer
// PDF multipart) and run the extraction pipeline.
// Failure modes: 401, 404, 413, 422, 429, 503. Caps are enforced BEFORE any AI call.

import { requireSessionId } from "@/lib/server/session";
import { getRecordOrNotFound } from "@/lib/server/repo";
import { payloadTooLarge, validationError } from "@/lib/server/errors";
import { withRoute } from "@/lib/server/route";
import { enforceAiRateLimit } from "@/lib/server/ratelimit";
import { addSourceSchema, flattenZod } from "@/lib/validation/request";
import { MAX_SOURCE_CHARS, MAX_PDF_PAGES, MAX_SOURCE_BYTES } from "@/lib/ingest/limits";
import { extractAndPersist } from "@/lib/server/extract";

type Ctx = { params: Promise<{ id: string }> };

/** Extract text from a text-layer PDF; typed errors for caps and scans. */
async function pdfToText(file: File): Promise<string> {
  if (file.size > MAX_SOURCE_BYTES) {
    throw payloadTooLarge("PDF exceeds the 5 MiB limit.");
  }
  const buf = new Uint8Array(await file.arrayBuffer());
  const { getDocumentProxy, extractText } = await import("unpdf");
  let pdf, totalPages, text;
  try {
    pdf = await getDocumentProxy(buf);
    ({ totalPages, text } = await extractText(pdf, { mergePages: true }));
  } catch {
    throw validationError("This PDF could not be parsed. If it is a scan (no text layer), paste the report text instead.");
  }
  if (totalPages > MAX_PDF_PAGES) {
    throw validationError(`PDF has ${totalPages} pages; the limit is ${MAX_PDF_PAGES}.`);
  }
  const merged = (Array.isArray(text) ? text.join("\n") : text).replace(/\r\n/g, "\n").trim();
  if (!merged) {
    throw validationError("No text layer found in this PDF. If it is a scan, paste the report text instead.");
  }
  if (merged.length > MAX_SOURCE_CHARS) {
    throw payloadTooLarge(`Report text exceeds ${MAX_SOURCE_CHARS} characters.`);
  }
  return merged;
}

export const POST = withRoute(async (req, ctx) => {
  const sessionId = await requireSessionId();
  const { id } = await (ctx as Ctx).params;
  await getRecordOrNotFound(sessionId, id);
  await enforceAiRateLimit(sessionId, "sources");

  const contentType = req.headers.get("content-type") ?? "";
  let text: string;
  let kind: "pasted_text" | "pdf";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw validationError("Missing file field.");
    if (file.type && file.type !== "application/pdf") {
      throw validationError("Only PDF files are accepted.");
    }
    text = await pdfToText(file);
    kind = "pdf";
  } else {
    // Cap the body size before buffering without bound.
    const body = await req.text();
    if (body.length > MAX_SOURCE_CHARS + 2048) {
      throw payloadTooLarge(`Report text exceeds ${MAX_SOURCE_CHARS} characters.`);
    }
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw validationError("Body must be JSON or multipart/form-data with a PDF.");
    }
    const parsed = addSourceSchema.safeParse(json);
    if (!parsed.success) {
      throw validationError("Invalid source payload.", flattenZod(parsed.error));
    }
    text = parsed.data.text;
    kind = "pasted_text";
  }

  const outcome = await extractAndPersist(sessionId, id, { text });

  return Response.json(
    {
      sourceDocId: outcome.facts[0]?.sourceDocId ?? null,
      kind,
      rowCount: outcome.facts.length,
      verifiedCount: outcome.facts.length - outcome.quarantined,
      quarantined: outcome.quarantined,
      cacheHit: outcome.cacheHit,
      aiAttempts: outcome.aiAttempts,
      facts: outcome.facts,
    },
    { status: 201 },
  );
});

