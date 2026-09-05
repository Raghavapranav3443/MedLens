# MedLens — Product Requirements Document

**Version** 1.0 · **Status** Build-ready · **Build window** 4h · **Deploy target** Google Cloud Run

---

## 1. Positioning

### 1.1 One-liner

> **MedLens turns a pile of lab PDFs and half-remembered history into one
> structured, source-cited, human-verified patient record — where every number
> can be traced back to the text it came from, and the AI is never allowed to
> be the doctor.**

### 1.2 The real problem (sharper than "info is scattered")

The stated problem is fragmentation. The *operative* problem underneath it is
**trust decay**:

1. **Fragmentation** — 4 reports, 3 labs, 2 unit systems, 1 patient. Nothing lines up.
2. **Illegibility** — `MCV 78.2 fL (80–100)` is meaningless to a non-clinician.
3. **Non-comparability** — Lab A reports Hb in `g/dL`, Lab B in `g/L`, and both
   ship different reference intervals. Naive comparison is *wrong*, not just hard.
4. **Contradiction** — intake says "no allergies", the 2023 discharge note says
   penicillin. Someone must notice.
5. **Trust decay (the killer)** — the moment an AI restates a medical number
   without a receipt, the whole record becomes unusable for anything that
   matters. Fragmentation is annoying; **unverifiable output is disqualifying.**

MedLens is designed backwards from #5. Every other feature is downstream of
"can I prove where this number came from, and who checked it?"

### 1.3 What MedLens explicitly is *not*

It is an **information-intelligence and organization system**. It does not
diagnose, does not prescribe, does not adjust dosages, does not assert
certainty. These constraints are enforced by pipeline design — the model only
transcribes; classification, range parsing and summary rendering are
server-owned (see `ARCHITECTURE.md` §2, §6, §7).

---

## 2. Users

### 2.1 Primary persona — **Meera, 34, the Family Health Coordinator** (patient / caregiver)

Manages her father's diabetes + hypertension follow-ups alongside her own
thyroid panel. Receives lab PDFs on WhatsApp. No clinical training.

- **Jobs to be done:** "Which of these 22 numbers are actually off?" · "Is his
  hemoglobin worse than in June?" · "What must I ask the doctor on Friday?"
- **Pains:** Googling values → panic. Cannot tell a marginal flag from a real
  one. Forgets the penicillin allergy at every single appointment.
- **Success:** a printable one-pager she can hand across a consultation desk.
- **Design consequences:** grade-8 reading level, plain-language glossary,
  status shown as **icon + word + colour** (never colour alone), zero jargon in
  the summary, an explicit *"Questions to ask your doctor"* block.

### 2.2 Primary persona — **Dr. Arun, 41, GP reading an outside record** (clinician)

Has 6–9 minutes. Patient arrives with printouts from another city's lab.

- **Jobs to be done:** triage the packet in <60 s · spot out-of-range values and
  trend reversals · see what the patient *claims* vs what the *paper says*.
- **Pains:** he must be able to **distrust the tool efficiently**. An AI
  paragraph is useless to him; an AI paragraph with every claim footnoted to its
  source line is *faster* than reading the PDF.
- **Success:** side-by-side source ↔ structured view, one keystroke per field to
  accept or correct, conflicts surfaced and **not** auto-resolved.
- **Design consequences:** density toggle, keyboard review loop
  (`J`/`K`/`Enter`/`E`/`F`), provenance hover-highlight, deltas with status
  transitions, unverified fields visually quarantined.

### 2.3 Secondary persona — **The Reviewer / Auditor** (compliance — and, conveniently, *the judge*)

Wants to answer: *Did a human check this? Who changed what, when, from what
value? Did the AI invent anything? How many AI calls did this cost?*

- **Design consequences:** append-only `AuditEvent` log with before/after
  values, a verification-coverage meter, per-record AI-call and cache telemetry,
  an `/api/health` endpoint, and a **Provenance Report** section in the export.

> **Persona strategy note:** the rubric scores *Problem Alignment*, and vague
> "for everyone" products score badly. MedLens ships **one record, two lenses** —
> a `Patient view` / `Clinician view` toggle over the *same* verified data
> structure. One build, two personas, visibly not a chatbot.

