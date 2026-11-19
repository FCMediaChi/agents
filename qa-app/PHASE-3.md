# Phase 3 — Multiple QA runs per project + run-over-run comparison

**Product:** Nuria Design QA Assistant (working name "AI Design QA Checklist & Launch Assistant")
**Status:** implemented in this phase. No AI, no export, no billing.

Phase 2 gave a project one QA run: a checklist, persisted answers, and a deterministic
readiness score. Phase 3 turns that single run into a **history** — you can start a new run
that carries the previous answers forward, see every past run, and compare any two runs to
prove what a round of fixes actually changed.

---

## 1. In scope

1. **Many runs per project.** `qa_runs` already allowed it (the table was never unique per
   project); the API simply never created a second row. Now it does.
   - The **current run** is the most recently created run for the project.
   - `POST /runs` starts a new run. By default it **carries the previous run's answers
     forward** as a starting point (status + notes per item), so a follow-up review starts
     from the last state instead of a blank checklist.
   - Carried answers are stamped with the new run's start time in `reviewed_at`, and the
     current user in `reviewed_by` — a run is self-contained and readable on its own.
2. **Run history.** `GET /runs` lists every run for the project (label, start/completion
   times, score, completion %, launch status, answered count), newest first, with the
   current run flagged.
3. **Viewing a past run.** `GET /runs/:runId` returns the same checklist payload as the
   current run. The checklist page accepts `?run=<id>`; a past run renders **read only**
   (answers are edited on the current run only) with a banner linking back.
4. **Comparison.** `GET /runs/:baseId/compare/:headId` compares any two runs of the same
   project: newly fixed, newly broken, still failing, partial movements, other status
   changes, items that appeared or disappeared from the checklist, and the movement in
   score / completion / launch readiness.
5. **Unit tests** for the comparison engine (`compare.test.ts`, Node's test runner).

## 2. Explicitly out of scope

- QA Copilot / any LLM call (Phase 5). No AI anywhere.
- PDF/HTML export and report generation (Phase 4).
- Billing, pricing, tiers, Stripe. The app stays non-purchasable.
- Run deletion, run renaming, per-run comments, or diffing individual notes.
- Deployment (Fly account is suspended this cycle). Local verification only.

## 3. Data model

**No schema migration.** Phase 1's tables already support this:

| Table | Use in Phase 3 |
|---|---|
| `qa_runs` | One row per run. `label` is auto-numbered (`Run 2`, `Run 3`, …); `started_at`, `completed_at`, `score`, `completion_percentage`, `launch_status` are kept up to date on every read/write of that run, which is what the history list reads. |
| `qa_results` | Answers are keyed by `(qa_run_id, checklist_item_id)`, so each run owns its own copy. Starting a new run inserts a fresh set of rows; the previous run is untouched. |

"Current run" is derived (newest `created_at`, tie-broken by rowid order), not stored, so no
column was added. The run a Phase 2 project already has simply becomes the oldest entry in
its history.

## 4. Comparison semantics (deterministic, no AI)

For each checklist item applicable to the project, the comparison looks at the answer in the
**base** run and in the **head** run. Both runs are scored with the Phase 2 engine
(`computeScore`), so the score movement is the same number the checklist page shows.

| Bucket | Transition | Meaning |
|---|---|---|
| `fixed` | `fail` or `needs_review` → `pass` | The fix worked. |
| `broken` | `pass` or `needs_review` → `fail` | Something that was fine now fails. |
| `stillFailing` | `fail` → `fail` | Still open. |
| `improved` | `fail` → `needs_review` | Partially addressed. |
| `worsened` | `pass` → `needs_review` | Was fine, now needs a look. |
| `otherChanges` | any other difference | e.g. `fail` → `not_applicable` (a check can't be hidden by marking it N/A without this showing up), or a check that went back to unchecked. |
| `onlyInBase` / `onlyInHead` | item in one run only | The catalog or the project's website type changed between runs. These are not comparable and are excluded from every bucket above. |

Score movement is `head.score − base.score`, `null` when either run is unscored (nothing
reviewed yet) — the UI then says "not comparable" rather than showing a fake 0. Launch
readiness moves on a fixed ladder `not_started < not_ready < needs_attention < nearly_ready
< ready`, reported as improved / unchanged / worsened. Passed/failed/needs-review/unchecked
counts are reported as base, head and delta.

A run compared with itself yields zero of everything and a delta of 0 — that is the
identity case the tests pin.

## 5. API

Still mounted at `/api/projects/:projectId/qa`, cookie auth (`qa_token`), user-scoped.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/` | Current run: checklist, answers, computed summary, **plus `runs` + `currentRunId`**. |
| `PATCH` | `/answers/:itemId` | Set status/notes on the **current** run (unchanged from Phase 2). |
| `GET` | `/runs` | Run history, newest first. |
| `POST` | `/runs` | Start a new run. Body `{ label?, carryForward? }` (`carryForward` defaults to `true`). Returns the new run's checklist payload. |
| `GET` | `/runs/:runId` | One run's checklist payload (`is_current` tells the client whether it may be edited). |
| `GET` | `/runs/:baseId/compare/:headId` | Comparison of two runs. 404 unless both belong to this project. |

Scoring stays server-side on every read/write; the client never computes it.

## 6. Files

```
qa-app/PHASE-3.md                        # this document
qa-app/server/src/qa/compare.ts          # pure comparison engine
qa-app/server/src/qa/compare.test.ts     # unit tests (node:test)
qa-app/server/src/schemas/qa.ts          # + CreateRunSchema
qa-app/server/src/routes/qa.ts           # run history, new run, past run, comparison
qa-app/src/lib/api.ts                    # run + comparison types and calls
qa-app/src/pages/QaChecklistPage.tsx     # run history panel, start-new-run, past-run view
qa-app/src/pages/QaComparePage.tsx       # comparison view
qa-app/src/App.tsx                       # /projects/:id/qa/compare route
```

Run the tests with `npm run test:qa` inside `qa-app/` (Phase 2 + Phase 3 suites).
