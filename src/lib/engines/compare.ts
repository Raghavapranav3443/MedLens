// Longitudinal comparison with status transitions (docs/PRD.md §4.14). Joins
// current ↔ previous on canonicalName, converts units, reports delta,
// direction and statusTransition. Bound crossings outrank large-but-normal
// swings — a display choice, not a clinical ranking.

import type { Fact } from "@prisma/client";

export type Direction = "unchanged" | "increased" | "decreased";

export interface Comparison {
  analyte: string;
  previousValue: number | null;
  currentValue: number | null;
  previousUnit: string | null;
  currentUnit: string | null;
  delta: number | null;
  deltaPct: number | null;
  direction: Direction;
  /** Status transition e.g. "normal → low" */
  statusTransition: string;
  /** "could not be compared" when units are incompatible */
  note?: string;
}

function toNumber(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

// Exact-factor unit conversions only; otherwise not_comparable.
function convert(value: number, fromUnit: string, toUnit: string): number | null {
  const f = fromUnit.toLowerCase().trim();
  const t = toUnit.toLowerCase().trim();
  if (f === t) return value;
  // Hemoglobin: g/dL <-> g/L (factor 10).
  if ((f === "g/dl" && t === "g/l") || (f === "g/l" && t === "g/dl")) {
    return f === "g/dl" ? value * 10 : value / 10;
  }
  // Glucose: mg/dL <-> mmol/L (factor 18).
  if ((f === "mg/dl" && t === "mmol/l") || (f === "mmol/l" && t === "mg/dl")) {
    return f === "mg/dl" ? value / 18 : value * 18;
  }
  return null;
}

export function compareFacts(previous: Fact[], current: Fact[]): Comparison[] {
  const results: Comparison[] = [];
  const prevByName = new Map<string, Fact>();
  for (const f of previous) {
    if (f.kind === "lab" && f.canonicalName && !prevByName.has(f.canonicalName)) {
      prevByName.set(f.canonicalName, f);
    }
  }

  for (const cur of current) {
    if (cur.kind !== "lab") continue;
    if (!cur.canonicalName) {
      results.push({
        analyte: cur.rawName,
        previousValue: null,
        currentValue: toNumber(cur.value),
        previousUnit: null,
        currentUnit: cur.unit,
        delta: null,
        deltaPct: null,
        direction: "unchanged",
        statusTransition: "unknown",
        note: "No canonical name — could not be compared.",
      });
      continue;
    }
    const prev = prevByName.get(cur.canonicalName);
    if (!prev) {
      results.push({
        analyte: cur.rawName,
        previousValue: null,
        currentValue: toNumber(cur.value),
        previousUnit: null,
        currentUnit: cur.unit,
        delta: null,
        deltaPct: null,
        direction: "unchanged",
        statusTransition: "unknown",
        note: "No prior value for comparison.",
      });
      continue;
    }

    const curVal = toNumber(cur.value);
    const prevVal = toNumber(prev.value);
    const curUnit = cur.unit ?? "";
    const prevUnit = prev.unit ?? "";

    if (curVal == null || prevVal == null) {
      results.push({
        analyte: cur.rawName,
        previousValue: prevVal,
        currentValue: curVal,
        previousUnit: prevUnit,
        currentUnit: curUnit,
        delta: null,
        deltaPct: null,
        direction: "unchanged",
        statusTransition: `${prev.status ?? "unknown"} → ${cur.status ?? "unknown"}`,
        note: "Value missing — could not be compared.",
      });
      continue;
    }

    const convertedPrev = convert(prevVal, prevUnit, curUnit);
    if (convertedPrev == null) {
      results.push({
        analyte: cur.rawName,
        previousValue: prevVal,
        currentValue: curVal,
        previousUnit: prevUnit,
        currentUnit: curUnit,
        delta: null,
        deltaPct: null,
        direction: "unchanged",
        statusTransition: `${prev.status ?? "unknown"} → ${cur.status ?? "unknown"}`,
        note: `Incompatible units: ${prevUnit} vs ${curUnit} — could not be compared.`,
      });
      continue;
    }

    const delta = curVal - convertedPrev;
    const deltaPct = prevVal !== 0 ? (delta / Math.abs(convertedPrev)) * 100 : null;
    const direction: Direction = delta > 0 ? "increased" : delta < 0 ? "decreased" : "unchanged";

    results.push({
      analyte: cur.rawName,
      previousValue: convertedPrev,
      currentValue: curVal,
      previousUnit: curUnit,
      currentUnit: curUnit,
      delta: Math.round(delta * 100) / 100,
      deltaPct: deltaPct == null ? null : Math.round(deltaPct * 10) / 10,
      direction,
      statusTransition: `${prev.status ?? "unknown"} → ${cur.status ?? "unknown"}`,
    });
  }

  // Sort: bound crossings (status transitions involving low/high) first.
  return results.sort((a, b) => {
    const score = (c: Comparison) =>
      /→ (low|high)/.test(c.statusTransition) ? 0 : /unchanged/.test(c.statusTransition) ? 2 : 1;
    return score(a) - score(b);
  });
}
