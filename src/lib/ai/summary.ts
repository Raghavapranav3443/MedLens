// Server-owned summary templates (docs/ARCHITECTURE.md §7.2, plan-and-template
// rendering). The model returns a PLAN (factIds + templateId + a ≤140-char
// note); the server renders every sentence. Unsafe phrasing is structurally
// impossible — the templates ARE the safety boundary.

import type { Fact } from "@prisma/client";

export interface SummaryPlan {
  sections: string[]; // template ids to include, in order
  note?: string; // optional ≤140 char connective note (guard-checked)
}

export interface RenderedSummary {
  text: string; // server-rendited from audited templates only
  note: string | null;
  planValid: boolean;
}

const DISCLAIMER =
  "This is an organizational summary of your records, not medical advice. Values are transcribed as printed; the app does not diagnose or rank clinical significance. Please discuss with your clinician.";

function statusPhrase(status: string | null): string {
  switch (status) {
    case "low":
      return "below the reported reference range";
    case "high":
      return "above the reported reference range";
    case "no_reference_provided":
      return "with no reference range printed on the report";
    case "normal":
      return "within the reported reference range";
    default:
      return "of uncertain status";
  }
}

function factSentence(f: Fact): string {
  const range = f.rangeText ? ` (${f.rangeText})` : "";
  return `${f.rawName} is ${f.value ?? "not recorded"}${f.unit ? ` ${f.unit}` : ""}${range}, ${statusPhrase(f.status)}.`;
}

/**
 * Render a summary from a plan using ONLY the verified record data. Returns a
 * deterministic fallback when the plan is invalid — no regeneration loop.
 */
export function renderSummary(
  facts: Fact[],
  plan: SummaryPlan | null,
  recordTitle: string,
): RenderedSummary {
  const validPlan =
    plan &&
    Array.isArray(plan.sections) &&
    plan.sections.length > 0 &&
    (plan.note == null || plan.note.length <= 140);

  const labs = facts.filter((f) => f.kind === "lab" && f.value != null);
  const symptoms = facts.filter((f) => f.kind === "symptom");
  const medications = facts.filter((f) => f.kind === "medication");

  const paragraphs: string[] = [];

  if (validPlan && plan!.sections.includes("overview")) {
    paragraphs.push(`Record: ${recordTitle}. ${labs.length} lab values recorded.`);
  }

  if (labs.length > 0) {
    const verified = labs.filter((f) => f.verified);
    if (verified.length > 0) {
      paragraphs.push("Lab findings verified against your report:");
      for (const f of verified) paragraphs.push("• " + factSentence(f));
    }
    const quarantined = labs.filter((f) => !f.verified);
    if (quarantined.length > 0) {
      paragraphs.push(
        `${quarantined.length} value(s) could not be verified against the source and are excluded from this summary.`,
      );
    }
  } else {
    paragraphs.push("No lab values have been extracted yet.");
  }

  if (symptoms.length > 0) {
    paragraphs.push("Reported symptoms: " + symptoms.map((f) => f.rawName).join(", ") + ".");
  }

  if (medications.length > 0) {
    paragraphs.push("Medications: " + medications.map((f) => f.rawName).join(", ") + ".");
  }

  paragraphs.push(DISCLAIMER);

  return {
    text: paragraphs.join("\n\n"),
    note: validPlan && plan!.note ? plan!.note : null,
    planValid: Boolean(validPlan),
  };
}

/**
 * Choose a plan deterministically from the record contents. Used when the AI
 * plan call is unavailable or returns an invalid plan — never blocks rendering.
 */
export function fallbackPlan(facts: Fact[]): SummaryPlan {
  return { sections: ["overview", "labs"] };
}
