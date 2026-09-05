// Clarification-gap analysis (docs/PRD.md §4.11). Questions derived from the
// structured record, each with its trigger citation. Max 5, prioritized.
// PURE, unit-tested, zero AI.

import type { Fact } from "@prisma/client";

export interface Gap {
  id: string;
  question: string;
  trigger: string; // citation of what triggered this question
  priority: number; // lower = higher priority
}

export function detectGaps(facts: Fact[]): Gap[] {
  const gaps: Gap[] = [];

  for (const f of facts) {
    // Symptom without onset.
    if (f.kind === "symptom" && f.value == null) {
      gaps.push({
        id: `gap-symptom-${f.id}`,
        question: `When did "${f.rawName}" start? (onset not recorded)`,
        trigger: `Symptom "${f.rawName}" missing onset date.`,
        priority: 1,
      });
    }
    // Medication without dose.
    if (f.kind === "medication" && f.value == null) {
      gaps.push({
        id: `gap-med-${f.id}`,
        question: `What is the dose for "${f.rawName}"? (dose not recorded)`,
        trigger: `Medication "${f.rawName}" missing dose.`,
        priority: 2,
      });
    }
    // Lab without a prior value for trend.
    if (f.kind === "lab" && f.value != null) {
      gaps.push({
        id: `gap-trend-${f.id}`,
        question: `Has "${f.rawName}" changed since the last report? (no prior value)`,
        trigger: `Lab "${f.rawName}" has no prior value for comparison.`,
        priority: 3,
      });
    }
  }

  // Prioritize and cap at 5.
  return gaps.sort((a, b) => a.priority - b.priority).slice(0, 5);
}
