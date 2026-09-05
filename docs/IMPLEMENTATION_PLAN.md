# MedLens — Implementation Plan

Companion documents: `PRD.md` (what to build) · `ARCHITECTURE.md` (how it fits
together) · `BUILD_PROMPT.md` (the execution prompt derived from all three).

## Ground rules for every phase

- **Deploy first, deploy often.** A "hello-world" Next.js container is on
  Cloud Run before minute 15; every later phase re-deploys. The most common
  hackathon catastrophe — a working laptop app that never deploys — is
  structurally impossible in this plan.
- **Vertical slices over horizontal layers.** By the end of Phase 2 a judge
  can paste a report and see a structured record. Every later phase improves
  that slice instead of deferring demoability.
- **Each phase ends with a commit and a green check**, so any phase can be
  abandoned at its boundary without leaving the repo broken.
- **Timeboxing is a hard budget.** If a phase overruns, its Tier-2 items drop
  per the triage ladder (§9) — the core never borrows from the polish.

## Phase timeline (240-minute build window)

| Phase | Clock | Outcome |
|---|---|---|
| 0 — Scaffold & deploy skeleton | 0:00–0:15 | Deployable app + verified AI access |
| 1 — Data model, sessions, API skeleton | 0:15–0:45 | Persisted, owner-scoped records |
| 2 — Core vertical slice | 0:45–1:15 | Paste → extract → structured record (demoable) |
| 3 — Deterministic engines + record UI | 1:15–1:45 | Range status, conflicts, gaps, provenance chips |
| 4 — Human review loop + PDF upload | 1:45–2:15 | Editable, audited, verified record |
| 5 — Summary, comparison, print, extras | 2:15–2:45 | The full story |
| 6 — Tests, accessibility, README | 2:45–3:10 | Evaluable quality signals |
| 7 — Production hardening on Cloud Run | 3:10–3:35 | Deployed, smoke-tested, honest docs |
| 8 — Buffer + submission 1 | 3:35–3:50 | Stable submission packaged |
| 9 — Second-attempt polish | 3:50–4:00 + post-submission | Strictly better final submission |

---

## Phase 0 — Scaffold & deploy skeleton (0:00–0:15)

1. Confirm the exact organizer constraints that affect the stack (runtime
   version, required region, deadline mechanics). Do not guess.
2. `create-next-app` (App Router, TypeScript strict, Tailwind, ESLint);
   install Zod, Prisma, `@google/genai`, `unpdf`, Vitest; install the
   database driver the pinned Prisma version requires. **Smoke-test the
   generated app builds and boots before adding anything.**
3. Create the managed Postgres instance (Cloud SQL or a serverless provider);
   run `prisma migrate dev` on an empty placeholder schema; put
   `DATABASE_URL` and `GEMINI_API_KEY` in the environment only — never in the
   repo.
4. Write a 20-line script that sends a two-line fake report to the chosen
   Gemini model with a minimal structured-output schema and prints the parsed
   result. **This validates model availability, SDK version and schema support
   before any application code depends on them.** If the first-choice model
   name fails, switch here — it costs two minutes now and an hour later.
5. Write the minimal `Dockerfile` (standalone Next output, non-root user, port
   from `$PORT`), deploy to Cloud Run, verify the URL serves the page and
   `/api/health` returns JSON.

**Definition of done:** deployed URL responds; health check green; AI smoke
script parsed one structured response; lockfile committed; `.env` git-ignored
with `.env.example` committed.

## Phase 1 — Data model, sessions, API skeleton (0:15–0:45)

1. Write the full Prisma schema (Session, Record, SourceDocument, Fact,
   AuditEvent, ExtractionCache — see `ARCHITECTURE.md` §4) and migrate.
2. `lib/server/session.ts`: opaque random token, SHA-256 stored, HttpOnly
   `Secure; SameSite=Lax` cookie, 30-day sliding `lastSeenAt`.
3. `lib/server/repo.ts`: owner-scoped queries only — every function takes
   `sessionId`, and cross-session reads are structurally impossible.
4. `lib/server/errors.ts` + `lib/validation/request.ts`: typed error envelope,
   Zod parsers per route.
5. Route skeletons for all seven endpoints from `ARCHITECTURE.md` §5, each
   returning the envelope on failure. Wire per-session rate limiting on AI
   routes (in-database counters).
