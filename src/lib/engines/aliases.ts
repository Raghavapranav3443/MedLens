// Curated analyte alias map (docs/ARCHITECTURE.md §6, aliases.ts).
// Case/punctuation-insensitive; ambiguous abbreviations match only exactly.
// Unknown analytes keep rawName with canonicalName: null — never guessed.

const RAW_ALIASES: Record<string, string> = {
  // CBC
  hemoglobin: "Hemoglobin",
  hb: "Hemoglobin",
  hgb: "Hemoglobin",
  haemoglobin: "Hemoglobin",
  "hematocrit (hct)": "Hematocrit",
  hct: "Hematocrit",
  rbc: "Red Blood Cell Count",
  "red blood cell": "Red Blood Cell Count",
  wbc: "White Blood Cell Count",
  "white blood cell": "White Blood Cell Count",
  platelets: "Platelet Count",
  platelet: "Platelet Count",
  mcv: "MCV",
  mch: "MCH",
  mchc: "MCHC",
  rdw: "RDW",
  neutrophil: "Neutrophils",
  neutrophils: "Neutrophils",
  lymphocyte: "Lymphocytes",
  lymphocytes: "Lymphocytes",
  monocyte: "Monocytes",
  monocytes: "Monocytes",
  eosinophil: "Eosinophils",
  eosinophils: "Eosinophils",
  basophil: "Basophils",
  basophils: "Basophils",
  // Metabolic
  glucose: "Glucose",
  "fasting glucose": "Glucose",
  "blood sugar": "Glucose",
  bun: "Blood Urea Nitrogen",
  creatinine: "Creatinine",
  egfr: "eGFR",
  sodium: "Sodium",
  potassium: "Potassium",
  chloride: "Chloride",
  co2: "CO2",
  calcium: "Calcium",
  // Lipids
  cholesterol: "Total Cholesterol",
  "total cholesterol": "Total Cholesterol",
  hdl: "HDL Cholesterol",
  ldl: "LDL Cholesterol",
  triglycerides: "Triglycerides",
  vldl: "VLDL",
  // Thyroid
  tsh: "TSH",
  "free t4": "Free T4",
  "free t3": "Free T3",
  "t4": "Total T4",
  "t3": "Total T3",
  // Liver
  alt: "ALT",
  ast: "AST",
  "alkaline phosphatase": "Alkaline Phosphatase",
  alp: "Alkaline Phosphatase",
  bilirubin: "Bilirubin",
  albumin: "Albumin",
  "total protein": "Total Protein",
  // Iron
  iron: "Iron",
  ferritin: "Ferritin",
  tibc: "TIBC",
  // Other
  crp: "CRP",
  "c-reactive protein": "CRP",
  esr: "ESR",
  uric: "Uric Acid",
  "uric acid": "Uric Acid",
  psa: "PSA",
};

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Resolve an analyte to its canonical name, or null if unknown. */
export function resolveAlias(rawName: string): string | null {
  const key = normalize(rawName);
  if (!key) return null;
  // Exact match.
  if (RAW_ALIASES[key]) return RAW_ALIASES[key];
  // Remove trailing "(...)" then retry.
  const stripped = key.replace(/\(.*\)$/, "").trim();
  if (RAW_ALIASES[stripped]) return RAW_ALIASES[stripped];
  return null;
}
