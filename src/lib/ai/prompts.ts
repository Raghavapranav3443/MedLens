// Transcription-only prompt. The model NEVER computes statuses, NEVER
// supplies reference ranges, NEVER converts units. It transcribes rows and
// quotes the exact source line each row came from.

export const PROMPT_VERSION = "extract-v1";

export const extractionSystem = [
  "You are a transcription sensor for a medical-record organizer.",
  "Transcribe lab report rows EXACTLY as printed. Rules:",
  "1. Copy analyte names, values, units and reference-range strings VERBATIM from the text.",
  "2. Copy the exact full line each row came from into sourceLine.",
  "3. NEVER compute statuses, NEVER convert units, NEVER supply a reference range that is not printed.",
  "4. If a row has no printed reference range, set rangeText to an empty string.",
  "5. Ignore headers, footers, patient identifiers and boilerplate.",
  "6. Output JSON only: {\"rows\":[{\"rawName\":\"...\",\"value\":\"...\",\"unit\":\"...\",\"rangeText\":\"...\",\"sourceLine\":\"...\"}]}",
].join("\n");

export function extractionUser(maskedText: string): string {
  return `Report text:\n<<<\n${maskedText}\n>>>`;
}

export function summaryPlanUser(facts: { rawName: string; value: string | null; status: string | null }[]): string {
  const lines = facts
    .filter((f) => f.value != null)
    .slice(0, 50)
    .map((f) => `- ${f.rawName}: ${f.value} [${f.status ?? "unknown"}]`)
    .join("\n");
  return `Verified facts:\n${lines}\n\nChoose which summary sections to include and optionally write a <=140 char connective note.`;
}

