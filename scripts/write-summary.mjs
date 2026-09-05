import { writeFileSync } from "node:fs";

const content = `// POST /api/records/:id/summary — Groq plan + server-rendered summary.
// The model returns a plan (factIds/templateIds + ≤140-char note); the server
// renders every sentence from audited templates. Invalid/failed → deterministic
// fallback. Never a regeneration loop.

import { prisma } from "@/lib/server/db";
import { requireSessionId } from "@/lib/server/session";
import { getRecordOrNotFound } from "@/lib/server/repo";
import { withRoute } from "@/lib/server/route";
import { enforceAiRateLimit } from "@/lib/server/ratelimit";
import { chatJson } from "@/lib/ai/groq";
import { summaryPlanUser } from "@/lib/ai/prompts";
import { fallbackPlan, renderSummary, type SummaryPlan } from "@/lib/ai/summary";
import { summaryPlanSchema } from "@/lib/validation/extraction";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withRoute(async (_req, ctx) => {
  const sessionId = await requireSessionId();
  const { id } = await (ctx as Ctx).params;
  const record = await getRecordOrNotFound(sessionId, id);
  await enforceAiRateLimit(sessionId, "summary");

  let plan: SummaryPlan | null = null;
  let aiAttempts = 0;

  try {
    const { data, attempts } = await chatJson({
      system:
        "You are a summary planner. Return JSON: {\\"sections\\":[\\"overview\\",\\"labs\\"],\\"note\\":\\"<=140 char connective phrase or omit\\"}. No medical interpretation.",
      user: summaryPlanUser(record.facts),
      json: true,
    });
    aiAttempts = attempts;
    const parsed = summaryPlanSchema.safeParse(data);
    plan = parsed.success ? parsed.data : null;
  } catch {
    plan = null;
  }

  const usedFallback = plan == null;
  const finalPlan = plan ?? fallbackPlan(record.facts);
  const rendered = renderSummary(record.facts, finalPlan, record.title);

  const summary = await prisma.summary.create({
    data: {
      recordId: id,
      text: rendered.text,
      note: rendered.note,
      planValid: !usedFallback && rendered.planValid,
      aiAttempts,
    },
  });

  return Response.json({ summary, planUsed: usedFallback ? "fallback" : "ai" });
});
`;

writeFileSync("src/app/api/records/[id]/summary/route.ts", content);
console.log("summary route written");
