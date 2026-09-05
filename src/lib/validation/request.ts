// Shared Zod schemas for request payloads (docs/ARCHITECTURE.md §5).
// Zod sits at every boundary: route bodies, AI output, intake forms.

import { z } from "zod";

export const AGE_MAX = 120;

export const intakeSymptomSchema = z.object({
  text: z.string().trim().min(1).max(300),
  onset: z.string().trim().max(120).optional(),
  frequency: z.string().trim().max(120).optional(),
  severity: z.number().int().min(1).max(10).optional(),
});

export const intakeMedicationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  dose: z.string().trim().max(120).optional(),
  frequency: z.string().trim().max(120).optional(),
});

export const intakeAllergySchema = z.object({
  substance: z.string().trim().min(1).max(200),
  reaction: z.string().trim().max(200).optional(),
  severity: z.string().trim().max(60).optional(),
});

export const intakeSchema = z.object({
  title: z.string().trim().min(1).max(200),
  alias: z.string().trim().max(120).optional(),
  age: z.number().int().min(0).max(AGE_MAX).optional(),
  sex: z.enum(["female", "male", "other", "unknown"]).optional(),
  symptoms: z.array(intakeSymptomSchema).max(50).optional(),
  conditions: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
  allergies: z.array(intakeAllergySchema).max(50).optional(),
  medications: z.array(intakeMedicationSchema).max(50).optional(),
  notes: z.string().trim().max(5000).optional(),
  noKnownAllergies: z.boolean().optional(),
});

export type IntakeInput = z.infer<typeof intakeSchema>;

export const createRecordSchema = intakeSchema;

export const addSourceSchema = z.object({
  kind: z.literal("pasted_text"),
  text: z.string().min(1).max(40_000),
  reportedAt: z.string().datetime({ offset: true }).optional(),
});

export const patchRecordSchema = z.object({
  expectedRevision: z.number().int().min(0),
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["draft", "reviewed"]).optional(),
  factUpdates: z
    .array(
      z.object({
        factId: z.string().min(1).max(64),
        review: z.enum(["confirmed", "corrected", "flagged"]).optional(),
        value: z.string().trim().max(200).optional(),
        unit: z.string().trim().max(40).optional(),
      }),
    )
    .max(200)
    .optional(),
});

export const recordIdSchema = z.string().cuid();
export const factIdSchema = z.string().cuid();

/** ZodError → { field: message } for the error envelope's fieldErrors. */
export function flattenZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

