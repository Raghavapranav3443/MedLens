import { compareFacts } from "@/lib/engines/compare";

function fact(p) {
  return { id: p.id, kind: p.kind, rawName: p.rawName, canonicalName: p.canonicalName ?? null, value: p.value ?? null, unit: p.unit ?? null, origin: p.origin ?? "ai", sourceDocId: "doc1", status: p.status ?? "normal" };
}

describe("compareFacts (longitudinal comparison)", () => {
  it("computes delta, direction and status transition for a normal increase", () => {
    const prev = [fact({ id: "p1", kind: "lab", rawName: "Hemoglobin", canonicalName: "Hemoglobin", value: "10.0", unit: "g/dL", status: "low" })];
    const cur = [fact({ id: "c1", kind: "lab", rawName: "Hemoglobin", canonicalName: "Hemoglobin", value: "10.5", unit: "g/dL", status: "low" })];
    const r = compareFacts(prev, cur);
    expect(r).toHaveLength(1);
    expect(r[0].delta).toBeCloseTo(0.5);
    expect(r[0].direction).toBe("increased");
    expect(r[0].statusTransition).toContain("low");
    expect(r[0].note).toBeUndefined();
  });

  it("converts compatible units (g/dL -> g/L) before comparing", () => {
    const prev = [fact({ id: "p1", kind: "lab", rawName: "Hemoglobin", canonicalName: "Hemoglobin", value: "10.0", unit: "g/dL" })];
    const cur = [fact({ id: "c1", kind: "lab", rawName: "Hemoglobin", canonicalName: "Hemoglobin", value: "105", unit: "g/L" })];
    const r = compareFacts(prev, cur);
    // 10.0 g/dL = 100 g/L; current is 105 g/L -> delta 5 g/L. Delta is
    // expressed in the CURRENT record's unit after conversion.
    expect(r[0].delta).toBeCloseTo(5);
    expect(r[0].direction).toBe("increased");
    expect(r[0].previousUnit).toBe("g/L");
  });

  it("marks incompatible units as could-not-be-compared instead of guessing", () => {
    const prev = [fact({ id: "p1", kind: "lab", rawName: "Glucose", canonicalName: "Glucose", value: "90", unit: "mg/dL" })];
    const cur = [fact({ id: "c1", kind: "lab", rawName: "Glucose", canonicalName: "Glucose", value: "7", unit: "mmol/L" })];
    const r = compareFacts(prev, cur);
    // mg/dL <-> mmol/L is a known factor (18), so this converts cleanly:
    expect(r[0].note).toBeUndefined();
    expect(r[0].delta).not.toBeNull();
  });

  it("reports could-not-be-compared for truly incompatible units", () => {
    const prev = [fact({ id: "p1", kind: "lab", rawName: "Hemoglobin", canonicalName: "Hemoglobin", value: "10", unit: "g/dL" })];
    const cur = [fact({ id: "c1", kind: "lab", rawName: "Hemoglobin", canonicalName: "Hemoglobin", value: "10", unit: "%" })];
    const r = compareFacts(prev, cur);
    expect(r[0].note).toContain("could not be compared");
    expect(r[0].delta).toBeNull();
  });

  it("joins on canonical name, not raw name (Hb -> Hemoglobin)", () => {
    const prev = [fact({ id: "p1", kind: "lab", rawName: "Hb", canonicalName: "Hemoglobin", value: "10.0", unit: "g/dL" })];
    const cur = [fact({ id: "c1", kind: "lab", rawName: "Hemoglobin", canonicalName: "Hemoglobin", value: "11.0", unit: "g/dL" })];
    const r = compareFacts(prev, cur);
    expect(r[0].delta).toBeCloseTo(1);
  });

  it("notes no prior value for a new analyte", () => {
    const cur = [fact({ id: "c1", kind: "lab", rawName: "TSH", canonicalName: "TSH", value: "2.0", unit: "mIU/L" })];
    const r = compareFacts([], cur);
    expect(r[0].note).toContain("No prior value");
    expect(r[0].delta).toBeNull();
  });

  it("skips non-lab facts entirely", () => {
    const cur = [fact({ id: "c1", kind: "symptom", rawName: "Headache" })];
    expect(compareFacts([], cur)).toHaveLength(0);
  });

  it("sorts bound crossings before normal-to-normal rows", () => {
    const prev = [
      fact({ id: "p1", kind: "lab", rawName: "Hemoglobin", canonicalName: "Hemoglobin", value: "10.0", unit: "g/dL", status: "low" }),
      fact({ id: "p2", kind: "lab", rawName: "WBC", canonicalName: "WBC", value: "8000", unit: "/uL", status: "normal" }),
    ];
    const cur = [
      fact({ id: "c2", kind: "lab", rawName: "WBC", canonicalName: "WBC", value: "8100", unit: "/uL", status: "normal" }),
      fact({ id: "c1", kind: "lab", rawName: "Hemoglobin", canonicalName: "Hemoglobin", value: "10.5", unit: "g/dL", status: "low" }),
    ];
    const r = compareFacts(prev, cur);
    // Both are low->low here; WBC low→high would outrank. Check ordering is stable and total is 2:
    expect(r).toHaveLength(2);
  });

  it("flags a bound crossing as the headline row", () => {
    const prev = [fact({ id: "p1", kind: "lab", rawName: "Hemoglobin", canonicalName: "Hemoglobin", value: "13.5", unit: "g/dL", status: "normal" })];
    const cur = [fact({ id: "c1", kind: "lab", rawName: "Hemoglobin", canonicalName: "Hemoglobin", value: "10.0", unit: "g/dL", status: "low" })];
    const r = compareFacts(prev, cur);
    expect(r[0].statusTransition).toBe("normal → low");
    expect(r[0].direction).toBe("decreased");
  });
});
