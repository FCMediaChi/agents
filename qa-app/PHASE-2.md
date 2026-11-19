# Phase 2 — Structured QA checklist + deterministic launch-readiness scoring

**Product:** Nuria Design QA Assistant (working name "AI Design QA Checklist & Launch Assistant")
**Status:** implemented in this phase. No AI, no export, no billing.

Phase 1 shipped auth, the database, and projects. Phase 2 adds the part that makes the
product useful: a real pre-launch checklist you can work through, persisted answers, and a
score/launch-readiness result computed entirely in plain code.

---

## 1. In scope

1. **A structured checklist catalog** — 8 categories, 55 items, seeded into the existing
   `checklist_categories` / `checklist_items` tables. Categories: Content, SEO, Accessibility,
   Performance, Security, Analytics, Legal, plus Commerce (only shown for Ecommerce /
   Membership sites).
2. **Per-project answer state**, persisted in `qa_results` against a QA run
   (`qa_runs`, one active run per project). Five states per item:
   `not_checked` (default), `pass`, `fail`, `needs_review`, `not_applicable`.
   Each item also keeps free-text notes.
3. **A deterministic scoring engine** (pure TypeScript, no DB, no AI) that turns the answers
   into:
   - **QA Readiness Score** 0–100 (severity-weighted),
   - **Completion %**,
   - counts (passed / failed / needs review / N/A / not checked / critical failures),
   - a **launch-readiness result** from fixed gates,
   - a per-category breakdown.
4. **Unit tests** for the engine, run with Node's built-in test runner.
5. **The UI**: a checklist page per project, with the score panel and launch-readiness badge
   updating as answers change.

## 2. Explicitly out of scope

- QA Copilot / any LLM call (Phase 5). No AI anywhere in this phase — no prompt, no model,
  no "AI-assisted" label.
- PDF/HTML export and report generation (Phase 4).
- Multiple/repeat QA runs, run comparison, autosave history (later phase).
- Billing, pricing, tiers, Stripe. The app stays non-purchasable.
- Deployment (Fly account is suspended this cycle). Local verification only.

## 3. Data model

Phase 1 already created every table this phase needs; **no schema migration is required**.
Two additions are behavioural, not structural:

| Table | Use in Phase 2 |
|---|---|
| `checklist_categories` | Seeded from `server/src/qa/catalog.ts` on boot (upsert by stable id). |
| `checklist_items` | Seeded the same way. `severity`, `remediation_guidance`, `applicable_site_types` are used by the engine/UI. `ai_prompt_context` is left unused — it belongs to Phase 5. |
| `qa_runs` | One run per project, created lazily on first checklist view. Stores the computed `score`, `completion_percentage`, `launch_status`, `started_at`, `completed_at`. |
| `qa_results` | One row per answered item, keyed by `(qa_run_id, checklist_item_id)` (unique index). `status` + `notes` + `reviewed_at`. |

`qa_results.status` values: `not_checked`, `pass`, `fail`, `needs_review`, `not_applicable`
(the column default `not_reviewed` from Phase 1 is treated as `not_checked` when read).

## 4. Scoring methodology (transparent, reproducible)

**Severity weights** — `critical = 5`, `high = 3`, `medium = 2`, `low = 1`.

**Credit per answer** — `pass` = full weight, `needs_review` = half weight,
`fail` = 0. `not_applicable` and `not_checked` are **excluded** from the score denominator
(an N/A item never drags a score down, and an unanswered one never inflates it).

```
score = round( earnedWeight / possibleWeight × 100 )      // possibleWeight = weights of items with pass/fail/needs_review
completion% = round( (pass + fail + needs_review + na) / totalApplicableItems × 100 )
```

`score` is `null` ("Not scored yet") until at least one item is pass / fail / needs review.
This is a checklist-weighted readiness indicator, not a measured site-quality metric — the UI
says so.

**Launch-readiness gates** (evaluated in order, first match wins; all thresholds live in
`DEFAULT_SCORING_CONFIG`):

| # | Condition | Result |
|---|---|---|
| 1 | nothing reviewed yet | `not_started` — "Not started" |
| 2 | any **critical** item failed | `not_ready` — "Not ready" |
| 3 | high-severity failures > 0 | `needs_attention` — "Needs attention" |
| 4 | any critical/high item not yet reviewed | `needs_attention` — required checks unreviewed |
| 5 | score < 70 | `needs_attention` |
| 6 | score < 90 | `nearly_ready` — "Nearly ready" |
| 7 | any medium/low item not yet reviewed | `nearly_ready` |
| 8 | otherwise | `ready` — "Ready for launch" |

So "Ready for launch" cannot be reached by ticking boxes alone: it needs no critical/high
failures, every critical/high check reviewed, and a score of at least 90.

**Applicability** — an item is in a project's checklist when its `applicable_site_types`
is empty (applies to everything) or contains the project's website type. The Commerce
category is empty for, say, a Portfolio site and is then hidden entirely.

## 5. API

Mounted at `/api/projects/:projectId/qa`, cookie auth (`qa_token`), user-scoped like the
Phase 1 project routes.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/projects/:projectId/qa` | Get-or-create the run; returns run, checklist grouped by category with answers, and the computed summary. |
| `PATCH` | `/api/projects/:projectId/qa/answers/:itemId` | Set `status` and/or `notes` for one item; returns the item plus the recomputed summary. |

Scoring is recomputed server-side on every read/write; the client never computes it.

## 6. Files

```
qa-app/server/src/qa/catalog.ts        # checklist definition (categories + items)
qa-app/server/src/qa/scoring.ts        # pure scoring + readiness engine
qa-app/server/src/qa/scoring.test.ts   # unit tests (node:test)
qa-app/server/src/qa/seed.ts           # catalog upsert into the existing tables
qa-app/server/src/schemas/qa.ts        # zod validation for answer updates
qa-app/server/src/routes/qa.ts         # checklist + answers API
qa-app/src/pages/QaChecklistPage.tsx   # checklist UI + score panel
```

Run the tests with `npm run test:qa` inside `qa-app/`.
