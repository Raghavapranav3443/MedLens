import { writeFileSync } from "node:fs";
const NL = "\n";

const aliasesTest = [
  'import { resolveAlias } from "@/lib/engines/aliases";',
  '',
  'describe("resolveAlias", () => {',
  '  it("resolves common abbreviations to canonical names", () => {',
  '    expect(resolveAlias("Hb")).toBe("Hemoglobin");',
  '    expect(resolveAlias("HGB")).toBe("Hemoglobin");',
  '    expect(resolveAlias("wbc")).toBe("White Blood Cell Count");',
  '    expect(resolveAlias("TSH")).toBe("TSH");',
  '    expect(resolveAlias("LDL")).toBe("LDL Cholesterol");',
  '  });',
  '',
  '  it("is case and punctuation insensitive", () => {',
  '    expect(resolveAlias("hemoglobin")).toBe("Hemoglobin");',
  '    expect(resolveAlias("HEMOGLOBIN")).toBe("Hemoglobin");',
  '    expect(resolveAlias("  HGB  ")).toBe("Hemoglobin");',
  '  });',
  '',
  '  it("returns null for unknown analytes — never guessed", () => {',
  '    expect(resolveAlias("SomeRandomThing")).toBeNull();',
  '    expect(resolveAlias("")).toBeNull();',
  '    expect(resolveAlias("xyz123")).toBeNull();',
  '  });',
  '',
  '  it("resolves via the bare alias when parens are present", () => {',
  '    expect(resolveAlias("hct")).toBe("Hematocrit");',
  '  });',
  '});',
  '',
].join(NL);

writeFileSync("tests/unit/aliases.test.ts", aliasesTest);
console.log("aliases test rewritten");