---
## 3. Product principles (these decide every trade-off)

| # | Principle | Enforced by |
|---|---|---|
| P1 | **The AI is an untrusted sensor.** | Extracted rows must carry matching source evidence to be marked verified; unmatched rows are quarantined as unverified (§4.4). |
| P2 | **Determinism wherever determinism is possible.** | Range status, unit handling, deltas and the conflict rules are pure functions with unit tests — zero AI calls. |
| P3 | **No claim without a receipt.** | Every extracted field carries `provenance` + `evidenceText` + a character span into the raw source. |
| P4 | **AI output is a draft, never a fact.** | Field state machine `ai_extracted → confirmed / corrected / flagged`; a record cannot be signed off while unreviewed fields remain. |
| P5 | **Never invent a reference range.** | Ranges are parsed from the source only; an absent range ⇒ status `no_reference_provided`, full stop. The app bundles no reference tables. |
| P6 | **Uncertainty is displayed, not hidden.** | Confidence orders the review queue; unverified fields render in a quarantine style. |
| P7 | **Least data to the model.** | Best-effort identifier masking before text egress; content-hash cache prevents repeat calls. |
| P8 | **The model plans, the server writes.** | Summaries are rendered from pre-audited server templates selected by the model; invalid plans fall back to deterministic text (§4.8). |

---

## 4. Feature specification

### Tier 0 — MANDATORY (complete and stable before anything else)

#### 4.1 Patient intake (`user_provided` provenance)
Structured form: identifier/alias, age (or DOB), sex, symptoms (repeatable:
`text · onset · frequency · severity 1–10`), existing conditions, allergies
(`substance · reaction · severity`), medications (`name · dose · frequency`),
free notes. Zod-validated on client **and** server. Every persisted field is
stamped `source: "user_provided"` at write time — provenance is a **column**,
not a comment.

*Acceptance:* submitting age `-4` or `999` returns `400` with field-level errors
and performs no DB write.

#### 4.2 Report ingestion (paste · text-layer PDF · image*)
Three input paths converge on one `RawDocument { text, charCount, sha256, origin }`:
- **Paste** → straight through (the primary demo path).
- **PDF (text layer)** → `unpdf` extraction — deterministic, no AI call.
  Committed scope: ≤ 5 MiB, ≤ 5 pages, ≤ 40,000 extracted characters.
- **Image / scanned PDF** → stretch scope only. A multimodal pass transmits the
  raw image before any masking can apply, so if enabled, the UI says so
  explicitly before upload; otherwise the paste path is offered.

Server-side limits: size, page and character caps enforced **before** parsing
or any AI call; mime allow-list (`application/pdf`, `text/plain`; images only
in stretch scope) with **magic-byte sniffing** — never trust `Content-Type`.
Raw text is retained for evidence validation and provenance.

*Acceptance:* a `.exe` renamed to `.pdf` is rejected by the magic-byte check;
an over-limit upload is rejected with a typed error before any AI call.

#### 4.3 Schema-constrained extraction
One Gemini call using **structured output** (`responseSchema` +
`responseMimeType: "application/json"`) producing a typed `ExtractionResult`:
`labResults[] { rawName, value, unit, referenceRangeText, evidenceText, confidence }`,
`reportMeta { reportDate, labName, specimen }`, `observations[]`,
`medicationsMentioned[]`, `diagnosesMentioned[]`. Temperature `0`. The prompt
forbids computing status, forbids inferring ranges, forbids unit conversion —
**the model transcribes; the server reasons.**

#### 4.4 Evidence validation — the anti-hallucination filter *(core differentiator)*
Server-side, pre-persistence, zero AI:
1. Normalize whitespace/unicode of the source text (offsets tracked).
2. Require each extracted row's `evidenceText` to occur in the source
   (exact → whitespace-insensitive → numeric-token fallback).
3. Require the `value` and the reported `referenceRangeText` to occur inside
   that evidence span.
4. On success, store `sourceSpan {start,end}` → enables hover-to-highlight.
5. On failure the row is **quarantined**: persisted with
   `verification: "unverified"`, excluded from the summary and from comparison,
   and pushed to the top of the review queue with the reason shown.

