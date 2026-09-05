// Degraded-mode regex extractor (docs/PRD.md §4.19). When the AI provider is
// unavailable, this handles classic `Name Value Unit Range` lines. Output is
// marked origin: "heuristic", verified: false (quarantined) — never silently
// trusted. PURE, unit-tested.

export interface RegexRow {
  rawName: string;
  value: string;
  unit: string;
  rangeText: string;
  sourceLine: string;
}

// Matches lines like: "Hemoglobin 10.2 g/dL (13.0 - 17.0)" or "WBC 8,400 /uL 4,000-11,000".
const LINE_RE =
  /^\s*([A-Za-z][A-Za-z0-9 /()-]{2,60}?)\s+([\d][\d,]*\.?\d*)\s*([a-zA-Z/%]+)?\s*[\(\s]*([\d][\d,]*\.?\d*)\s*[-–]\s*([\d][\d,]*\.?\d*)[\)\s]*$/;

export function regexExtract(text: string): RegexRow[] {
  const rows: RegexRow[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const m = LINE_RE.exec(line);
    if (!m) continue;
    const [, rawName, value, unit, low, high] = m;
    rows.push({
      rawName: rawName.trim(),
      value: value.replace(/,/g, ""),
      unit: unit?.trim() || "",
      rangeText: `${low} - ${high}`,
      sourceLine: line,
    });
  }
  return rows;
}
