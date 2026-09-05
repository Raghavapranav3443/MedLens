// Groq chat-completions client (OpenAI-compatible endpoint).
// The model is an UNTRUSTED SENSOR: transcription and planning only.
// - temperature 0, bounded output, 30s timeout per attempt
// - one bounded retry with jittered backoff on 5xx/timeout only
// - 429 and flagged-unsafe inputs become typed errors, never retried
// - every response is Zod-validated upstream; JSON here, trust at the schema

import { aiUnavailable } from "@/lib/server/errors";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 4096;

export function groqModel(): string {
  return process.env.GROQ_MODEL || "openai/gpt-oss-120b";
}

export function hasGroqKey(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

interface ChatOptions {
  system: string;
  user: string;
  /** Groq supports JSON mode; the schema itself is enforced by Zod after. */
  json: boolean;
}

async function chatOnce(opts: ChatOptions): Promise<{ ok: true; content: string } | { ok: false; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY ?? ""}`,
      },
      body: JSON.stringify({
        model: groqModel(),
        temperature: 0,
        max_tokens: MAX_OUTPUT_TOKENS,
        // gpt-oss models are reasoning models; low effort keeps tokens for JSON.
        reasoning_effort: "low",
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
      }),
    });
    if (!res.ok) return { ok: false, status: res.status };
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content ?? "";
    return { ok: true, content };
  } finally {
    clearTimeout(timer);
  }
}

/** Chat completion with the bounded retry policy. Returns parsed JSON object. */
export async function chatJson(opts: ChatOptions): Promise<{ data: unknown; attempts: number }> {
  if (!hasGroqKey()) throw aiUnavailable("AI is not configured on this deployment.");

  let lastStatus = 0;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await chatOnce(opts);
    if (result.ok) {
      try {
        return { data: JSON.parse(result.content), attempts: attempt };
      } catch {
        // Malformed JSON: treat as a provider failure, retry once.
        lastStatus = 500;
      }
    } else {
      lastStatus = result.status;
      if (result.status === 401 || result.status === 403 || result.status === 429 || result.status === 400) {
        // Never retried: auth, quota, or rejected input.
        throw aiUnavailable(
          result.status === 429
            ? "The AI provider is rate-limiting this key. Try again shortly."
            : "The AI provider rejected the request.",
        );
      }
    }
    if (attempt < 2) {
      // One bounded retry with jittered backoff (5xx/timeout only).
      await new Promise((r) => setTimeout(r, 500 + Math.floor(Math.random() * 500)));
    }
  }
  throw aiUnavailable();
}
