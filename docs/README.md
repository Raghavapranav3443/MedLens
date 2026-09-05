# MedLens — Competition Plan Pack

**Target:** a first-place-caliber PromptWars submission within exactly 240 minutes.
First place is an ambition, not a guarantee. The judging model, rubric weights,
competitors, feedback timing and submission mechanics are unconfirmed.

This pack specifies a **source-first record review application**, not a medical
chatbot. Its central demonstration is: **click a finding, see its evidence,
correct it, watch every dependent output update.**

## Documents

| Document | Contents |
|---|---|
| [PRD](./PRD.md) | Users, mandatory acceptance criteria, differentiated scope, UX, safety and rubric evidence |
| [Architecture](./ARCHITECTURE.md) | Stack, file layout, data model, APIs, deterministic engines, AI contracts and threat model |
| [Implementation plan](./IMPLEMENTATION_PLAN.md) | 240-minute schedule, executable work blocks, deployment runbook, acceptance tests and conditional second submission |
| [Builder prompt](./BUILD_PROMPT.md) | Replacement instruction set for an implementing coding agent |

Read PRD first, then Architecture, then execute the Implementation Plan using the
Builder Prompt. PRD's scope labels and Implementation Plan's cut lines govern:
**a stretch feature is never permission to delay core reliability.**

## Important corrections to the earlier draft

- No invented `critical` thresholds, clinical significance rankings, drug-class
  interaction engine, or sex-to-test identity assumptions.
- Text evidence checks reduce unsupported extraction; they do not prove clinical
  truth or make OCR self-verifying. Missing or ambiguous evidence stays unresolved.
- A regex filter cannot guarantee safe model prose. Use a constrained AI summary
  plan and server-owned sentence templates rather than unrestricted clinical text.
- Identifier masking is best effort, not guaranteed de-identification. The public
  competition deployment uses synthetic data only and makes no compliance claim.
- Plan for two normal-path AI calls **per report**, with retries counted separately.
  Binary OCR is stretch and must not be described as redacted before it happens.
- Persistence belongs in a managed database, never Cloud Run's local filesystem.
- The latest submission replaces the earlier score: submission two is conditional,
  not a free gamble. Preserve a known-good revision and evidence for each attempt.

## Deliverable status

These are **planning documents**, not an implemented or deployed application.
Recommended packages must be installed, pinned and smoke-tested at build start;
there is no existing application stack in this workspace to preserve.

Official Cloud Run and Gemini documentation informed the plan; linked sources
and remaining assumptions are in Architecture §10. No test score, latency,
coverage number, privacy certification or leaderboard result is claimed here.
