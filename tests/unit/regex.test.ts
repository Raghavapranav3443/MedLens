import { regexExtract } from "@/lib/engines/regex";

describe("regexExtract (degraded mode)", () => {
  it("parses classic Name Value Unit (Range) lines", () => {
    const text = "Hemoglobin 10.2 g/dL (13.0 - 17.0)\nWBC 8,400 /uL (4,000 - 11,000)\nPlatelets 210,000 /uL (150,000 - 450,000)";
    const rows = regexExtract(text);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ rawName: "Hemoglobin", value: "10.2", unit: "g/dL", rangeText: "13.0 - 17.0", sourceLine: "Hemoglobin 10.2 g/dL (13.0 - 17.0)" });
  });

  it("strips commas from values", () => {
    expect(regexExtract("WBC 8,400 /uL (4,000 - 11,000)")[0].value).toBe("8400");
  });

  it("handles ranges without parentheses", () => {
    expect(regexExtract("Glucose 95 mg/dL 70 - 100")[0].rangeText).toBe("70 - 100");
  });

  it("returns empty unit when absent", () => {
    expect(regexExtract("Ratio 1.2 (0.8 - 1.5)")[0].unit).toBe("");
  });

  it("ignores non-matching lines", () => {
    const rows = regexExtract("COMPLETE BLOOD COUNT\nNotes\nHemoglobin 10.2 g/dL (13.0 - 17.0)");
    expect(rows).toHaveLength(1);
    expect(rows[0].rawName).toBe("Hemoglobin");
  });

  it("returns [] for empty input", () => {
    expect(regexExtract("")).toEqual([]);
  });
});
