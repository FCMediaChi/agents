# Phase 4 — Client-ready report export (HTML + PDF)

Status: implemented on `feat/qa-phase4-report-export`.
Builds on Phase 2 (scoring engine, `qa-app/PHASE-2.md`) and Phase 3 (runs + comparison,
`qa-app/PHASE-3.md`).

## 1. In scope

1. **Export any QA run as a report** — the current run or any run in the history — in two
   formats:
   - **HTML** — one self-contained `.html` file (styles and both fonts embedded as base64),
     so it opens correctly from an email attachment, a USB stick, or a browser with no
     network. It also prints to PDF cleanly (`@page` A4 rules, page-break control).
   - **PDF** — a real generated PDF file (not a print dialog), A4, paginated, with a footer
     on every page.
2. **Report contents** (identical in both formats, generated from one shared model):
   - project name, client name, website URL, website type, platform;
   - run label, run start date, completion date, and the export date;
   - the **QA Readiness Score** out of 100 and the **launch-readiness gate** with its
     plain-language reason, plus completion %;
   - the answer counts (passed / failed / needs review / N/A / not checked / critical
     failures);
   - the **per-category breakdown** — score, completion, counts, and a bar per category;
   - **every failing and every needs-review check**, ordered by severity then category,
     each with its category, severity, the reviewer's notes, and the "how to check" guidance;
   - **run-over-run movement** when the report is compared against an earlier run: score
     and readiness movement, and the fixed / broken / improved / worsened / still-failing
     lists;
   - the scoring methodology in plain language, so a client can see where the number
     comes from.
