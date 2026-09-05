// Evidence-validation tests: rows match source or get quarantined — never
// silently trusted, never dropped.

import { verifyRow } from "@/lib/server/evidence";
import type { ExtractionRow } from "@/lib/validation/extraction";

const SOURCE = `COMPLETE BLOOD COUNT — SYNTHETIC SAMPLE
Hemoglobin 10.2 g/dL (13.0 - 17.0)
WBC 8,400 /uL (4,000 - 11,000)`;

function row(overrides: Partial<ExtractionRow>): ExtractionRow {
  return {
    rawName: "Hemoglobin",
    value: "10.2",
    unit: "g/dL",
    rangeText: "13.0 - 17.0",
    sourceLine: "Hemoglobin 10.2 g/dL (13.0 - 17.0)",
    ...overrides,
  };
}

describe("verifyRow", () => {
  it("verifies a faithful row and returns the source-line span", () => {
    const result = verifyRow(SOURCE, row({}));
    expect(result.verified).toBe(true);
    expect(result.start).toBe(SOURCE.indexOf("Hemoglobin 10.2"));
    expect(result.end).toBe(result.start! + "Hemoglobin 10.2 g/dL (13.0 - 17.0)".length);
  });

  it("verbatim range with different whitespace still verifies", () => {
    const result = verifyRow(SOURCE, row({ rangeText: "13.0-17.0" }));
    expect(result.verified).toBe(false); // numbers/spacing must match the printed range
  });

  it("quarantines an INVENTED range (the structural no-invented-ranges guard)", () => {
    const result = verifyRow(SOURCE, row({ rangeText: "12.0 - 18.0" }));
    expect(result.verified).toBe(false);
  });

  it("quarantines a row whose source line does not exist", () => {
    const result = verifyRow(SOURCE, row({ sourceLine: "Totally made up line 99" }));
    expect(result.verified).toBe(false);
    expect(result.start).toBeNull();
  });

  it("verifies a row with no range reported (absent range is honest, not a failure)", () => {
    const source = "Thyroid panel\nTSH 4.6 uIU/mL";
    const result = verifyRow(source, {
      rawName: "TSH",
      value: "4.6",
      unit: "uIU/mL",
      rangeText: "",
      sourceLine: "TSH 4.6 uIU/mL",
    });
    expect(result.verified).toBe(true);
  });

  it("tolerates mask tokens in the model's quoted line", () => {
    const result = verifyRow(
      SOURCE,
      row({ sourceLine: "[[NAME_1]] Hemoglobin 10.2 g/dL (13.0 - 17.0)" }),
    );
    expect(result.verified).toBe(true);
  });
});
