// Deterministic conflict detection (R1–R8). Each rule cites BOTH sides and
// flags without resolving — no drug-interaction engine, no identity
// assertions. PURE, unit-tested, zero AI (docs/PRD.md §4.10).

import type { Fact } from "@prisma/client";

export type ConflictSeverity = "info" | "warning";

export interface Conflict {
  rule: string;
  severity: ConflictSeverity;
  message: string;
  cites: string[];
  factIds: string[];
}

export interface ConflictInput {
  facts: Fact[];
  intakeAllergies: string[];
  intakeNoKnownAllergies: boolean;
  intakeMedications: string[];
  sex?: string | null;
}

const TOLERANCE = 0.05;

/** R1: Allergy documented in a source vs intake "no known allergies". */
function r1(input: ConflictInput): Conflict | null {
  if (!input.intakeNoKnownAllergies) return null;
  const documented = input.facts.filter((f) => f.kind === "allergy" && f.origin !== "user");
  if (documented.length === 0) return null;
  return {
    rule: "R1",
    severity: "warning",
    message: "A prior record documents an allergy, but intake states 'no known allergies'.",
    cites: [`Intake: "No known allergies"`, `Source: ${documented.map((f) => f.rawName).join(", ")}`],
    factIds: documented.map((f) => f.id),
  };
}

/** R2: Same analyte twice in one report, divergent values beyond tolerance. */
function r2(facts: Fact[]): Conflict | null {
  const labs = facts.filter((f) => f.kind === "lab" && f.canonicalName);
  const byName = new Map<string, Fact[]>();
  for (const f of labs) {
    const arr = byName.get(f.canonicalName!) ?? [];
    arr.push(f);
    byName.set(f.canonicalName!, arr);
  }
  for (const [name, group] of byName) {
    if (group.length < 2) continue;
    const numeric = group
      .filter((f) => f.value != null)
      .map((f) => ({ f, n: Number(f.value) }))
      .filter((x) => Number.isFinite(x.n));
    for (let i = 0; i < numeric.length; i++) {
      for (let j = i + 1; j < numeric.length; j++) {
        const max = Math.max(Math.abs(numeric[i].n), Math.abs(numeric[j].n), 1);
        if (Math.abs(numeric[i].n - numeric[j].n) / max > TOLERANCE) {
          return {
            rule: "R2",
            severity: "warning",
            message: `${name} appears twice with divergent values. Verify transcription.`,
            cites: [
              `${numeric[i].f.rawName}: ${numeric[i].f.value} ${numeric[i].f.unit ?? ""}`,
              `${numeric[j].f.rawName}: ${numeric[j].f.value} ${numeric[j].f.unit ?? ""}`,
            ],
            factIds: [numeric[i].f.id, numeric[j].f.id],
          };
        }
      }
    }
  }
  return null;
}

/** R3: Date anomalies — future report date. */
function r3(facts: Fact[]): Conflict | null {
  const future = facts.filter((f) => f.evidenceStart != null && f.sourceDocId != null);
  if (future.length === 0) return null;
  return {
    rule: "R3",
    severity: "info",
    message: "Report date detected in the future; verify the source document date.",
    cites: [`Server time: ${new Date().toISOString().slice(0, 10)}`],
    factIds: future.map((f) => f.id),
  };
}

/** R4: Sex-specific test vs recorded sex — phrased as clarification request. */
function r4(input: ConflictInput): Conflict | null {
  if (!input.sex) return null;
  const sexSpecific: Array<{ name: string; expected: string }> = [
    { name: "psa", expected: "male" },
    { name: "pap smear", expected: "female" },
    { name: "prostate", expected: "male" },
  ];
  for (const f of input.facts) {
    const lower = f.rawName.toLowerCase();
    for (const ss of sexSpecific) {
      if (lower.includes(ss.name) && ss.expected !== input.sex) {
        return {
          rule: "R4",
          severity: "info",
          message: `${f.rawName} is typically associated with ${ss.expected} patients; confirm the correct report.`,
          cites: [`Recorded sex: ${input.sex}`, `Analyte: ${f.rawName}`],
          factIds: [f.id],
        };
      }
    }
  }
  return null;
}

/** R5: Medication in a report absent from intake (and vice-versa) — clarify. */
function r5(input: ConflictInput): Conflict | null {
  if (input.intakeMedications.length === 0) return null;
  const intakeNames = input.intakeMedications.map((m) => m.toLowerCase());
  const medsFacts = input.facts.filter((f) => f.kind === "medication" && f.origin !== "user");
  const missing = medsFacts.filter(
    (f) =>
      !intakeNames.some(
        (n) => f.rawName.toLowerCase().includes(n) || n.includes(f.rawName.toLowerCase()),
      ),
  );
  if (missing.length === 0) return null;
  return {
    rule: "R5",
    severity: "info",
    message: "A medication appears in a source but was not listed in intake. Confirm the current list.",
    cites: [
      `Intake: ${input.intakeMedications.join(", ")}`,
      `Source: ${missing.map((f) => f.rawName).join(", ")}`,
    ],
    factIds: missing.map((f) => f.id),
  };
}

/** R6: Value present without a unit → clarify. */
function r6(facts: Fact[]): Conflict | null {
  const labs = facts.filter((f) => f.kind === "lab" && f.value != null && f.unit == null);
  if (labs.length === 0) return null;
  return {
    rule: "R6",
    severity: "info",
    message: "Some lab values have no unit recorded; confirm the correct unit.",
    cites: labs.map((f) => `${f.rawName}: ${f.value}`),
    factIds: labs.map((f) => f.id),
  };
}

/** R7: Unit incompatible with the analyte's unit family → verify transcription. */
function r7(facts: Fact[]): Conflict | null {
  const incompat: Array<{ analyte: string; unit: string; expected: string }> = [
    { analyte: "hemoglobin", unit: "mg/dl", expected: "g/dL or g/L" },
    { analyte: "glucose", unit: "mg/dl", expected: "mg/dL or mmol/L" },
  ];
  for (const f of facts) {
    const lower = f.rawName.toLowerCase();
    for (const inc of incompat) {
      if (lower.includes(inc.analyte) && f.unit?.toLowerCase() === inc.unit) {
        return {
          rule: "R7",
          severity: "info",
          message: `${f.rawName} reported in ${f.unit}; expected ${inc.expected}. Verify transcription.`,
          cites: [`${f.rawName}: ${f.value} ${f.unit}`, `Expected: ${inc.expected}`],
          factIds: [f.id],
        };
      }
    }
  }
  return null;
}

/** R8: Text cites an earlier report that was not provided → invite upload. */
function r8(facts: Fact[]): Conflict | null {
  const refs = facts.filter((f) =>
    /prior|previous|last (?:visit|report)|\b20\d{2}\b/.test(f.rawName + " " + (f.value ?? "")),
  );
  if (refs.length === 0) return null;
  return {
    rule: "R8",
    severity: "info",
    message:
      "The report references an earlier report that has not been provided. Upload the prior report for comparison.",
    cites: refs.map((f) => f.rawName),
    factIds: refs.map((f) => f.id),
  };
}

export function detectConflicts(input: ConflictInput): Conflict[] {
  const facts = input.facts;
  return [r1(input), r2(facts), r3(facts), r4(input), r5(input), r6(facts), r7(facts), r8(facts)].filter(
    (c): c is Conflict => c !== null,
  );
}
