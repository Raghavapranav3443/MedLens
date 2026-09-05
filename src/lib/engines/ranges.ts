// Range parser + status derivation — PURE, unit-tested, zero AI.
// Ranges are parsed ONLY from text reported in the source. An absent range
// is `no_reference_provided`, always. The app invents no thresholds, no
// critical bands, no age/sex norms (docs/ARCHITECTURE.md §6).

export type RangeStatus =
  | "low"
  | "normal"
  | "high"
  | "unknown"
  | "unparseable"
  | "qualitative_mismatch"
  | "no_reference_provided";

export type ParsedRange =
  | { type: "closed"; low: number; high: number; raw: string }
  | { type: "upper"; high: number; raw: string }
  | { type: "lower"; low: number; raw: string }
  | { type: "qualitative"; polarity: "negative" | "positive"; raw: string }
  | { type: "invalid"; raw: string };

export interface Deviation {
  /** Distance from the nearest bound (absolute). */
  amount: number;
  /** Percent of the reported range width; null when the width is unknowable. */
  pctOfWidth: number | null;
  /** Which side of the reported interval. */
  side: "below" | "above";
}

const NEGATIVE_TOKENS = new Set([
  "negative",
  "non-reactive",
  "nonreactive",
  "nil",
  "none",
  "not detected",
  "clear",
  "normal",
]);

const POSITIVE_TOKENS = new Set(["positive", "reactive", "detected", "abnormal", "present"]);

const NUM_RE = /^-?\d+(?:[.,]\d+)?$/;

/** Parse a value string that may be numeric or a qualitative token. */
export function parseValue(
  raw: string | null | undefined,
):
  | { kind: "number"; value: number }
  | { kind: "qualitative"; polarity: "negative" | "positive"; raw: string }
  | { kind: "nothing" }
  | { kind: "unparseable"; raw: string } {
  if (raw === null || raw === undefined) return { kind: "nothing" };
  const s = raw.trim().toLowerCase().replace(/,/g, "");
  if (s === "") return { kind: "nothing" };
  if (NUM_RE.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? { kind: "number", value: n } : { kind: "unparseable", raw };
  }
  if (NEGATIVE_TOKENS.has(s)) return { kind: "qualitative", polarity: "negative", raw };
  if (POSITIVE_TOKENS.has(s)) return { kind: "qualitative", polarity: "positive", raw };
  return { kind: "unparseable", raw };
}

/** Pull the first number out of a range fragment like "13.0 g/dL" or "< 200". */
function number(s: string): number | null {
  const m = s.match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse range text exactly as reported in the source. Returns {type:"invalid"}
 * when text exists but matches no documented form — never a guess.
 */
export function parseRangeText(raw: string | null | undefined): ParsedRange | null {
  if (raw === null || raw === undefined) return null;
  const s = raw.trim();
  if (s === "") return null;

  // Qualitative tokens first (case/punctuation-insensitive).
  const low = s.toLowerCase().replace(/[.!?]+$/, "").trim();
  if (NEGATIVE_TOKENS.has(low)) return { type: "qualitative", polarity: "negative", raw: s };
  if (POSITIVE_TOKENS.has(low)) return { type: "qualitative", polarity: "positive", raw: s };

  // Upper bounds: < 200, <= 5.7, ≤ 5.7, up to 150
  const upper = s.match(/^(?:<=?\s*|≤\s*|up\s+to\s+)([0-9]+(?:[.,][0-9]+)?)/i);
  if (upper) {
    const high = number(upper[1]);
    if (high !== null) return { type: "upper", high, raw: s };
  }

  // Lower bounds: > 40, >= 60, ≥ 60
  const lower = s.match(/^(?:>=?\s*|≥\s*)([0-9]+(?:[.,][0-9]+)?)/);
  if (lower) {
    const lo = number(lower[1]);
    if (lo !== null) return { type: "lower", low: lo, raw: s };
  }

  // Closed intervals: 13.0 - 17.0, 13–17, 13 to 17, 13.0-17.0
  const closed = s.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(?:-|–|—|to)\s*([0-9]+(?:[.,][0-9]+)?)$/i);
  if (closed) {
    const a = number(closed[1]);
    const b = number(closed[2]);
    if (a !== null && b !== null && a <= b) {
      return { type: "closed", low: a, high: b, raw: s };
    }
  }

  return { type: "invalid", raw: s };
}

/**
 * Derive the displayed status from a value and its REPORTED range only.
 * `deviation` is for display and sorting — a presentation choice, never a
 * clinical significance ranking.
 */
export function computeStatus(
  value: string | null | undefined,
  range: ParsedRange | null,
): { status: RangeStatus; deviation: Deviation | null } {
  const v = parseValue(value);

  if (v.kind === "nothing") return { status: "unknown", deviation: null };
  if (v.kind === "unparseable") return { status: "unparseable", deviation: null };

  if (range === null) return { status: "no_reference_provided", deviation: null };
  if (range.type === "invalid") return { status: "unparseable", deviation: null };

  if (v.kind === "qualitative") {
    if (range.type === "qualitative") {
      return {
        status: v.polarity === range.polarity ? "normal" : "qualitative_mismatch",
        deviation: null,
      };
    }
    // Qualitative value against a numeric range — cannot be compared.
    return { status: "unknown", deviation: null };
  }

  // Numeric value from here on.
  if (range.type === "qualitative") return { status: "unknown", deviation: null };

  if (range.type === "closed") {
    if (v.value < range.low) {
      return {
        status: "low",
        deviation: {
          amount: round6(range.low - v.value),
          pctOfWidth: round6(((range.low - v.value) / (range.high - range.low)) * 100),
          side: "below",
        },
      };
    }
    if (v.value > range.high) {
      return {
        status: "high",
        deviation: {
          amount: round6(v.value - range.high),
          pctOfWidth: round6(((v.value - range.high) / (range.high - range.low)) * 100),
          side: "above",
        },
      };
    }
    return { status: "normal", deviation: null };
  }

  if (range.type === "upper") {
    return v.value <= range.high
      ? { status: "normal", deviation: null }
      : {
          status: "high",
          deviation: { amount: round6(v.value - range.high), pctOfWidth: null, side: "above" },
        };
  }

  // lower bound
  return v.value >= range.low
    ? { status: "normal", deviation: null }
    : {
        status: "low",
        deviation: { amount: round6(range.low - v.value), pctOfWidth: null, side: "below" },
      };
}

function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