> Evidence matching materially reduces unsupported extraction — it does **not**
> make rows clinically correct, and OCR'd scans have no strong evidence
> guarantee. Unverified rows stay visibly unresolved until a human decides;
> nothing is silently dropped and nothing is silently trusted.

#### 4.5 Normalization & terminology resolution
Local `analyte-dictionary.json` (~90 analytes) maps aliases → canonical id,
display name, LOINC code where known, canonical unit:
`Hb | HGB | Haemoglobin | Hemoglobin (Hb) → hemoglobin`. Unmatched analytes are
kept verbatim with `canonicalId: null` — never dropped, never guessed. A unit
conversion table (`g/L↔g/dL`, per-analyte `mg/dL↔mmol/L`, `10^3/µL↔/µL`) is
applied **only** for cross-report comparison; the original value and unit are
always preserved for display.

#### 4.6 Reference-range engine (pure, unit-tested) *(core differentiator)*
Parser + evaluator over range strings actually seen on real lab reports:

| Input form | Parsed as |
|---|---|
| `13.0 - 17.0`, `13–17`, `13 to 17` | closed interval |
| `< 200`, `≤ 5.7`, `Upto 150` | upper bound |
| `> 40`, `>= 60` | lower bound |
| `0.4 - 4.0 µIU/mL` | interval + unit cross-check |
| `Negative`, `Non-reactive`, `Nil` | qualitative match |
| *(absent)* | `no_reference_provided` |

Output: `status ∈ low | normal | high | unknown | unparseable_range |
no_reference_provided | qualitative_mismatch`, plus `deviation` (signed
distance from the nearest bound, absolute and as % of range width) used for
**display and sorting only** — outside-range findings list first; this is a
presentation choice, **not** a clinical significance ranking, and the app
invents no "critical" thresholds of its own. Qualitative strings
(`Negative`, `Non-reactive`, `Nil`) are compared to the value token;
mismatches surface as `qualitative_mismatch`.

*Acceptance:* table-driven unit tests (≥ 25 cases) covering every form above,
including malformed ranges; a row with no range in its source can never render
as anything except `no_reference_provided`.

#### 4.7 Structured record view
Sections: Patient · Symptoms · Conditions · Allergies · Medications · Lab
Results (grouped by panel, sorted by deviation) · Observations · Flags.
Rendered from typed data — never from model prose. Every row carries a
**provenance chip**: 🧑 *You* · 🤖 *AI-extracted* · 📄 *Current report* ·
🗂 *Previous report* · ✅ *Human-verified* · ⚠️ *Unverified*.

#### 4.8 AI-assisted summary — plan and template *(core differentiator)*
The final AI call receives **structured, evidence-verified data only** — never
raw text — and returns a **plan**, not prose: an ordered list of
`{ factIds, templateId }` plus at most one optional connective note bounded to
140 characters. The server renders the summary from a **pre-audited template
set** filled with verified values, ending with the scope disclaimer. If the
plan is invalid or the call fails, a deterministic template summary renders
instead — no regeneration loop. Because every sentence is server-owned, the
summary cannot diagnose, prescribe or assert certainty by construction, and the
templates are auditable in the repo (see `ARCHITECTURE.md` §7.2).

### Tier 1 — DIFFERENTIATING (build once Tier 0 is green)

#### 4.9 Conflict & inconsistency detection — rules engine first
Deterministic rules; each returns a `Conflict` with citations to **both** sides,
a severity (`info | review`), and a *suggested clarification* — never a
resolution:

| Rule | Detects |
|---|---|
| `R1` | An allergy documented in a source document vs intake saying "no known allergies" |
| `R2` | Same analyte twice in one report with divergent values (beyond tolerance) |
| `R3` | Date anomalies: future report date, or previous-report date ≥ current-report date |
| `R4` | Sex-specific test vs recorded sex mismatch → *"please confirm the correct report"* |
| `R5` | Medication named in a report but absent from intake (and vice-versa) → clarify |
| `R6` | A value reported without a unit → clarify |
| `R7` | Unit incompatible with the analyte's known unit family → verify transcription |
| `R8` | Text references an earlier report that was not provided → invite upload |

