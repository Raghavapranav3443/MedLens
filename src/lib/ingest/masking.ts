// Best-effort identifier masking BEFORE any bytes reach the model, with an
// offset map kept only in server memory. Heuristic — cannot be guaranteed
// complete; the UI labels it "best effort" (docs/PRD.md §4.13).

export interface MaskedText {
  masked: string;
  /** token -> original replacement, for potential re-hydration. */
  map: Array<{ token: string; original: string }>;
}

interface Pattern {
  kind: string;
  re: RegExp;
}

const PATTERNS: Pattern[] = [
  { kind: "EMAIL", re: /[\w.+-]+@[\w-]+\.[\w.]+/g },
  // Phone-like: 9+ chars of digits/spaces/parens/hyphens. Decimal points are
  // deliberately EXCLUDED so reference ranges like "(13.0 - 17.0)" and decimal
  // lab values are never corrupted — masking must never break the data.
  { kind: "PHONE", re: /(?:\+?\d[\d\s()-]{7,}\d)/g },
  // MRN / UHID / ID-style labels.
  { kind: "ID", re: /\b(?:MRN|UHID|Patient\s*ID|Reg(?:istration)?\s*(?:No|Number)?)\s*[:#-]?\s*[\w/-]+/gi },
];

/**
 * Mask obvious identifiers, replacing them with stable tokens ([[EMAIL_1]]).
 * Names from intake (if any) are masked first, longest first.
 */
export function maskIdentifiers(text: string, names: string[] = []): MaskedText {
  const map: Array<{ token: string; original: string }> = [];
  let masked = text;
  const counters: Record<string, number> = {};

  const replace = (kind: string, original: string) => {
    counters[kind] = (counters[kind] ?? 0) + 1;
    const token = `[[${kind}_${counters[kind]}]]`;
    map.push({ token, original });
    return token;
  };

  for (const rawName of [...names].filter((n) => n.trim().length > 1).sort((a, b) => b.length - a.length)) {
    const escaped = rawName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    masked = masked.replace(new RegExp(escaped, "gi"), (m) => replace("NAME", m));
  }

  for (const { kind, re } of PATTERNS) {
    masked = masked.replace(re, (m) => replace(kind, m));
  }

  return { masked, map };
}
