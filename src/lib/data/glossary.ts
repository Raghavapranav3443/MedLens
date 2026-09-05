// Plain-language glossary (docs/PRD.md §4.18). Local JSON; medical terms
// render as accessible buttons + popovers. No external dependency.

export const GLOSSARY: Record<string, { term: string; definition: string }> = {
  hemoglobin: {
    term: "Hemoglobin",
    definition: "A protein in red blood cells that carries oxygen. Low levels may indicate anemia; high levels can be due to dehydration or other conditions.",
  },
  wbc: {
    term: "White Blood Cell Count (WBC)",
    definition: "Cells that help fight infection. High levels may suggest infection or inflammation; low levels can reduce immunity.",
  },
  platelets: {
    term: "Platelets",
    definition: "Cell fragments that help blood clot. Low levels may cause easy bruising or bleeding; high levels can increase clotting risk.",
  },
  glucose: {
    term: "Glucose",
    definition: "Blood sugar — the main energy source for cells. High levels may suggest diabetes or prediabetes; low levels can cause dizziness or fainting.",
  },
  hba1c: {
    term: "HbA1c",
    definition: "Average blood sugar over the past 2–3 months. Used to diagnose and monitor diabetes. Below 5.7% is typical; 6.5% or higher may indicate diabetes.",
  },
  creatinine: {
    term: "Creatinine",
    definition: "A waste product filtered by the kidneys. High levels may suggest reduced kidney function.",
  },
  egfr: {
    term: "eGFR",
    definition: "Estimated kidney filtration rate. Above 90 is typical; below 60 for 3+ months may indicate chronic kidney disease.",
  },
  cholesterol: {
    term: "Total Cholesterol",
    definition: "A fatty substance in blood. Desirable is below 200 mg/dL. High levels can increase heart disease risk.",
  },
  ldl: {
    term: "LDL Cholesterol",
    definition: '"Bad" cholesterol that can build up in arteries. Lower is generally better; optimal is below 100 mg/dL.',
  },
  hdl: {
    term: "HDL Cholesterol",
    definition: '"Good" cholesterol that helps remove other cholesterol. Higher is better; 60 mg/dL or above is protective.',
  },
  triglycerides: {
    term: "Triglycerides",
    definition: "A type of fat in blood. Normal is below 150 mg/dL. High levels can increase heart disease risk.",
  },
  tsh: {
    term: "TSH",
    definition: "Thyroid-stimulating hormone. Controls thyroid function. High levels may suggest underactive thyroid; low levels may suggest overactive thyroid.",
  },
  alt: {
    term: "ALT",
    definition: "A liver enzyme. High levels may indicate liver stress or damage.",
  },
  ast: {
    term: "AST",
    definition: "An enzyme found in liver and muscles. High levels may suggest liver or muscle damage.",
  },
  crp: {
    term: "CRP",
    definition: "C-reactive protein. A marker of inflammation. High levels may suggest infection or inflammatory conditions.",
  },
  esr: {
    term: "ESR",
    definition: "Erythrocyte sedimentation rate. Another inflammation marker. Higher levels may suggest inflammation.",
  },
  mcv: {
    term: "MCV",
    definition: "Mean corpuscular volume — the average size of red blood cells. Helps classify types of anemia.",
  },
  ferritin: {
    term: "Ferritin",
    definition: "A protein that stores iron. Low levels may indicate iron deficiency; high levels can suggest inflammation or iron overload.",
  },
  psa: {
    term: "PSA",
    definition: "Prostate-specific antigen. Screened in males. High levels may suggest prostate conditions including enlargement or cancer.",
  },
  bun: {
    term: "BUN",
    definition: "Blood urea nitrogen. A waste product filtered by the kidneys. High levels may suggest dehydration or kidney issues.",
  },
};

/** Resolve a canonical or raw term name to a glossary entry, or null. */
export function lookupGlossary(rawName: string): { term: string; definition: string } | null {
  const key = rawName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return GLOSSARY[key] ?? null;
}
