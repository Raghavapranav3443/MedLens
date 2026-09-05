// One-message Groq smoke test (docs/IMPLEMENTATION_PLAN.md Phase 0, step 4).
// Validates model availability, key validity and JSON mode BEFORE app code
// depends on them. Never prints the key.
import { readFileSync } from "node:fs";

// Minimal .env.local parser (no dotenv dependency needed).
let key = process.env.GROQ_API_KEY;
const cliModel = process.argv[2];
let model = cliModel || process.env.GROQ_MODEL || "openai/gpt-oss-120b";
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\r\n]*)"?\s*$/);
    if (!m) continue;
    if (m[1] === "GROQ_API_KEY" && m[2]) key = m[2];
    if (m[1] === "GROQ_MODEL" && m[2] && !cliModel) model = m[2];
  }
} catch {
  /* no .env.local — fall back to real env */
}

if (!key) {
  console.error("FAIL: no GROQ_API_KEY found in .env.local or environment.");
  process.exit(1);
}
console.log("Key found:", key.slice(0, 4) + "..." + key.slice(-4));
console.log("Model:", model);

const t0 = Date.now();
const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${key}`,
  },
  body: JSON.stringify({
    model,
    temperature: 0,
    max_tokens: 2048,
    reasoning_effort: "low",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          'You are a transcription sensor. Transcribe lab rows verbatim. Output JSON only: {"rows":[{"rawName":"","value":"","unit":"","rangeText":"","sourceLine":""}]}',
      },
      {
        role: "user",
        content:
          'Report text:\n<<<\nHemoglobin 10.2 g/dL (13.0 - 17.0)\nWBC 8,400 /uL (4,000 - 11,000)\n>>>',
      },
    ],
  }),
});

console.log("HTTP status:", res.status, `(${Date.now() - t0} ms)`);
if (!res.ok) {
  console.error("FAIL body:", await res.text());
  process.exit(1);
}
const body = await res.json();
const content = body.choices?.[0]?.message?.content;
console.log("Model used:", body.model);
console.log("Tokens: prompt", body.usage?.prompt_token_total ?? body.usage?.prompt_tokens, "· completion", body.usage?.completion_tokens);
console.log("--- raw content ---");
console.log(content);
console.log("--- parsed rows ---");
const parsed = JSON.parse(content);
for (const row of parsed.rows ?? []) {
  console.log(`• ${row.rawName} = ${row.value} ${row.unit} [range: ${row.rangeText || "(none)"}]`);
}
console.log("SMOKE TEST PASS");