3. **Branding** — Nuria AI house style: Poppins Bold headings, DM Sans body, brand palette
   (#1A9EF2 dominant, #4551D3 secondary, #6DC7FF accent, #C3E8FF light), product name
   "Nuria Design QA Assistant", brand "Nuria AI". Fonts are embedded from the files already
   bundled in `public/fonts/` — nothing is fetched from Google Fonts or any CDN.
4. **API** — two new read-only endpoints under the existing project-scoped QA router
   (cookie auth, user-scoped, same as Phase 2/3). Both accept an optional `compareTo` run id.
5. **UI** — an "Export report" panel on the checklist page (works for the current run and
   for a past run being viewed) with a "compare against" picker and a PDF / HTML download
   button; and PDF / HTML buttons on the comparison page that export the later run compared
   against the earlier one.
6. **Unit tests** for the report model (`report.test.ts`, Node's test runner): findings
   selection and ordering, empty-findings case, comparison section presence and direction,
   filename slugs.

## 2. Explicitly out of scope

- QA Copilot / any LLM call (Phase 5). The report is written from the reviewer's own answers
  and the deterministic engine — no AI text anywhere.
- Billing, pricing, tiers, Stripe. The app stays non-purchasable.
- White-label / custom client branding on the report (no branding settings exist yet).
- Emailing or scheduling the report; it is a download only.
- Storing generated reports — they are rendered on request, never persisted, so a report
  always reflects the run as it is now.
- Deployment (Fly account is suspended this cycle). Local verification only, port 3101.

## 3. Report model

`server/src/report/model.ts` — a pure builder. Input: the project row, the run, the
per-category checklist (already filtered to the project's applicable items by the Phase 2
route helpers), the Phase 2 `ScoreSummary`, and optionally a Phase 3 `RunComparison`.
Output: a `QaReportModel` that both renderers consume, so HTML and PDF can never disagree.

```
QaReportModel
  brand       name, product, tagline
  project     name, clientName, websiteUrl, websiteType, platform
  run         label, startedAt, completedAt, score, completionPercentage,
              readiness { status, label, reason }
  counts      total, passed, failed, needsReview, notApplicable, notChecked,
              criticalFailures, highFailures
  categories  [{ name, description, score, completionPercentage, counts }]
  findings    { failures: Finding[], needsReview: Finding[] }
  comparison? { base { label, startedAt, score, readiness }, head {...},
                scoreDelta, readinessDirection,
                fixed[], broken[], improved[], worsened[], stillFailing[] }
  generatedAt ISO timestamp
```

`Finding` = `{ id, title, categoryName, severity, status, notes, remediation }`.

**Findings rules** (deterministic, no AI):

- Only `fail` and `needs_review` items appear — a passing or N/A check is not a finding.
- Failures and needs-review are separate sections; failures first.
- Within a section, items sort by severity (`critical` → `low`) and then by checklist order,
  so the most serious problem is always at the top.
- Notes are the reviewer's own free text from `qa_results.notes`; when there are none the
  report says "No notes recorded" rather than inventing a sentence.
- The comparison lists carry the same titles and severities as the comparison page, so the
  report and the app never disagree.

## 4. Rendering

- `server/src/report/html.ts` — builds a complete standalone HTML document: no external
  stylesheet, no scripts, no network requests. Poppins Bold and DM Sans are embedded as
  base64 `@font-face` sources read from `public/fonts/`. All user text is HTML-escaped.
- `server/src/report/pdf.ts` — builds the PDF with **pdf-lib** (+ `@pdf-lib/fontkit` to embed
  the TrueType fonts). Pure JavaScript, no headless browser, no native binary, no network.
  Layout is drawn by hand: A4 pages, 48 pt margins, automatic pagination with "Page x of y"
  footers, word-wrapped body text, severity chips, coloured readiness badge and score block,
  and bar-style category scores.

**Trade-off, stated plainly:** pdf-lib is ~1.5 MB of dependency (plus fontkit) added to the
server bundle only — the browser bundle is unchanged. The alternative (a headless Chromium
print) would be hundreds of MB and a process to babysit; the alternative (a browser print
dialog) produces no file. The price of pdf-lib is that the PDF layout is drawn by this code
rather than by CSS, so it is a fixed, simpler layout than the HTML — same content, less
freedom. Font subsetting is on, so a typical report PDF is ~40–60 KB.

**Fonts:** `public/fonts/` now also carries `DM-Sans-Regular.ttf` and `DM-Sans-Medium.ttf`
(SIL OFL, same licence as the Poppins files) because pdf-lib cannot embed the WOFF2 the
browser uses. The CSS keeps using the WOFF2; the TTFs exist for the PDF renderer.

## 5. API

Mounted at `/api/projects/:projectId/qa`, cookie auth (`qa_token`), user-scoped.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/runs/:runId/report.html?compareTo=<runId>` | The run as a self-contained HTML file, sent as an attachment. |
| `GET` | `/runs/:runId/report.pdf?compareTo=<runId>` | The run as a generated PDF file, sent as an attachment. |

- `compareTo` is optional; it must be another run of the same project or the request is a
  400/404 — a report never silently drops a comparison it was asked for.
- `compareTo` equal to the run itself is ignored (a run is not compared with itself).
- Responses are `Content-Disposition: attachment` with a filename slug of
  `<project>-<run>-<date>.html|pdf`, and `Cache-Control: no-store`.
- Reports are rendered on request from live data; nothing is written to the database.

## 6. Files

```
qa-app/PHASE-4.md                          # this document
qa-app/public/fonts/DM-Sans-Regular.ttf    # PDF body font (OFL)
qa-app/public/fonts/DM-Sans-Medium.ttf     # PDF emphasis font (OFL)
qa-app/server/src/report/model.ts          # pure report model builder (+ filename slug)
qa-app/server/src/report/model.test.ts     # unit tests (node:test)
qa-app/server/src/report/fonts.ts          # font loading + base64 for embedding
qa-app/server/src/report/html.ts           # standalone HTML renderer
qa-app/server/src/report/pdf.ts            # pdf-lib PDF renderer
qa-app/server/src/routes/qa.ts             # + report.html / report.pdf routes
qa-app/src/lib/api.ts                      # report URL helpers
qa-app/src/pages/QaChecklistPage.tsx       # Export report panel
qa-app/src/pages/QaComparePage.tsx         # export buttons for the compared pair
```

Run the tests with `npm run test:qa` inside `qa-app/`.
