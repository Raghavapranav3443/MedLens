# MedLens — System Architecture

## 1. Decisions and constraints

**One deployable Next.js application on Cloud Run; one managed PostgreSQL
database; one Gemini integration.** No agent framework, retrieval database,
microservices, medical knowledge engine or background queue in the four-hour
version.

This is a **proposed** stack for a greenfield project, not a claim about
installed packages. At minute zero, confirm organizer constraints, install
compatible, supported, stable versions, smoke-test them together, and commit the
lockfile. Choose the model on measured availability and reliability — not on
guesses about what the judge "prefers".

| Layer | Proposed choice | Reason / constraint |
|---|---|---|
| Application | Next.js App Router, React, TypeScript strict | One UI + API service; server-only imports explicitly protect secrets |
| Runtime | Node.js 22 LTS, Debian slim container | Same version locally, in build and at runtime; verify support before pinning |
| UI | Tailwind, small set of shadcn/Radix components | Fast, labelled forms and dialogs; manual accessibility testing still required |
| Validation | Zod, strict request and AI-output schemas | Shared types; export only the JSON Schema subset the provider documents |
| AI | `@google/genai`, one configured stable Flash model | `GEMINI_MODEL` set explicitly after a real structured-output smoke test |
| Storage | Managed PostgreSQL + Prisma | Owner-scoped persistence, transactions, schema migrations; follow the provider's TLS and pooling guidance |
| DB adapter | `pg`, plus `@prisma/adapter-pg` if the pinned Prisma requires it | Test generation, build and runtime together; never mix major-version tutorials |
| Session | Opaque random server session in an HttpOnly cookie | Zero login friction; database stores only the token hash; this is not verified patient identity |
| PDF | `unpdf`, text-layer PDFs only in the committed scope | No model-based OCR dependency; unsupported scans get a clear paste/manual path |
| Tests | Vitest, Testing Library, Playwright with axe | Pure logic, API security behaviour and real browser workflows |
| Deployment | Docker standalone Next build, Cloud Run + Secret Manager | No secrets in the build context; managed DB persists across revisions |

**Scope trade-off, stated plainly:** no passwords, registration or clinician
roles in the MVP. Anonymous session ownership is *real* access isolation, but it
is not account recovery, identity verification or clinical authorization.
Persistent personal accounts are stretch scope through a managed identity
provider — never hand-rolled credential storage under deadline pressure.

## 2. Runtime flow and trust boundaries

```text
Browser (untrusted; synthetic data only on the competition deployment)
  -> consent + anonymous session
  -> intake / pasted report / bounded text-layer PDF upload
  -> Route Handler: session check, origin check, size/type limits, Zod,
     ownership check, quota check
  -> local parsing + best-effort identifier masking with an offset map
  -> owner-scoped extraction cache / concurrent-request deduplication
  -> Gemini structured extraction  (output is untrusted until validated)
  -> schema validation + source-row evidence validation
  -> deterministic layers: aliases, reported ranges, conflict flags,
     gap questions, report comparison
  -> transaction: record revision + source document + extracted facts
  -> Gemini constrained summary PLAN (allowed fact IDs + template IDs only)
  -> server validation + trusted template rendering, or deterministic fallback
  -> source-linked record + review queue + printable handoff

Edit -> revision-checked transaction -> audit entry + corrected fact
     -> recompute derived outputs -> invalidate old summary -> re-render
```

