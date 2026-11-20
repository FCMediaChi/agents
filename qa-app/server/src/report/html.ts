/**
 * Standalone HTML report renderer.
 *
 * The output is a single self-contained .html file: no scripts, no external stylesheet,
 * no network requests, fonts embedded as base64. It opens from an email attachment or a
 * USB stick, and prints to PDF cleanly (A4, break control).
 */

import { fontBase64, REPORT_FONTS } from './fonts.js';
import {
  formatReportDate,
  formatReportDateTime,
  type QaReportModel,
  type ReportFinding,
} from './model.js';

const READINESS_COLORS: Record<string, { fg: string; bg: string; bar: string }> = {
  not_started: { fg: '#475569', bg: '#F1F5F9', bar: '#94A3B8' },
  not_ready: { fg: '#B91C1C', bg: '#FEE2E2', bar: '#DC2626' },
  needs_attention: { fg: '#B45309', bg: '#FEF3C7', bar: '#D97706' },
  nearly_ready: { fg: '#4551D3', bg: '#C3E8FF', bar: '#1A9EF2' },
  ready: { fg: '#047857', bg: '#D1FAE5', bar: '#059669' },
};

const SEVERITY_COLORS: Record<string, { fg: string; bg: string }> = {
  critical: { fg: '#B91C1C', bg: '#FEE2E2' },
  high: { fg: '#B45309', bg: '#FEF3C7' },
  medium: { fg: '#4551D3', bg: '#E0E4FB' },
  low: { fg: '#475569', bg: '#F1F5F9' },
};

