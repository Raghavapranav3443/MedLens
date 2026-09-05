// List models available to this Groq key. Never prints the key.
import { readFileSync } from "node:fs";

let key = process.env.GROQ_API_KEY;
try {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*(GROQ_API_KEY)\s*=\s*"?([^"\r\n]*)"?\s*$/);
    if (m && m[2]) key = m[2];
  }
} catch {}
if (!key) {
  console.error("FAIL: no GROQ_API_KEY");
  process.exit(1);
}
const res = await fetch("https://api.groq.com/openai/v1/models", {
  headers: { Authorization: `Bearer ${key}` },
});
console.log("HTTP status:", res.status);
if (res.ok) {
  const body = await res.json();
  for (const m of body.data ?? []) {
    console.log(`• ${m.id}  (context ${m.context_window ?? "?"})`);
  }
} else {
  console.error(await res.text());
}
