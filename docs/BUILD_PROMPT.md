# MedLens — Build Prompt (for the implementing AI agent)

> This is the execution prompt for the build. It supersedes the organizer's
> low-level draft prompt, which it restructures around four changes:
> (1) safety is enforced by architecture, not by asking the model nicely;
> (2) the AI is scoped to transcription and planning only — classification,
> ranges, conflicts and summary text are server-owned;
> (3) every claim in the submission must be backed by a test, fixture or
> verifiable artifact — no unverifiable claims anywhere;
> (4) the plan is phase-gated for a 4-hour window with explicit triage and a
> two-attempt submission strategy.

## Role and mission

You are implementing **MedLens**, an AI-powered clinical *information
intelligence* system, as a single deployable Next.js application on Google
Cloud Run. Mission: turn fragmented medical information — an intake form, a
current lab report, optionally a previous one — into a structured,
traceable, human-reviewable patient record. MedLens organizes and explains;
it never diagnoses, prescribes, or ranks clinical significance. It is not a
doctor and must never look like one pretending.

Authoritative specs, in precedence order: `PRD.md` (features, acceptance
criteria) → `ARCHITECTURE.md` (stack, boundaries, data model, AI contracts) →
`IMPLEMENTATION_PLAN.md` (phase gates, timing, triage). Where they conflict,
the more conservative reading wins.

## Non-negotiable constraints

1. **Stack discipline.** Next.js (App Router, TypeScript strict) + Tailwind +
   Zod + Prisma on managed PostgreSQL + `@google/genai` + `unpdf` + Vitest/
   Testing Library/Playwright + Docker on Cloud Run. Confirm compatible,
   supported versions at minute zero; commit the lockfile; never mix major-
   version tutorials.
2. **The model is an untrusted sensor.** Gemini transcribes report rows
   (structured output, temperature 0) and produces a summary *plan*. It never
   computes statuses, never supplies reference ranges, never converts units,
   never writes user-facing summary sentences. All reasoning is pure,
   unit-tested server code (`src/lib/engines/*` — no I/O, no AI imports).
3. **Evidence or quarantine.** Every extracted row must match source text
   (evidence span containing value and range) to be `verified`; unmatched
   rows are quarantined — visible, unreviewed, excluded from summary and
   comparison. Nothing is silently dropped or silently trusted.
4. **No invented ranges — structural, not aspirational.** Ranges are parsed
   from the source only. A row whose source has no range renders
   `no_reference_provided`, always. The repo contains no reference-range
   tables, no "critical" thresholds, no age/sex norms.
5. **Sessions, not passwords.** Opaque server session in an HttpOnly `Secure`
   cookie, token stored hashed, every query owner-scoped through the
   repository layer. State plainly in the README that this is access
   isolation, not identity verification.
6. **Least data egress.** Best-effort identifier masking with an offset map
   before any bytes reach the model; content-hash extraction cache; the UI
   shows what left the server and labels masking "best effort".
7. **Honesty as a spec.** No claim in code, UI or README that the repo can't
   verify. No HIPAA/GDPR claims. Synthetic data only on the deployed app;
   the privacy statement says so. Uncertainty is displayed, never rounded
   into confidence.
8. **Deadlines are resources.** Follow the phase gates in
   `IMPLEMENTATION_PLAN.md`; when a phase overruns, drop Tier-2 items per the
   triage ladder — never the core. Deploy first, re-deploy every phase.

## The one-script demo every phase must protect

Consent → click the conflicting-prior fixture → structured record renders
with provenance chips and `no_reference_provided` rows → conflict card cites
both sides → hover a finding highlights its source span → correct a value →
audit entry + coverage meter update → template summary with disclaimer →
print one-pager. If the build is ever forced to shrink, it must still run
this script from the deployed URL.

## What the original draft got wrong — carried forward as explicit instructions

The organizer's draft prompt, followed literally, produces "Upload Report →
Send to AI → Display Summary" with regex safety linting. The corrections:

- ❌ "Generate a summary, then lint it for diagnosis words, regenerate on
  failure" → ✅ **plan-and-template rendering**: the model returns
  `{ factIds, templateId }` plus one ≤140-char note; the server writes every
  sentence from audited templates. A failed plan falls back to deterministic
  text. Unsafe phrasing becomes structurally impossible instead of
  regexp-guessable.
- ❌ "Ask the AI not to invent reference ranges" → ✅ ranges parsed from
  source only; evidence matching rejects invented ranges at the code layer.
- ❌ "LLM pass for semantic conflicts" → ✅ eight deterministic rules R1–R8,
  each citing both sides, flagging without resolving. No drug-interaction
  engine, no identity assertions. Nothing semantic is promised.
- ❌ "PHI redaction" as a claim → ✅ best-effort identifier masking, labelled
  as such, with a diff preview of egress and a synthetic-data-only statement.
- ❌ "Retry on 429" → ✅ retry once on 5xx/timeout only; 429 and
  flagged-unsafe inputs become typed errors; the UI reports *actual* attempt
  counts; no hard call ceiling is claimed.
- ❌ Feature-count flexing → ✅ Tier-2 items are explicitly droppable;
  the anti-features paragraph (no chatbot, no symptom checker, no risk
  scores, no bundled norms) ships in the README.

## Deliverables

1. The application, deployed on Cloud Run, running the one-script demo.
2. Green test suite: unit (engines + validation, ≥ 80 % lines), API security
   matrix (401/404/409/413/422/429, mocked-AI failure), Playwright e2e with
   axe. One command reproduces all of it.
3. README: claims-to-proof format (every claim + its reproduction command),
   anti-features paragraph, honest privacy statement, coverage number,
   deployed URL, local run instructions, CHANGELOG for the second submission.
4. Docs as shipped: `PRD.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`.
5. Submission hygiene: git tags `submission-1`/`submission-2`, secrets only
   in Secret Manager, `.env.example` committed, client bundle grep-proven
   key-free, rollback tested.

## Working method

- Phase-gated: end each phase with green tests, a commit, and a deploy. If a
  phase is slipping, consult `IMPLEMENTATION_PLAN.md` §9 and cut downward.
- Table-driven tests alongside the code they cover — the range parser and
  its 25+ cases are one artifact, not two tasks.
- Fixtures over mocks wherever deterministic (real synthetic report text in
  `fixtures/`); mock only the model client.
- When uncertain between two implementations, choose the one that is easier
  to prove correct with a test, and say so in the commit message.
- Never mark a task complete without running its verification. Report actual
  results, including failures — the submission's credibility is worth more
  than any single feature.

*End of build prompt.*