6. Vitest scaffolding; first tests: session round-trip, 401 without cookie,
   404 on another session's record.

**Definition of done:** `POST /api/records` creates a record from a JSON
intake payload; `GET` with a foreign session returns `404`; tests green.

## Phase 2 — Core vertical slice (0:45–1:15)

*Goal: paste a lab report, see a structured record. Everything else is
enhancement; this is the product.*

1. Intake form (client component) → `POST /api/records` with Zod validation on
   both sides; fields stamped `origin: user` at write time.
2. `lib/ingest/limits.ts`: byte/character caps enforced before anything else;
   paste path first.
3. `lib/ingest/masking.ts`: intake-name + pattern-based identifier masking
   with an offset map; unit-test the offsets stay aligned.
4. `lib/ai/client.ts` + `schemas.ts` + `prompts.ts`: structured-output
   extraction (Phase 0 script generalized); temperature 0; transcription-only
   prompt; **no status, no ranges, no conversions from the model**.
5. `lib/validation/extraction.ts`: Zod-parse the response, then
   `lib/server/evidence.ts`: evidence matching → `verified` rows with spans,
   unverified rows quarantined (never dropped).
6. Persist: SourceDocument (raw text, sha256) + Fact rows + `extract` audit
   event — one transaction.
7. Minimal record page: lab table + provenance chips + unverified quarantine
   section. Ugly is fine; correct and traceable is not negotiable.
8. Extraction cache write/read on the text hash.

**Definition of done:** from the deployed URL, paste the CBC fixture → record
page renders rows with correct values, verbatim ranges, provenance chips, and
unverified rows visibly quarantined; re-pasting the same text shows a cache
hit and makes no AI call.

## Phase 3 — Deterministic engines + record UI (1:15–1:45)

1. `lib/engines/ranges.ts` + `tests/unit/ranges.test.ts` **together** — the
   parser and its 25+ table-driven cases are written as one artifact.
2. `aliases.ts` (~90-analyte JSON), `units.ts` (exact factors only).
3. `conflicts.ts` (R1–R8) + `gaps.ts` (max 5, trigger-cited), each with unit
   tests against fixture records.
4. Recompute statuses on extraction (write-time derivation, stored).
5. Real record UI: sections (Patient · Symptoms · Conditions · Allergies ·
   Medications · Labs · Observations · Flags), outside-range findings sorted
   first with the "display choice, not clinical ranking" tooltip, conflict
   cards citing both sides, clarification list with triggers.
6. Side-by-side view: source pane + structured pane, hover-to-highlight via
   stored spans.

**Definition of done:** the two fixtures (with ranges / without ranges) render
correct statuses including `no_reference_provided`; the conflicting-fixture
produces a visible conflict card; every engine has passing unit tests.

## Phase 4 — Human review loop + PDF upload (1:45–2:15)

1. `PATCH /api/records/:id/facts/:factId` with `expectedRevision` → 409 on
   stale writes; actions: confirm · correct (with before/after + optional
   reason) · flag. Immutable AuditEvent per action.
2. Review queue ordered by (unverified first, then low confidence); coverage
   meter (`14 / 22 fields verified`); **Sign off** disabled until zero
   unreviewed remain.
3. Keyboard loop: `J`/`K` · `Enter` · `E` · `F`; visible focus states.
4. PDF text-layer upload: magic-byte sniff, `unpdf`, page/char caps, then the
   identical pipeline as paste; typed failure message offering the paste path
   when extraction comes back empty.

**Definition of done:** correcting a value updates the row, appends an audit
entry, bumps the coverage meter; a stale PATCH returns 409; the PDF fixture
extracts end-to-end; e2e test records the whole loop.

## Phase 5 — Summary, comparison, print, extras (2:15–2:45)

1. Summary: `POST /api/records/:id/summary` → plan-and-template rendering
   (`ARCHITECTURE.md` §7.2); clinical-phrase guard on the connective note with
   deterministic fallback; unit tests for the renderer and the guard.
2. `compare.ts` + comparison table UI (status transitions outrank deltas;
   non-comparable pairs listed as such).
3. `/record/[id]/print` — print CSS one-pager, provenance footnotes, coverage
   meter, disclaimer, record hash. No PDF library.
4. Sample fixtures (3 one-click loads), Demo Mode banner, glossary popovers,
   call-accounting chip (`AI calls: 2 · cache hits: 1`).