No drug-interaction engine and no identity assertions — R4/R5/R7/R8 are phrased
as clarification requests, not conclusions. Findings rank `review` before
`info`. Any further "semantic" AI-passed conflict detection is out of scope for
the four-hour build and is not promised.

#### 4.10 Context-aware clarification questions, each with a stated "why"
Generated from a **gap analysis of the structured record**, not a fixed list:
symptom without onset → *"When did the chest tightness start?"*; abnormal
analyte with no prior value → *"Do you have an earlier report with this test?"*;
medication without a dose; allergy without a reaction. Each question shows its
trigger (`Gap: symptom.onset missing`) and is answerable **inline** — answers
write back as `user_provided` and re-run the deterministic layers **without a
new extraction call**.

#### 4.11 Human review: field state machine + audit log
`ai_extracted → user_confirmed | user_corrected | flagged_for_followup`.
Every inline edit appends an immutable
`AuditEvent { actor, field, before, after, at, reason }`. A **verification
coverage** meter (`14 / 22 fields verified`) gates the **Sign off record**
action. Keyboard loop: `J`/`K` move · `Enter` confirm · `E` edit · `F` flag ·
`A` accept-all-high-confidence. Confidence is not decorative — it *orders the
queue*.

#### 4.12 Human-safe summary rendering *(supersedes the regex "claim linter" idea)*
Rather than filtering model prose with regexes — a weak guarantee and wasted
effort — MedLens makes unsafe phrasing structurally impossible: the model only
ever returns a plan (§4.8); sentences come from a small, unit-tested template
set; free-text model output is limited to a ≤ 140-character connective note
rendered in a visually distinct *"in plain words (AI-assisted)"* slot, and even
that note is checked against a bounded clinical-phrase guard (diagnosis verbs,
dosage language, certainty claims) with a deterministic template fallback. The
templates themselves are the safety boundary — readable and auditable in the
repo.

#### 4.13 Identifier masking before egress *(best-effort, stated honestly)*
`maskIdentifiers()` performs best-effort masking of obvious identifiers —
names from the intake form, MRN/UHID-like tokens, phone numbers, emails —
replacing them with stable tokens (`[[NAME_1]]`) **before any bytes reach
Gemini**; the offset map lives only in server memory and re-hydrates the
response. This is heuristic and cannot be guaranteed complete, so the UI badge
says *"Sent to AI: identifiers masked (best effort)"* with a diff-style preview
of exactly what left the server, and the privacy statement tells users not to
upload real patient data (see `ARCHITECTURE.md` §8). Honest, small, and still
demonstrably less exposure than sending raw text.

#### 4.14 Longitudinal comparison with status transitions
Joins current ↔ previous on `canonicalId`, converts units, and reports `delta`,
`deltaPct`, `direction` and — the part that matters — **`statusTransition`**
(`normal → low`, `high → normal`, `unchanged`). Sorted so **bound crossings**
outrank large-but-still-normal swings. Non-comparable pairs (unit-family
mismatch, missing canonical id) are explicitly listed as *"could not be
compared"* rather than silently dropped.

### Tier 2 — HIGH-LEVERAGE EXTRAS (cheap, visible, rubric-targeted)

| # | Feature | Cost | Why it wins |
|---|---|---|---|
| 4.15 | **Extraction cache** — `sha256(normalizedText + promptVersion + model)` → stored result; re-upload costs **0 AI calls**. UI chip: `AI calls: 2 · cache hits: 1 · ~3.1k tokens`. | 25 min | *Demonstrates* the Efficiency criterion instead of claiming it. |
| 4.16 | **Side-by-side provenance highlighting** — hovering a structured field highlights its exact span in the source pane, and vice-versa. | 30 min | The most *felt* feature in the app; proves traceability in one second of demo. |
| 4.17 | **Print/PDF one-pager** — `/records/[id]/print` route with print CSS, provenance footnotes, coverage meter, disclaimer banner, record hash. No PDF library. | 25 min | Real exportable artifact, zero dependency risk. |
| 4.18 | **Plain-language glossary** — local JSON; medical terms render as accessible `<button>` + popover (`What is MCV?`). | 20 min | Patient-friendly *and* an accessibility win. |
| 4.19 | **Degraded mode** — if Gemini errors or quota-fails, a regex extractor handles classic `Name Value Unit Range` lines, marked `origin: heuristic`, `verified: false`. | 25 min | Reliability points; graceful failure is rare in hackathons. |
| 4.20 | **Ephemeral Demo Mode** — one click, no signup; the record lives in the session scope and is purgeable from the UI, with a banner explaining exactly what that means (and that it is not identity-verified access control). | 20 min | **The judge can evaluate without creating an account** — protects the score — and doubles as a privacy feature. |
| 4.21 | **Sample-report fixtures** — 3 one-click reports: CBC *with* ranges, thyroid panel *without* ranges, and a deliberately conflicting prior record. | 15 min | Guarantees the reviewer sees range awareness, `no_reference_provided`, and conflict detection even with no lab report to hand. |
| 4.22 | **Search & filter** across records/analytes with status filters and a `⌘K` palette. | 20 min | Cheap; covers a listed optional enhancement. |