**The model never produces medical classifications.** Gemini gets no tools, no
URL fetching, no database access, and report text never becomes instructions
(all source text is treated as untrusted, including text that says "ignore
previous instructions").

**Call accounting (normal text/PDF path):** one extraction call per uncached
report, one summary-plan call per changed record when the user requests a
summary. Processing one report therefore costs two calls; two reports cost two
extraction calls plus one combined summary call. One bounded extraction retry
may add a call. If summarization fails, deterministic sentence templates render
instead — no regeneration loop. The UI reports **actual** attempt counts and
cache hits; the copy promises no hard two-call ceiling. No retry on 401/403 or
flagged-unsafe input.

**Four-hour resource budget:** 2 reports per record · 5 PDF pages per report ·
5 MiB per report · 40,000 extracted characters per report · 100 lab rows per
report · bounded output string lengths · 30-second provider timeout per attempt
· 75-second end-to-end processing deadline. Reject over-limit inputs **before**
any AI call, and stream-limit upload bodies rather than buffering unbounded.

## 3. File layout

Single Next.js app; logic separated so the engines stay pure and testable.

```text
medlens/
├─ src/
│  ├─ app/                        # Thin routes; logic lives in lib/
│  │  ├─ page.tsx                 # Consent, sample fixtures, how-it-works
│  │  ├─ record/[id]/page.tsx     # Workspace: source | structured split view
│  │  ├─ record/[id]/print/page.tsx
│  │  └─ api/
│  │     ├─ records/route.ts                  POST create record (intake)
│  │     ├─ records/[id]/route.ts             GET / PATCH / DELETE
│  │     ├─ records/[id]/sources/route.ts     POST pasted text | PDF
│  │     ├─ records/[id]/facts/[factId]/route.ts  PATCH review/correct
│  │     ├─ records/[id]/summary/route.ts     POST plan + render summary
│  │     └─ health/route.ts
│  ├─ components/                 # RecordView, FactRow, EvidencePopover,
│  │                              # ProvenanceChip, ReviewQueue, DiffText
│  ├─ lib/
│  │  ├─ engines/                 # PURE functions only (no I/O, no AI):
│  │  │  ├─ aliases.ts  units.ts  ranges.ts
│  │  │  └─ conflicts.ts  gaps.ts  compare.ts
│  │  ├─ ai/                      # client.ts, schemas.ts, prompts.ts
│  │  ├─ ingest/                  # pdfText.ts, limits.ts, masking.ts
│  │  ├─ server/                  # session.ts, ratelimit.ts, repo.ts,
│  │  │                           # errors.ts, log.ts (redacting)
│  │  └─ validation/              # request.ts, extraction.ts (zod)
│  └─ types/
├─ prisma/schema.prisma
├─ tests/                         # unit/  api/  e2e/
├─ fixtures/                      # synthetic reports (with & without ranges)
├─ Dockerfile
├─ .env.example
└─ docs/                          # PRD, ARCHITECTURE, IMPLEMENTATION_PLAN
```

Engines import nothing but types and data files. Route handlers do
**session → validate → engine → persist** and nothing else. That boundary is
what makes the "unit-tested core" claim real instead of rhetorical.

## 4. Data model (Prisma sketch)

```prisma
model Session {            // anonymous; cookie token stored hashed
  id         String   @id
  createdAt  DateTime @default(now())
  lastSeenAt DateTime @default(now())
  records    Record[]
}

model Record {
  id        String   @id @default(cuid())
  sessionId String
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  title     String
  status    String   @default("draft")   // draft | reviewed
  revision  Int      @default(0)          // optimistic concurrency
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  sources   SourceDocument[]
  facts     Fact[]
  audits    AuditEvent[]
  @@index([sessionId, createdAt])
}

model SourceDocument {
  id         String    @id @default(cuid())
  recordId   String
  record     Record    @relation(fields: [recordId], references: [id], onDelete: Cascade)
  kind       String    // pasted_text | pdf_text
  rawText    String
  sha256     String
  reportedAt DateTime?
  createdAt  DateTime  @default(now())
  facts      Fact[]
}

model Fact {
  id            String  @id @default(cuid())
  recordId      String
  sourceDocId   String?
  sourceDoc     SourceDocument? @relation(fields: [sourceDocId], references: [id])
  kind          String  // lab | symptom | medication | allergy | condition | note
  rawName       String
  canonicalName String? // null when unknown — never guessed
  value         String?
  unit          String?
  rangeText     String? // verbatim from source, if reported
  rangeLow      Float?
  rangeHigh     Float?
  status        String? // low | normal | high | unknown | unparseable | null
  evidenceStart Int?
  evidenceEnd   Int?
  origin        String  // user | ai | heuristic
  verified      Boolean @default(false) // evidence-matched to source
  review        String  @default("unreviewed") // unreviewed | confirmed | corrected | flagged
  confidence    Float?
  corrections   Int     @default(0)
  @@index([recordId, kind])
}

model AuditEvent {
  id        String   @id @default(cuid())
  recordId  String
  record    Record   @relation(fields: [recordId], references: [id], onDelete: Cascade)
  action    String   // create | extract | correct | confirm | flag | summarize | delete
  target    String?
  before    String?
  after     String?
  createdAt DateTime @default(now())
}

model ExtractionCache {
  key           String   @id // sha256(normalizedText | promptVersion | model)
  payload       String   // validated extraction JSON
  model         String
  promptVersion String
  createdAt     DateTime @default(now())
}
```

Design notes:

- **Provenance lives in columns** (`origin`, `verified`, `evidenceStart/End`,
  `sourceDocId`) — never in comments or conventions.
- `status` is derived once by the range engine at write time and stored, so
  displays and diffs are stable across requests.
- `revision` gives optimistic concurrency: a stale PATCH returns `409` instead
  of silently overwriting a human's correction.
- Every table cascades from `Record`, so the delete-my-data endpoint is one
  statement, and demo data can be purged on a timer without orphans.

## 5. API contract

All endpoints are JSON, Zod-validated, session-checked, and owner-scoped.

| Method & path | Purpose | Failure modes |
|---|---|---|
| `POST /api/records` | Create record with intake facts | 401, 422 |
| `GET /api/records/:id` | Record + facts + sources + audit trail | 401, 404 |
| `PATCH /api/records/:id` | Review/correct facts; body carries `expectedRevision` | 401, 404, 409, 422 |
| `DELETE /api/records/:id` | Cascade delete (right-to-delete) | 401, 404 |
| `POST /api/records/:id/sources` | Add pasted text or text-layer PDF | 401, 404, 413, 422, 429 |
| `POST /api/records/:id/summary` | Plan + render the summary | 401, 404, 409, 429, 503 |
| `GET /api/health` | Liveness + config sanity; zero PHI | — |

Uniform error envelope:

```json
{ "error": { "code": "validation_error", "message": "…",
             "fieldErrors": { "age": "must be 0–120" } } }
```

Codes: `unauthenticated`, `not_found`, `conflict`, `payload_too_large`,
`validation_error`, `rate_limited`, `ai_unavailable`.

- **Owner mismatch returns `not_found`** — never reveal that a record exists
  for another session.
- `409` carries the current revision so the client can offer a re-read.
- `429` includes `Retry-After`; AI routes are per-session rate-limited via
  in-database counters (no external cache dependency to deploy).
- The pasted path caps body size at the same limit as uploads; reject **before**
  buffering without bound.

## 6. Deterministic engines (pure functions, unit-tested, zero AI)

**`aliases.ts`** — curated map (`Hb`, `HGB`, `Haemoglobin`, `Hemoglobin (Hb)` →
`hemoglobin`). Matching is case/punctuation-insensitive; ambiguous abbreviations
match only exactly. Unknown analytes are kept verbatim with
`canonicalName: null` — never dropped, never guessed.

**`ranges.ts`** — parses **only ranges reported in the source**:

| Reported form | Parsed as |
|---|---|
| `13.0 - 17.0`, `13–17`, `13 to 17` | closed interval |
| `< 200`, `≤ 5.7`, `up to 150` | upper bound |
| `> 40`, `>= 60` | lower bound |
| `Negative`, `Non-reactive`, `Nil` | qualitative token |
| *(absent)* | `no_reference_provided` |

Statuses: `low | normal | high | unknown | unparseable | qualitative_mismatch |
no_reference_provided`. **The app invents no thresholds** — no "critical" bands,
no age/sex reference tables. `deviation` (distance from the nearest bound, and %
of the reported range width) exists for display and sorting only; sorting
outside-range findings first is a presentation choice, **not** a clinical
significance ranking.

**`units.ts`** — converts only when a documented, exact factor exists for the
analyte family (e.g. `g/dL ↔ g/L` ×10); otherwise marks the pair
`not_comparable`. No silent conversions, ever.

**`conflicts.ts`** — deterministic flags, each citing both sides, never
resolving:

| Rule | Detects |
|---|---|
| `R1` | Allergy documented in a source vs intake "no known allergies" |
| `R2` | Same analyte twice in one report, divergent values beyond tolerance |
| `R3` | Date anomalies: future date, or previous ≥ current report date |
| `R4` | Sex-specific test vs recorded sex → "confirm the correct report" |
| `R5` | Medication in a report absent from intake (and vice-versa) → clarify |
| `R6` | Value present without a unit → clarify |
| `R7` | Unit incompatible with the analyte's unit family → verify transcription |
| `R8` | Text cites an earlier report that was not provided → invite upload |

R4/R5/R7/R8 are phrased as **clarification requests, not conclusions** — there
is no drug-interaction engine and no identity assertion anywhere in the system.

**`gaps.ts`** — clarification questions derived from the structured record
(symptom without onset, medication without dose, abnormal analyte with no prior
value), each rendered with its trigger citation. Maximum five, prioritized.

**`compare.ts`** — joins on `canonicalName`, applies `units.ts`, reports
`delta`, `direction`, and **`statusTransition`** vs the previously reported
range (`normal → low` matters more than a large normal-to-normal swing — a
sorting choice, not a significance claim). Non-comparable pairs are listed as
such instead of being dropped.

## 7. AI contracts

### 7.1 Extraction — transcription only

- **Structured output** with the provider-documented JSON Schema subset; the
  Zod schema is mirrored into `responseSchema` via the SDK's converter.
- Prompt rules: transcribe rows exactly as printed; copy reference-range
  strings **verbatim**; supply the `sourceLine` each row came from; do not
  compute statuses, convert units, or supply missing ranges.
- Low temperature; bounded `maxOutputTokens`.
- **Validation:** Zod-parse the response; rows then pass evidence validation
  (Architecture §2). Rows failing validation are kept with
  `verified: false` and `review: "unreviewed"` — quarantined, never silently
  accepted, never silently dropped; counts are surfaced in the UI.
- **Retries:** one bounded retry with jittered backoff on provider 5xx/timeout
  only. 429 and flagged-unsafe inputs are not retried; they become typed errors.
- **Degraded path (stretch):** if the provider is unavailable, a regex extractor
  handles classic `Name Value Unit Range` lines, marked `origin: heuristic`,
  `verified: false` — visible, reviewable, and excluded from summaries.

### 7.2 Summary — the model plans, the server writes

The single worst reliability idea in the original draft was "generate a summary
and regex-lint it for safety claims." Filtering arbitrary generated medical
prose cannot be made trustworthy in four hours, so MedLens does the opposite:

- The summary call receives **structured, evidence-verified data only** and
  returns a **plan**: an ordered list of `{ factIds, templateId }` plus at most
  one optional connective note bounded to 140 characters.
- The server renders the summary from a **small, pre-audited template set**
  (`"Hemoglobin is 10.2 g/dL, below the 13–17 g/dL range printed on your
  report."`), ending with the scope disclaimer.
- An invalid plan, a failed call, or a note that trips the bounded clinical-
  phrase guard ⇒ deterministic template summary. No regeneration loop.
- Because every sentence is server-owned, the summary **cannot** diagnose,
  prescribe or assert certainty — the guarantee is structural, reviewable in
  the repo, and honest about its limits.

### 7.3 Image / scanned-document OCR (stretch, default off)

A multimodal pass would transit identifiers before any masking can apply. If
enabled, the UI states that plainly before the upload; otherwise the paste path
is offered. This is stated in copy — not silently shipped.

## 8. Security and privacy model

- **Sessions:** opaque random 256-bit token in an `HttpOnly; Secure;
  SameSite=Lax` cookie; only its SHA-256 is stored. CSRF posture: SameSite plus
  strict same-origin checks on mutating routes; no cross-site form posts.
- **Secrets:** `GEMINI_API_KEY`, `DATABASE_URL` live only in server-only
  modules; nothing secret is ever `NEXT_PUBLIC`-exported. `.env.example`
  committed, real `.env` ignored, Cloud Run pulls from Secret Manager at
  runtime (never baked into the image or build args).
- **Rate limiting:** per-session counters on AI routes (in-database), with
  honest `429` + `Retry-After`.
- **Upload safety:** size/page/character caps, mime allow-list, magic-byte
  sniffing, parser isolation (`unpdf` failures are caught and reported as typed
  errors, never crashes).
- **Logging:** structured, leveled, and redacted — identifiers never reach
  logs; request IDs correlate a trace without carrying PHI.
- **Deletion:** `DELETE /api/records/:id` cascades everything; a `DELETE
  /api/session` clears the session's data set.
- **Honest privacy statement** (goes in the README and the UI footer): this is
  a hackathon prototype running on **synthetic data**; masking is best-effort,
  no HIPAA/GDPR compliance is claimed; real patient data should not be
  uploaded. Overclaiming compliance would itself be a safety failure.

## 9. Testing strategy

| Suite | Covers |
|---|---|
| `tests/unit` | Range parser (all forms + junk), unit converter (exact factors + incompatibles), alias resolver, masker (offsets stay aligned), conflict rules R1–R8, gap analysis, comparison joins, cache key stability |
| `tests/api` | 401 unauthenticated, 404 cross-session access, 409 stale-revision PATCH, 413 oversized upload, 422 bad payloads, 429 rate limit, mock-AI failure → typed `ai_unavailable`, no identifiers in log output |
| `tests/e2e` (Playwright + axe) | Consent → load sample fixture → see structured record → click a finding → evidence highlights → correct a value → audit entry appears → summary regenerates → print handoff; axe scan on every page |

Coverage gate: **≥ 80 % lines on `src/lib/engines` and `src/lib/validation`** —
the pure core. Gating coverage on UI glue would be theatre; gating it on the
logic that computes medical statuses is not.

## 10. Sources and assumptions

- **Cloud Run** (deploy from source, container contract): port from `$PORT`,
  stateless containers — the local filesystem is **ephemeral and in-memory**,
  so persistence lives in the managed database, not on disk; request timeouts
  are configurable but finite, hence the 75-second processing deadline.
  docs: `cloud.google.com/run/docs/deploying-source-code`,
  `cloud.google.com/run/docs/container-contract`
- **Gemini structured output**: supported JSON Schema subset (string, number,
  integer, boolean, object, array, null-able unions; enums; min/max);
  Google's own guidance: *"while output is syntactically correct JSON, always
  validate values in your application"* — exactly what the validation and
  evidence layers do. docs: `ai.google.dev/gemini-api/docs/structured-output`
- **Gemini API terms**: developer service; verify the current data-use terms
  yourself before touching any real data — this plan assumes none is used.
  docs: `ai.google.dev/gemini-api/terms`
- **Unconfirmed assumptions** (from the organizer brief, treated as planning
  inputs, not verified facts): 4-hour window, two submissions with latest-
  counts scoring, Cloud Run as the required target, and AI-assisted Round-1
  judging. None of the strategy depends on the judge being a particular model.