5. Re-run all deterministic layers after corrections **without** new
   extraction calls.

**Definition of done:** summary renders from templates with correct values and
the disclaimer; comparison table joins the two-report fixture correctly;
print route prints cleanly; fixtures demo the whole story in under two
minutes.

## Phase 6 — Tests, accessibility, README (2:45–3:10)

1. Coverage gate on `src/lib/engines` + `src/lib/validation` (≥ 80 % lines);
   fill the gaps the earlier phases left.
2. API security tests: 401/404/409/413/422/429 matrix; mocked-AI failure →
   typed `ai_unavailable`; log-output assertion that no identifier appears.
3. Playwright e2e: consent → fixture → review → correct → summary → print;
   axe scan on every page; fix what axe finds (labels, contrast, focus order,
   `aria-live`).
4. README: honest claims only — what it does, what it refuses to do, the
   no-reference-ranges guarantee, the synthetic-data-only statement, test
   coverage number, one-command local run, deployed URL. The anti-features
   paragraph from the PRD goes here verbatim.

**Definition of done:** full test suite green in CI-able one command; axe
clean; README makes zero claims the repo can't prove.

## Phase 7 — Production hardening on Cloud Run (3:10–3:35)

1. Final Dockerfile review: standalone output, non-root user, `$PORT`
   binding, no build secrets in layers, health check route.
2. Secret Manager wiring for `GEMINI_API_KEY` + `DATABASE_URL`; minimum
   instances 0–1; concurrency default; request timeout ≥ processing deadline
   (75 s) + margin; region per organizer requirement.
3. Managed-DB hardening: TLS enforced, connection pooling per provider
   guidance, least-privilege user.
4. Security headers verified on the live URL (CSP, HSTS, XCTO,
   Referrer-Policy); client bundle grep-proven free of the API key.
5. Deployed-URL smoke test: all three fixtures, one correction, one summary,
   one print — on the production URL, not localhost.
6. Purge path: verify delete-my-record and delete-my-session work in prod.

