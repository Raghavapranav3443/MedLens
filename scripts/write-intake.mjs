import { writeFileSync } from "node:fs";
const content = String.raw`"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DEMO_REPORT = \`COMPLETE BLOOD COUNT — SYNTHETIC SAMPLE
Hemoglobin 10.2 g/dL (13.0 - 17.0)
WBC 8,400 /uL (4,000 - 11,000)
Platelets 210,000 /uL (150,000 - 450,000)\`;

function parseList(raw: string): string[] {
  return raw.split("\n").map((s) => s.trim()).filter(Boolean);
}

export default function IntakeForm() {
  const router = useRouter();
  const [title, setTitle] = useState("Demo record");
  const [age, setAge] = useState("34");
  const [sex, setSex] = useState("");
  const [report, setReport] = useState(DEMO_REPORT);
  const [conditions, setConditions] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medications, setMedications] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [noKnownAllergies, setNoKnownAllergies] = useState(true);
  const [consent, setConsent] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) { setError("Please confirm the data-use notice before continuing."); return; }
    setBusy(true);
    setError(null);
    try {
      setStage("Creating record…");
      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          ...(age !== "" ? { age: Number(age) } : {}),
          ...(sex ? { sex } : {}),
          ...(symptoms.trim() ? { symptoms: parseList(symptoms).map((text) => ({ text })) } : {}),
          ...(conditions.trim() ? { conditions: parseList(conditions) } : {}),
          ...(allergies.trim() ? { allergies: parseList(allergies).map((substance) => ({ substance })) } : {}),
          ...(medications.trim() ? { medications: parseList(medications).map((name) => ({ name })) } : {}),
          noKnownAllergies,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        const fields = body?.error?.fieldErrors ? Object.values(body.error.fieldErrors).join("; ") : "";
        setError(\`\${body?.error?.code ?? res.status}: \${body?.error?.message ?? "Request failed"} \${fields}\`.trim());
        return;
      }
      const recordId: string = body.record.id;
      if (report.trim() !== "") {
        setStage("Extracting report rows…");
        const srcRes = await fetch(\`/api/records/\${recordId}/sources\`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "pasted_text", text: report }),
        });
        const srcBody = await srcRes.json();
        if (!srcRes.ok) { setError(\`\${srcBody?.error?.code ?? srcRes.status}: \${srcBody?.error?.message ?? "Extraction failed"}\`); return; }
        setStage(\`Extracted \${srcBody.rowCount} rows (\${srcBody.verifiedCount} verified, \${srcBody.quarantined} quarantined).\`);
      }
      router.push(\`/record/\${recordId}\`);
    } catch { setError("Network error."); }
    finally { setBusy(false); setStage(""); }
  }
`;
writeFileSync("src/components/IntakeForm.tsx", content);
console.log("intake part1");
