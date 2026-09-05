// Table-driven tests for the best-effort identifier masker.
import { maskIdentifiers } from "@/lib/ingest/masking";

describe("maskIdentifiers", () => {
  it("masks emails and reports them in the offset map", () => {
    const { masked, map } = maskIdentifiers("Contact: meera.family@example.com, Ref: ABC123");
    expect(masked).toContain("[[EMAIL_1]]");
    expect(masked).not.toContain("meera.family@example.com");
    expect(map).toEqual([{ token: "[[EMAIL_1]]", original: "meera.family@example.com" }]);
  });

  it("masks MRN/UHID-style labels", () => {
    const { masked } = maskIdentifiers("MRN: 4829102\nHemoglobin 10.2 g/dL (13.0 - 17.0)");
    expect(masked).toContain("[[ID_1]]");
    expect(masked).toContain("Hemoglobin 10.2 g/dL (13.0 - 17.0)");
  });

  it("masks phone-like numbers but not lab values", () => {
    const { masked } = maskIdentifiers("Call +91 98765 43210\nHemoglobin 10.2 g/dL");
    expect(masked).not.toContain("+91 98765 43210");
    expect(masked).toContain("10.2 g/dL");
  });

  it("never corrupts reported reference ranges (regression: '(13.0 - 17.0)')", () => {
    const { masked } = maskIdentifiers("Hemoglobin 10.2 g/dL (13.0 - 17.0)\nWBC 8,400 /uL (4,000 - 11,000)");
    expect(masked).toContain("(13.0 - 17.0)");
    expect(masked).toContain("(4,000 - 11,000)");
    expect(masked).not.toContain("[[PHONE");
  });

  it("masks intake names (longest first), case-insensitively", () => {
    const { masked } = maskIdentifiers("Patient MEERA REDDY referred by meera", [
      "Meera Reddy",
      "meera",
    ]);
    expect(masked).not.toMatch(/meera reddy/i);
    expect(masked).toMatch(/\[\[NAME_1\]\]/);
    expect(masked).toMatch(/\[\[NAME_2\]\]/);
  });

  it("keeps tokens stable and aligned (mask length differs but text stays parseable)", () => {
    const text = "a@b.co and x@long-domain.org";
    const { masked, map } = maskIdentifiers(text);
    expect(masked).toBe("[[EMAIL_1]] and [[EMAIL_2]]");
    expect(map).toHaveLength(2);
  });
});