### 4.23 Anti-features (deliberately excluded — say so in the README)

Chat interface · symptom checker · risk scores · "possible conditions" list ·
any normal-range data bundled with the app · raw PHI in logs. Each is excluded
for a stated safety reason. **Naming what you refused to build is a strong
signal of engineering judgement — and it is the single cheapest paragraph in
the whole submission.**

---

## 5. Non-functional requirements

| Area | Requirement |
|---|---|
| **Security** | No key in the client bundle; Gemini called server-side only; Secret Manager in prod; opaque server-side session in an HttpOnly `Secure` cookie (token stored hashed) — no passwords in scope, stated plainly; every query owner-scoped through a repository layer; Zod at every boundary; per-session rate limiting with `Retry-After` on AI routes; strict CSP, `X-Content-Type-Options`, `Referrer-Policy`, HSTS; identifiers never logged (structured logger + redacting serializer). |
| **Privacy** | Best-effort identifier masking before egress (§4.13); explicit consent checkbox before first upload; a working delete-my-record and delete-my-session endpoint; honest privacy statement — synthetic data only, no compliance claims. |
| **Efficiency** | Typically two AI calls per record revision (one extraction per uncached report, one summary-plan per change); content-hash cache deduplicates re-uploads; deterministic layers do everything else; attempt counts and cache hits displayed in the UI — **no hard call ceiling is claimed**; p95 < 12 s for a 2-page report. |
| **Accessibility** | WCAG 2.1 AA target: semantic landmarks, one `h1` per page, labelled inputs with `aria-describedby` errors, visible focus rings, `aria-live="polite"` on async results, status never colour-only, full keyboard review loop, `prefers-reduced-motion`, ≥ 4.5:1 contrast, `<html lang="en">`, skip link. |
| **Reliability** | Typed error envelope; one bounded retry with jittered backoff on provider 5xx/timeout only (never on 429 or flagged-unsafe input); Zod-validated model output everywhere; degraded heuristic mode; `/api/health`. |
| **Testing** | Vitest unit tests for every pure module (range parser, unit converter, masker, clinical-phrase guard, conflict rules, alias resolver, cache key) + route-handler tests with a mocked AI client + one end-to-end pipeline test over a fixture report. Gate: ≥ 80 % lines on `src/lib/engines` and `src/lib/validation` — the pure core. |

---

## 6. Success criteria (must be demonstrably true at submission)

1. A report containing `Hemoglobin 10.2 g/dL (13.0–17.0)` renders
   **Below reported reference range · −2.8 g/dL from lower bound · 📄 Current report**.
2. A report **without** ranges renders `no_reference_provided` for every analyte,
   and the summary says the range wasn't provided. Nothing is invented.
3. Editing an AI-extracted value writes an audit entry with before/after and
   flips the chip to ✅ *Human-verified*.
4. Intake "No known allergies" + prior record "Penicillin" ⇒ a conflict card
   citing both sides plus a clarification question — and **no** auto-resolution.
5. `curl` against any AI route without a session returns `401`; the client bundle
   contains zero occurrences of the API key (grep-provable, shown in the README).
6. `npm test` is green and the coverage number appears in the README.
7. The deployed Cloud Run URL loads and Demo Mode works with no signup.