export function escapeHtml(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function readinessColors(status: string) {
  return READINESS_COLORS[status] ?? READINESS_COLORS.not_started;
}

function severityChip(severity: string, label: string): string {
  const colors = SEVERITY_COLORS[severity] ?? SEVERITY_COLORS.low;
  return `<span class="chip" style="color:${colors.fg};background:${colors.bg}">${escapeHtml(label)}</span>`;
}

function findingCard(finding: ReportFinding, tone: 'fail' | 'review'): string {
  const note = finding.notes
    ? `<p class="note"><span class="note-label">Reviewer notes</span>${escapeHtml(finding.notes)}</p>`
    : `<p class="note note-empty">No notes recorded for this check.</p>`;
  const guidance = finding.remediation
    ? `<p class="guidance"><span class="note-label">How to check</span>${escapeHtml(finding.remediation)}</p>`
    : '';

  return `<article class="finding finding-${tone}">
    <div class="finding-head">
      ${severityChip(finding.severity, finding.severityLabel)}
      <h3>${escapeHtml(finding.title)}</h3>
    </div>
    <p class="finding-meta">${escapeHtml(finding.categoryName)} · ${escapeHtml(finding.statusLabel)}</p>
    ${note}
    ${guidance}
  </article>`;
}

function deltaText(delta: number | null, suffix = ''): string {
  if (delta === null) return 'not comparable';
  if (delta === 0) return `no change${suffix}`;
  return `${delta > 0 ? '+' : ''}${delta}${suffix}`;
}

function movementList(
  title: string,
  items: ReportFinding[],
  tone: 'good' | 'bad' | 'neutral',
  emptyText: string,
): string {
  const body = items.length
    ? `<ul class="movement-list">${items
        .map(
          (item) =>
            `<li><span class="movement-title">${escapeHtml(item.title)}</span><span class="movement-meta">${escapeHtml(
              item.categoryName,
            )} · ${escapeHtml(item.severityLabel)}</span></li>`,
        )
        .join('')}</ul>`
    : `<p class="movement-empty">${escapeHtml(emptyText)}</p>`;
  return `<div class="movement movement-${tone}"><h3>${escapeHtml(title)} <span class="count">${
    items.length
  }</span></h3>${body}</div>`;
}

function comparisonSection(model: QaReportModel): string {
  const comparison = model.comparison;
  if (!comparison) return '';

  const direction =
    comparison.readinessDirection === 'improved'
      ? 'Launch readiness improved'
      : comparison.readinessDirection === 'worsened'
        ? 'Launch readiness got worse'
        : 'Launch readiness is unchanged';

  return `<section class="section comparison">
    <h2>Compared with an earlier run</h2>
    <p class="section-lead">This run is the later one. The movement below is computed from the same
      scoring engine as the app, so it matches what the checklist page shows.</p>

    <div class="compare-grid">
      <div class="compare-card">
        <p class="compare-label">Earlier run</p>
        <p class="compare-run">${escapeHtml(comparison.base.label)}</p>
        <p class="compare-date">${escapeHtml(formatReportDate(comparison.base.startedAt))}</p>
        <p class="compare-score">${comparison.base.score === null ? '—' : comparison.base.score}<span>/100</span></p>
        <p class="compare-readiness">${escapeHtml(comparison.base.readinessLabel)}</p>
      </div>
      <div class="compare-arrow">→</div>
      <div class="compare-card compare-card-head">
        <p class="compare-label">This run</p>
        <p class="compare-run">${escapeHtml(comparison.head.label)}</p>
        <p class="compare-date">${escapeHtml(formatReportDate(comparison.head.startedAt))}</p>
        <p class="compare-score">${comparison.head.score === null ? '—' : comparison.head.score}<span>/100</span></p>
        <p class="compare-readiness">${escapeHtml(comparison.head.readinessLabel)}</p>
      </div>
    </div>

    <p class="compare-summary">
      <strong>Score ${escapeHtml(deltaText(comparison.scoreDelta))}</strong>
      · Completion ${escapeHtml(deltaText(comparison.completionDelta, '%'))}
      · ${escapeHtml(direction)}
      · ${comparison.totals.comparable} checks comparable, ${comparison.totals.changed} changed.
    </p>

    <div class="movements">
      ${movementList('Fixed since the earlier run', comparison.fixed, 'good', 'Nothing was fixed between these runs.')}
      ${movementList('Broken since the earlier run', comparison.broken, 'bad', 'Nothing that passed before is failing now.')}
      ${movementList('Partly addressed', comparison.improved, 'neutral', 'No failing check moved to needs-review.')}
      ${movementList('Now needs a look', comparison.worsened, 'neutral', 'No passing check moved to needs-review.')}
    </div>
    <p class="compare-footnote">${comparison.stillFailing.length} ${
      comparison.stillFailing.length === 1 ? 'check is' : 'checks are'
    } still failing in both runs.</p>
  </section>`;
}

export function renderReportHtml(model: QaReportModel): string {
  const colors = readinessColors(model.run.readiness.status);
  const { counts } = model;
  const totalFindings = model.findings.failures.length + model.findings.needsReview.length;

  const poppinsBold = fontBase64(REPORT_FONTS.heading);
  const dmSans = fontBase64(REPORT_FONTS.bodyWeb);

  const categoryRows = model.categories
    .map((category) => {
      const score = category.score === null ? '—' : `${category.score}%`;
      const width = category.score === null ? 0 : Math.max(0, Math.min(100, category.score));
      const c = category.counts;
      return `<tr>
        <th scope="row">
          <span class="cat-name">${escapeHtml(category.name)}</span>
          ${category.description ? `<span class="cat-desc">${escapeHtml(category.description)}</span>` : ''}
        </th>
        <td class="cat-score">
          <span class="bar"><span class="bar-fill" style="width:${width}%"></span></span>
          <span class="cat-score-value">${escapeHtml(score)}</span>
        </td>
        <td class="cat-counts">
          <span class="ok">${c.passed} pass</span> ·
          <span class="bad">${c.failed} fail</span> ·
          <span class="warn">${c.needsReview} review</span>
        </td>
        <td class="cat-completion">${category.completionPercentage}%</td>
      </tr>`;
    })
    .join('');

  const failuresSection = model.findings.failures.length
    ? model.findings.failures.map((finding) => findingCard(finding, 'fail')).join('')
    : '<p class="empty">No failing checks in this run.</p>';

  const reviewSection = model.findings.needsReview.length
    ? model.findings.needsReview.map((finding) => findingCard(finding, 'review')).join('')
    : '<p class="empty">No checks are waiting on a second look.</p>';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>QA Readiness Report — ${escapeHtml(model.project.name)}</title>
<style>
  @font-face {
    font-family: "Poppins";
    src: url(data:font/ttf;base64,${poppinsBold}) format("truetype");
    font-weight: 700;
    font-style: normal;
  }
  @font-face {
    font-family: "DM Sans";
    src: url(data:font/woff2;base64,${dmSans}) format("woff2");
    font-weight: 100 900;
    font-style: normal;
  }

  :root {
    --brand: #1A9EF2;
    --brand-secondary: #4551D3;
    --brand-accent: #6DC7FF;
    --brand-light: #C3E8FF;
    --ink: #0F172A;
    --muted: #5A6B82;
    --line: #E2E8F0;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    padding: 0 0 48px;
    background: #F8FAFC;
    color: var(--ink);
    font-family: "DM Sans", -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 13px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }

  h1, h2, h3, .brand-name, .score-value, .compare-score {
    font-family: "Poppins", -apple-system, "Segoe UI", Roboto, sans-serif;
    font-weight: 700;
    margin: 0;
    letter-spacing: -0.01em;
  }

  .page { max-width: 860px; margin: 0 auto; background: #fff; }

  .cover {
    background: linear-gradient(135deg, #4551D3 0%, #1A9EF2 55%, #6DC7FF 100%);
    color: #fff;
    padding: 34px 40px 30px;
  }
  .brand-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .mark {
    width: 26px; height: 26px; border-radius: 8px;
    background: #fff;
    position: relative;
  }
  .mark::after {
    content: ""; position: absolute; inset: 6px; border-radius: 4px;
    background: linear-gradient(135deg, #4551D3, #1A9EF2);
  }
  .brand-name { font-size: 17px; }
  .product { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.85; }
  .cover h1 { font-size: 30px; margin-top: 26px; }
  .project-name { font-size: 15px; margin-top: 6px; opacity: 0.95; }
  .cover-meta {
    margin-top: 18px; display: flex; flex-wrap: wrap; gap: 6px 22px;
    font-size: 11.5px; opacity: 0.9;
  }
  .cover-meta span strong { font-weight: 600; }

  .body { padding: 30px 40px 8px; }

  .section { margin-bottom: 30px; }
  .section h2 { font-size: 16px; margin-bottom: 4px; }
  .section-lead { color: var(--muted); margin: 0 0 14px; font-size: 12.5px; }

  .score-grid { display: flex; flex-wrap: wrap; gap: 18px; align-items: stretch; }
  .score-card {
    flex: 1 1 240px; border: 1px solid var(--line); border-radius: 14px; padding: 18px 20px;
    background: #fff;
  }
  .score-label { font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
  .score-value { font-size: 46px; line-height: 1.05; margin-top: 4px; }
  .score-value span { font-size: 16px; color: var(--muted); font-weight: 700; }
  .score-note { font-size: 11.5px; color: var(--muted); margin: 2px 0 0; }

  .badge {
    display: inline-block; margin-top: 12px; padding: 6px 12px; border-radius: 999px;
    font-size: 12px; font-weight: 700;
  }
  .reason { font-size: 12px; color: var(--muted); margin: 10px 0 0; }

  .completion { margin-top: 14px; }
  .completion-head { display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 600; color: var(--muted); }
  .track { height: 7px; border-radius: 999px; background: #EEF2F7; margin-top: 6px; overflow: hidden; }
  .fill { height: 100%; border-radius: 999px; }

  .counts { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-top: 4px; }
  .count { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; background: #F8FAFC; }
  .count dt { font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
  .count dd { margin: 2px 0 0; font-size: 19px; font-weight: 700; }

  table.categories { width: 100%; border-collapse: collapse; }
  table.categories th, table.categories td {
    text-align: left; padding: 11px 8px; border-bottom: 1px solid var(--line); vertical-align: middle;
  }
  table.categories tr:last-child th, table.categories tr:last-child td { border-bottom: none; }
  .cat-name { display: block; font-size: 13px; font-weight: 700; font-family: "Poppins", sans-serif; }
  .cat-desc { display: block; font-size: 11px; color: var(--muted); font-weight: 400; margin-top: 2px; }
  .cat-score { width: 26%; }
  .bar { display: block; height: 6px; border-radius: 999px; background: #EEF2F7; overflow: hidden; }
  .bar-fill { display: block; height: 100%; border-radius: 999px; background: var(--brand); }
  .cat-score-value { font-size: 11.5px; font-weight: 700; color: var(--muted); }
  .cat-counts { width: 26%; font-size: 11.5px; color: var(--muted); }
  .cat-counts .ok { color: #047857; }
  .cat-counts .bad { color: #B91C1C; }
  .cat-counts .warn { color: #B45309; }
  .cat-completion { width: 12%; font-size: 11.5px; font-weight: 700; color: var(--muted); text-align: right !important; }

  .finding {
    border: 1px solid var(--line); border-left-width: 3px; border-radius: 10px;
    padding: 12px 14px; margin-bottom: 10px; background: #fff;
    break-inside: avoid; page-break-inside: avoid;
  }
  .finding-fail { border-left-color: #DC2626; }
  .finding-review { border-left-color: #D97706; }
  .finding-head { display: flex; align-items: flex-start; gap: 8px; }
  .finding-head h3 { font-size: 13px; line-height: 1.4; }
  .chip {
    flex: none; font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 3px 7px; border-radius: 999px; margin-top: 1px;
  }
  .finding-meta { font-size: 11px; color: var(--muted); margin: 5px 0 0; }
  .note, .guidance { font-size: 12px; margin: 9px 0 0; }
  .note { background: #F8FAFC; border-radius: 8px; padding: 8px 10px; }
  .note-empty { color: var(--muted); font-style: italic; }
  .guidance { color: var(--muted); }
  .note-label {
    display: block; font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase;
    color: var(--muted); font-weight: 700; margin-bottom: 3px;
  }
  .empty { font-size: 12.5px; color: var(--muted); background: #F8FAFC; border-radius: 10px; padding: 12px 14px; }

  .compare-grid { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .compare-card { flex: 1 1 220px; border: 1px solid var(--line); border-radius: 12px; padding: 14px 16px; background: #F8FAFC; }
  .compare-card-head { border-color: var(--brand-light); background: #F2FAFF; }
  .compare-label { font-size: 9.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin: 0; }
  .compare-run { font-size: 13px; font-weight: 700; margin: 3px 0 0; }
  .compare-date { font-size: 11px; color: var(--muted); margin: 1px 0 0; }
  .compare-score { font-size: 26px; margin: 8px 0 0; }
  .compare-score span { font-size: 11px; color: var(--muted); }
  .compare-readiness { font-size: 11.5px; font-weight: 600; color: var(--brand-secondary); margin: 2px 0 0; }
  .compare-arrow { font-size: 18px; color: var(--brand); }
  .compare-summary { font-size: 12px; color: var(--muted); margin: 14px 0 0; }
  .compare-summary strong { color: var(--ink); }

  .movements { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px; }
  .movement { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; break-inside: avoid; }
  .movement-good { border-left: 3px solid #059669; }
  .movement-bad { border-left: 3px solid #DC2626; }
  .movement-neutral { border-left: 3px solid #94A3B8; }
  .movement h3 { font-size: 12px; }
  .movement .count { color: var(--muted); font-weight: 700; }
  .movement-list { list-style: none; margin: 8px 0 0; padding: 0; }
  .movement-list li { padding: 5px 0; border-top: 1px solid #F1F5F9; }
  .movement-list li:first-child { border-top: none; }
  .movement-title { display: block; font-size: 12px; }
  .movement-meta { display: block; font-size: 10.5px; color: var(--muted); }
  .movement-empty { font-size: 11.5px; color: var(--muted); margin: 8px 0 0; }
  .compare-footnote { font-size: 11.5px; color: var(--muted); margin: 12px 0 0; }

  .method {
    border-top: 1px solid var(--line); padding-top: 16px; margin-top: 8px;
    font-size: 11.5px; color: var(--muted);
  }
  .method h2 { font-size: 13px; margin-bottom: 6px; color: var(--ink); }
  .method p { margin: 0 0 6px; }

  footer.report-foot {
    padding: 18px 40px 26px; border-top: 1px solid var(--line); margin-top: 24px;
    display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    font-size: 10.5px; color: var(--muted);
  }

  @page { size: A4; margin: 14mm; }
  @media print {
    body { background: #fff; font-size: 11.5px; padding-bottom: 0; }
    .page { max-width: none; }
    .cover { padding: 24px 0 20px; color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .cover, .finding, .movement, .compare-card, .count, .badge, .chip, .bar-fill, .fill {
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    .body { padding: 20px 0 0; }
    footer.report-foot { padding: 14px 0 0; }
    .section { break-inside: avoid-page; }
    .finding, .movement, .compare-grid, .counts, table.categories tr { break-inside: avoid; }
    h2 { break-after: avoid; }
  }
</style>
</head>
<body>
<div class="page">
  <header class="cover">
    <div class="brand-row">
      <div class="brand">
        <span class="mark" aria-hidden="true"></span>
        <span class="brand-name">${escapeHtml(model.brand.name)}</span>
      </div>
      <span class="product">${escapeHtml(model.brand.product)}</span>
    </div>
    <h1>QA Readiness Report</h1>
    <p class="project-name">${escapeHtml(model.project.name)}</p>
    <div class="cover-meta">
      ${model.project.clientName ? `<span><strong>Client</strong> ${escapeHtml(model.project.clientName)}</span>` : ''}
      ${model.project.websiteUrl ? `<span><strong>Website</strong> ${escapeHtml(model.project.websiteUrl)}</span>` : ''}
      <span><strong>Site type</strong> ${escapeHtml(model.project.websiteType)}</span>
      <span><strong>Platform</strong> ${escapeHtml(model.project.platform)}</span>
      <span><strong>Run</strong> ${escapeHtml(model.run.label)}</span>
      <span><strong>Run date</strong> ${escapeHtml(formatReportDate(model.run.startedAt))}</span>
    </div>
  </header>

  <div class="body">
    <section class="section">
      <h2>Result</h2>
      <div class="score-grid">
        <div class="score-card">
          <p class="score-label">QA Readiness Score</p>
          <p class="score-value">${model.run.score === null ? '—' : model.run.score}<span>/100</span></p>
          <p class="score-note">${
            model.run.score === null
              ? 'Not scored yet — no check has been answered.'
              : 'Weighted by check severity.'
          }</p>
          <span class="badge" style="color:${colors.fg};background:${colors.bg}">${escapeHtml(
            model.run.readiness.label,
          )}</span>
          <p class="reason">${escapeHtml(model.run.readiness.reason)}</p>
        </div>
        <div class="score-card">
          <p class="score-label">Checklist completion</p>
          <p class="score-value">${model.run.completionPercentage}<span>%</span></p>
          <p class="score-note">${counts.passed + counts.failed + counts.needsReview + counts.notApplicable} of ${
            counts.total
          } applicable checks answered.</p>
          <div class="completion">
            <div class="completion-head"><span>Completion</span><span>${model.run.completionPercentage}%</span></div>
            <div class="track"><div class="fill" style="width:${model.run.completionPercentage}%;background:${
              colors.bar
            }"></div></div>
          </div>
          <p class="reason">${
            model.run.completedAt
              ? `Completed ${escapeHtml(formatReportDate(model.run.completedAt))}.`
              : 'Not every check has been answered yet.'
          }</p>
        </div>
      </div>

      <dl class="counts">
        <div class="count"><dt>Passed</dt><dd style="color:#047857">${counts.passed}</dd></div>
        <div class="count"><dt>Failed</dt><dd style="color:#B91C1C">${counts.failed}</dd></div>
        <div class="count"><dt>Needs review</dt><dd style="color:#B45309">${counts.needsReview}</dd></div>
        <div class="count"><dt>N/A</dt><dd style="color:#475569">${counts.notApplicable}</dd></div>
        <div class="count"><dt>Not checked</dt><dd style="color:#64748B">${counts.notChecked}</dd></div>
        <div class="count"><dt>Critical fails</dt><dd style="color:${
          counts.criticalFailures ? '#B91C1C' : '#64748B'
        }">${counts.criticalFailures}</dd></div>
      </dl>
    </section>

    <section class="section">
      <h2>Score by category</h2>
      <p class="section-lead">Each category is scored the same way as the whole checklist.</p>
      <table class="categories">
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Score</th>
            <th scope="col">Answers</th>
            <th scope="col" style="text-align:right">Answered</th>
          </tr>
        </thead>
        <tbody>${categoryRows}</tbody>
      </table>
    </section>

    <section class="section">
      <h2>Failing checks <span class="count" style="color:#B91C1C">${
        model.findings.failures.length
      }</span></h2>
      <p class="section-lead">Most serious first. These are the checks that failed in this run.</p>
      ${failuresSection}
    </section>

    <section class="section">
      <h2>Needs review <span class="count" style="color:#B45309">${model.findings.needsReview.length}</span></h2>
      <p class="section-lead">Checks the reviewer flagged for a second look before launch.</p>
      ${reviewSection}
    </section>

    ${comparisonSection(model)}

    <section class="method">
      <h2>How the score is calculated</h2>
      <p>Each check carries a weight from its severity: critical 5, high 3, medium 2, low 1.
        A passed check earns its full weight, a check that needs review earns half, a failed check earns nothing.
        Checks marked N/A and checks not yet answered are left out of the calculation entirely.</p>
      <p>The QA Readiness Score is the earned weight divided by the weight of every check that was reviewed.
        Launch readiness is decided separately by fixed rules: any failed critical check means
        &ldquo;Not ready&rdquo;; a failed high check, an unreviewed critical or high check, or a score below 70
        means &ldquo;Needs attention&rdquo;; a score below 90, or any unreviewed lower-priority check, means
        &ldquo;Nearly ready&rdquo;; and only a run with every check reviewed, no critical or high failures and a
        score of at least 90 is &ldquo;Ready for launch&rdquo;.</p>
      <p>This is a checklist-weighted readiness indicator based on the reviewer&rsquo;s own answers,
        not an automated measurement of the live site.</p>
    </section>
  </div>

  <footer class="report-foot">
    <span>${escapeHtml(model.brand.name)} · ${escapeHtml(model.brand.product)}</span>
    <span>${totalFindings} ${totalFindings === 1 ? 'finding' : 'findings'} · generated ${escapeHtml(
      formatReportDateTime(model.generatedAt),
    )}</span>
  </footer>
</div>
</body>
</html>`;
}