**Definition of done:** the live URL completes the full demo script; secrets
exist only in Secret Manager; headers verified; rollback to the previous
revision tested once (it's one command — prove it works).

## Phase 8 — Buffer + submission 1 (3:35–3:50)

1. Freeze features. Full suite + deployed smoke test one final time.
2. Package the submission exactly per organizer mechanics (URL + repo +
   any form fields). **Submission 1 goes in here — stable and complete.**
   See §8 for why.
3. Tag the repo `submission-1`; note the revision that is live.

## Phase 9 — Second-attempt polish (3:50–4:00 + any post-submission window)

Only strictly additive, verified improvements (see §8): stretch features that
are already tested (stretch OCR toggle default-off, search/⌘K, timeline view),
README screenshots, one more axe pass, dependency-audit cleanliness. Re-run
everything, deploy, verify the live URL again, then submit attempt 2 — or
don't, if nothing genuinely improved (§8).

---

## §8 — The double-submission strategy

The rules: two attempts maximum, and **the latest submission's score counts**.
That asymmetry shapes everything — attempt 2 is not "a second chance", it is
"the score that stands". The strategy therefore treats attempt 1 as
**insurance**, not as a try:

1. **Attempt 1 = the tested, deployed, stable build (Phase 8, ~3:35).** It is
   complete against every core requirement, fully tested, and live on Cloud
   Run. Its purpose is to guarantee that *something scored* exists even if
   everything goes wrong in the final 25 minutes — a crashed build, a bad
   deploy, a broken refactor, a deadline misjudged.
2. **Never submit anything untested as attempt 2.** "Latest counts" means an
   untested attempt 2 can erase a good attempt 1 score. The rule is simple:
   *attempt 2 must be provably ≥ attempt 1 on every criterion before it is
   submitted, or it is not submitted.*
3. **What goes into attempt 2** (Phase 9): only additive, already-tested work
   — stretch features that finished with tests (timeline view, ⌘K search,
   glossary, stretch OCR toggle default-off), README screenshots of the live
   app, one more axe pass, an empty `npm audit`. Small, verifiable deltas.
4. **The decision gate:** if, at the deadline, attempt 2's improvements are
   cosmetic or unverified — *do not submit it*. A deliberate non-submission
   is a valid play when the standing submission is stronger. Attempt 1's
   score standing is a win; a half-baked attempt 2 is not.
5. **If disaster strikes early** (environment failure, model outage at 1:00):
   the phase boundaries make triage clean — cut everything after Phase 3,
   harden what exists, and submit the paste-path core. A smaller *reliable*
   system outranks a larger broken one under every stated criterion.
6. **Version hygiene for evaluators:** git tags `submission-1` /
   `submission-2`, a CHANGELOG naming what changed between attempts, and the
   deployed URL pointing at the latest revision. An evaluator who can diff
   the two attempts in one paragraph scores the judgement, not just the code.

## §9 — Triage ladder (when the clock is winning)

Drop order — cut from the top until the phase fits again. **Never cut upward**
(nothing above the line is traded to save anything below it).

```text
CUT FIRST  (Tier-2 extras)     glossary · ⌘K search · timeline view ·
                               stretch OCR · call-accounting chip polish
CUT NEXT   (Tier-1 polish)     keyboard shortcuts beyond J/K/E/Enter ·
                               comparison UI polish (keep the engine + table)
CUT LAST   (still shown)       side-by-side hover-highlight (keep the
                               evidence popover + provenance chips)
NEVER CUT  (the product)       intake · extraction · evidence validation ·
                               reported-range statuses · provenance ·
                               human review + audit · honest summary ·
                               tests for the above · deployed URL
```

Corollary: the "what makes a strong submission" bar in the problem statement
lives entirely in the NEVER CUT band. If only that band ships, the submission
is still strong; if anything in it is missing, no amount of extras recovers
the score.

## §10 — Optimizing for an AI-assisted first round

The first evaluation is automated (per the brief, likely Gemini-based), scored
on Code Quality, Security, Efficiency, Testing, Accessibility and Problem
Alignment. The honest way to score well with an automated reviewer is to make
the evidence **mechanically discoverable** — the same things a human jury
would check, arranged so a reviewer (human or model) finds them in minutes:

1. **A claims-to-proof README.** Every claim sits next to its proof: coverage
   number + the command that reproduces it; security posture + the grep
   one-liner; the no-invented-ranges guarantee + the fixture that
   demonstrates it; the deployed URL + the smoke-test script. An evaluator
   should never have to *believe* — only *check*.
2. **Docs that state their own limits.** `PRD.md`/`ARCHITECTURE.md` name what
   is out of scope, what is best-effort (masking), what is unverified
   (organizer assumptions). Self-critical precision reads as competence to
   both AI and human reviewers — and it is simply the truthful document.
3. **Machine-readable structure.** Typed schemas in the repo, a table-driven
   test suite whose names describe behaviours, consistent naming, one-command
   setup (`npm ci && npm test && npm run build`). Reviewers — automated ones
   especially — reward repos that explain themselves without a walkthrough.
4. **The anti-features paragraph** (PRD §4.23) in the README: explicitly
   refusing chatbots, symptom checkers, risk scores and bundled reference
   ranges is the cheapest possible demonstration of problem understanding.
5. **Evidence in the UI, not only in docs:** provenance chips, quarantine
   styling, attempt counters, honest badges. The screenshot an evaluator sees
   first should *be* the differentiator.
6. **No judge-model gaming.** Prompt-injection of evaluation-flattery, hidden
   text, or claims the repo can't verify is dishonest, fragile (the reviewer
   is not a known model), and — decisively — worse engineering. Optimization
   here means *organized verifiable evidence*, nothing else.

## §11 — Final verification checklist (all boxes before either submission)

```text
[ ] Deployed URL completes the 3-fixture demo script end-to-end
[ ] npm test green; coverage number printed and quoted in README
[ ] axe clean on every route (e2e assertions enforce it)
[ ] 401/404/409/413/422/429 behaviours verified on the deployed URL
[ ] API key absent from client bundle (grep) and repo history (git log -p)
[ ] Secrets only in Secret Manager; .env not committed; .env.example is
[ ] Rollback to previous Cloud Run revision tested once
[ ] Delete-my-record and delete-my-session work in production
[ ] README claims audited line-by-line against the code (no overclaims)
[ ] Privacy statement: synthetic data only; masking best-effort; no
    compliance claims; not a medical device
[ ] Submission mechanics per organizer instructions; latest revision live
```

*End of plan.*
