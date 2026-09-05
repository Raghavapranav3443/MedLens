// Evidence validation — the code-layer guarantee behind "no claim without a
// receipt". A row is `verified` only when its quoted source line exists in the
// raw text AND its value AND range strings appear on that line. Everything
// else is quarantined: visible, unreviewed, excluded from summaries — never
// silently accepted, never silently dropped.

import type { ExtractionRow } from "@/lib/validation/extraction";

export interface EvidenceResult {
  verified: boolean;
  /** Character span into the RAW source text, when the line was located. */
  start: number | null;
  end: number | null;
}

const normalize = (s: string): string =>
  s
    .replace(/\[\[[A-Z]+_\d+\]\]/g, " ") // mask tokens never match raw text
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * Locate the quoted line in the raw text and check value + range verbatim.
 * Tolerates case/whitespace differences only — never numbers.
 */
export function verifyRow(rawText: string, row: ExtractionRow): EvidenceResult {
  const lineNeedle = normalize(row.sourceLine);
  if (!lineNeedle) return { verified: false, start: null, end: null };

  const rawLines = rawText.split("\n");
  let offset = 0;
  for (const rawLine of rawLines) {
    const lineStart = offset;
    const lineEnd = offset + rawLine.length;
    offset = lineEnd + 1; // +1 for the newline
    if (lineStart > rawText.length) break;

    const normalizedRaw = normalize(rawLine);
    if (!normalizedRaw || !normalizedRaw.includes(lineNeedle)) continue;

    const normLine = normalize(rawLine);
    const valueOK =
      row.value === "" || normLine.includes(normalize(row.value));
    const rangeOK =
      row.rangeText === "" || normLine.includes(normalize(row.rangeText));

    return { verified: valueOK && rangeOK, start: lineStart, end: lineEnd };
  }
  return { verified: false, start: null, end: null };
}
