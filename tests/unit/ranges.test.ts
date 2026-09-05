// Table-driven tests for the range parser + status engine.
// The parser and its cases are ONE artifact (docs/IMPLEMENTATION_PLAN.md Phase 3).

import { computeStatus, parseRangeText, parseValue } from "@/lib/engines/ranges";

describe("parseRangeText", () => {
  it.each([
    // [input, expectation]
    ["13.0 - 17.0", { type: "closed", low: 13, high: 17 }],
    ["13–17", { type: "closed", low: 13, high: 17 }],
    ["13-17", { type: "closed", low: 13, high: 17 }],
    ["13 to 17", { type: "closed", low: 13, high: 17 }],
    ["70 - 100", { type: "closed", low: 70, high: 100 }],
    ["1,200 - 4,500", { type: "closed", low: 1200, high: 4500 }],
    ["< 200", { type: "upper", high: 200 }],
    ["<200", { type: "upper", high: 200 }],
    ["≤ 5.7", { type: "upper", high: 5.7 }],
    ["<= 150", { type: "upper", high: 150 }],
    ["up to 150", { type: "upper", high: 150 }],
    ["> 40", { type: "lower", low: 40 }],
    [">= 60", { type: "lower", low: 60 }],
    ["≥ 9", { type: "lower", low: 9 }],
    ["Negative", { type: "qualitative", polarity: "negative" }],
    ["negative", { type: "qualitative", polarity: "negative" }],
    ["Non-Reactive", { type: "qualitative", polarity: "negative" }],
    ["Nil", { type: "qualitative", polarity: "negative" }],
    ["Positive", { type: "qualitative", polarity: "positive" }],
    ["Reactive", { type: "qualitative", polarity: "positive" }],
    ["Detected", { type: "qualitative", polarity: "positive" }],
    ["", null],
    [null, null],
    [undefined, null],
    ["   ", null],
    ["junk text", { type: "invalid" }],
    ["13 - 7", { type: "invalid" }], // inverted interval is not silently fixed
  ] as const)(
    "parses %j",
    (input, expected) => {
      const result = parseRangeText(input);
      if (expected === null) {
        expect(result).toBeNull();
      } else {
        expect(result).toMatchObject(expected);
      }
    },
  );
});

describe("parseValue", () => {
  it.each([
    ["10.2", { kind: "number", value: 10.2 }],
    ["1,200", { kind: "number", value: 1200 }],
    ["-3", { kind: "number", value: -3 }],
    ["Negative", { kind: "qualitative", polarity: "negative", raw: "Negative" }],
    ["POSITIVE", { kind: "qualitative", polarity: "positive", raw: "POSITIVE" }],
    ["", { kind: "nothing" }],
    [null, { kind: "nothing" }],
    ["abc", { kind: "unparseable", raw: "abc" }],
  ] as const)("parses %j", (input, expected) => {
    expect(parseValue(input)).toEqual(expected);
  });
});

describe("computeStatus — closed interval", () => {
  const r = parseRangeText("13.0 - 17.0");
  it.each([
    ["13.0", "normal"],
    ["15", "normal"],
    ["17.0", "normal"],
    ["10.2", "low"],
    ["18.5", "high"],
  ] as const)("value %j inside reported range", (value, status) => {
    expect(computeStatus(value, r).status).toBe(status);
  });

  it("computes deviation for the PRD headline case Hb 10.2 g/dL (13.0–17.0)", () => {
    expect(computeStatus("10.2", r)).toEqual({
      status: "low",
      deviation: { amount: 2.8, pctOfWidth: 70, side: "below" },
    });
  });
});

describe("computeStatus — bounds", () => {
  it.each([
    ["150", "< 200", "normal"],
    ["250", "< 200", "high"],
    ["70", ">= 60", "normal"],
    ["45", ">= 60", "low"],
  ] as const)("value %j vs range %j → %j", (value, rangeText, status) => {
    expect(computeStatus(value, parseRangeText(rangeText)).status).toBe(status);
  });
});

describe("computeStatus — qualitative", () => {
  it.each([
    ["Negative", "Negative", "normal"],
    ["Positive", "Negative", "qualitative_mismatch"],
    ["Non-Reactive", "Reactive", "qualitative_mismatch"],
    ["Reactive", "Reactive", "normal"],
  ] as const)("value %j vs range %j → %j", (value, rangeText, status) => {
    expect(computeStatus(value, parseRangeText(rangeText)).status).toBe(status);
  });
});

describe("computeStatus — no invented ranges (structural guarantee)", () => {
  it("returns no_reference_provided when the source has no range", () => {
    expect(computeStatus("10.2", null).status).toBe("no_reference_provided");
    expect(computeStatus("10.2", parseRangeText("")).status).toBe("no_reference_provided");
    expect(computeStatus("10.2", parseRangeText(undefined)).status).toBe("no_reference_provided");
  });

  it("returns unparseable when the range text exists but matches no form", () => {
    expect(computeStatus("10.2", parseRangeText("see chart")).status).toBe("unparseable");
  });

  it("returns unknown when the value is missing", () => {
    expect(computeStatus(null, parseRangeText("13-17")).status).toBe("unknown");
    expect(computeStatus("", parseRangeText("13-17")).status).toBe("unknown");
  });

  it("returns unparseable when the value is junk", () => {
    expect(computeStatus("high-ish", parseRangeText("13-17")).status).toBe("unparseable");
  });

  it("never computes a numeric status for a qualitative value vs numeric range", () => {
    expect(computeStatus("Negative", parseRangeText("13-17")).status).toBe("unknown");
  });

  it("never computes a numeric status for a numeric value vs qualitative range", () => {
    expect(computeStatus("4.2", parseRangeText("Negative")).status).toBe("unknown");
  });
});
