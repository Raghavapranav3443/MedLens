import { GLOSSARY, lookupGlossary } from "@/lib/data/glossary";

describe("glossary", () => {
  it("resolves canonical names", () => {
    expect(lookupGlossary("Hemoglobin")?.term).toBe("Hemoglobin");
  });

  it("normalizes case and punctuation, but never substring-matches", () => {
    expect(lookupGlossary("HEMOGLOBIN")?.definition).toBe(GLOSSARY.hemoglobin.definition);
    expect(lookupGlossary("w.b.c.")?.definition).toBe(GLOSSARY.wbc.definition);
    // A longer raw string is not a glossary term — no guessed matches.
    expect(lookupGlossary("Hb (hemoglobin!)")).toBeNull();
  });

  it("returns null for unknown terms (never guesses)", () => {
    expect(lookupGlossary("Amphetamine")).toBeNull();
    expect(lookupGlossary("")).toBeNull();
  });

  it("every entry has a non-empty term and definition", () => {
    for (const [key, entry] of Object.entries(GLOSSARY)) {
      expect(entry.term.length).toBeGreaterThan(0);
      expect(entry.definition.length).toBeGreaterThan(20);
      expect(key).toMatch(/^[a-z0-9]+$/);
    }
  });
});
