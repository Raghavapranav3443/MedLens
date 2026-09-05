// Zod schema for the AI extraction response. AI output is untrusted until it
// passes this schema — malformed rows are dropped from consideration and the
// whole response fails closed to the degraded path.

import { z } from "zod";

export const extractionRowSchema = z.object({
  rawName: z.string().trim().min(1).max(200),
  value: z.string().trim().max(200),
  unit: z.string().trim().max(40).optional().default(""),
  rangeText: z.string().trim().max(200).optional().default(""),
  sourceLine: z.string().trim().min(1).max(500),
});

export const extractionResponseSchema = z.object({
  rows: z.array(extractionRowSchema).max(100).optional().default([]),
});

export type ExtractionRow = z.infer<typeof extractionRowSchema>;

// Summary plan: model returns sections + an optional bounded note.
export const summaryPlanSchema = z.object({
  sections: z.array(z.enum(["overview", "labs", "symptoms", "medications"])).max(6).optional().default(["overview", "labs"]),
  note: z.string().max(140).optional(),
});

