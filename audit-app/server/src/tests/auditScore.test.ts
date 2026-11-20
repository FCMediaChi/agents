// Free-tier overall score regression test.
//
// A free audit measures 1 dimension (homepage) and locks the other 6. Locked
// dimensions carry score 0 and no data, so they must be excluded from the
// weighted overall score and the remaining weight normalised — otherwise every
// free audit lands in the teens and grades "Critical" no matter how good the
// site is. Also checks the summary says the score covers only the measured
// dimensions and names how many are locked.
//
// Run with: npm run test:audit-score

import assert from 'node:assert/strict';

const { runAuditFromHtml, computeOverallScore } = await import('../engine/index.js');
const { calculateGrade } = await import('../engine/types.js');
type AuditDimension = import('../engine/types.js').AuditDimension;

const title = 'Nuria AI — Website planning, audit and QA tools for small teams';
const description =
  'Plan a website in minutes: sitemaps, page outlines, content questionnaires and wireframes, plus a launch QA checklist. Built for freelance designers and small agencies.';

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:title" content="Nuria AI" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="https://www.nuriaapps.com/og.png" />
  </head>
  <body>
    <h1>Plan your next website in minutes</h1>
    <p>${description}</p>
  </body>
</html>`;

const report = await runAuditFromHtml(html, 'https://www.nuriaapps.com', 'free');

assert.equal(report.status, 'completed', `free audit should complete, got: ${report.summary}`);

const locked = report.dimensions.filter(d => d.checks.length === 1 && d.checks[0]!.check_name.endsWith('_locked'));
const measured = report.dimensions.filter(d => !locked.includes(d));

assert.equal(report.dimensions.length, 7, 'free audit should list all 7 dimensions');
assert.equal(measured.length, 1, `expected 1 measured dimension, got ${measured.length}`);
assert.equal(locked.length, 6, `expected 6 locked dimensions, got ${locked.length}`);
assert.equal(measured[0]!.dimension, 'homepage');

const homepageScore = measured[0]!.score;
assert.ok(homepageScore > 0, 'homepage dimension should have a real score');

// The overall score must equal the measured dimension's score, not
// homepageScore * 0.20 (which is what including locked dimensions produced).
assert.equal(
  report.overall_score,
  homepageScore,
  `overall ${report.overall_score} should equal the only measured dimension (${homepageScore})`,
);
assert.equal(report.overall_grade, calculateGrade(report.overall_score));
assert.notEqual(report.overall_grade, 'critical', `a homepage scoring ${homepageScore}/100 must not grade Critical`);

// Summary must be honest about coverage.
assert.match(report.summary, /covers|on the 1 dimension/i, `summary should scope the score: ${report.summary}`);
assert.match(report.summary, /1 dimension/, `summary should name the measured count: ${report.summary}`);
assert.match(report.summary, /other 6 dimensions are locked/i, `summary should name the locked count: ${report.summary}`);
assert.match(report.summary, /not a whole-site score/i, `summary should not claim the whole site: ${report.summary}`);

// Normalisation: weights are re-based on the measured dimensions only.
const synthetic: AuditDimension[] = [
  { dimension: 'homepage', label: 'Homepage Analysis', score: 80, grade: 'pass', icon: '', summary: '', checks: [] },
  ...['mobile', 'branding', 'navigation', 'trust', 'conversion', 'accessibility'].map((dimension) => ({
    dimension,
    label: dimension,
    score: 0,
    grade: 'fail' as const,
    icon: '',
    summary: '',
    checks: [{
      check_name: `${dimension}_locked`,
      label: `${dimension} Analysis`,
      passed: false,
      severity: 'info' as const,
      detail: 'Available on paid plans',
      recommendation: null,
    }],
  })),
];
assert.equal(computeOverallScore(synthetic), 80, 'one measured dimension at 80 with 6 locked should score 80');

// Full audit (no locks) keeps the original weighting behaviour.
const full = [
  { dimension: 'homepage', score: 100, weight: 0.20 },
  { dimension: 'mobile', score: 0, weight: 0.15 },
  { dimension: 'branding', score: 0, weight: 0.10 },
  { dimension: 'navigation', score: 0, weight: 0.15 },
  { dimension: 'trust', score: 0, weight: 0.15 },
  { dimension: 'conversion', score: 0, weight: 0.15 },
  { dimension: 'accessibility', score: 0, weight: 0.10 },
];
const fullDims: AuditDimension[] = full.map(d => ({
  dimension: d.dimension,
  label: d.dimension,
  score: d.score,
  grade: 'pass',
  icon: '',
  summary: '',
  checks: [{ check_name: 'x', label: 'x', passed: true, severity: 'info', detail: null, recommendation: null }],
}));
assert.equal(computeOverallScore(fullDims), 20, 'full audit: only homepage at 100 weighs 0.20 → 20');

console.log(`auditScore tests passed (free audit overall ${report.overall_score}/100, grade ${report.overall_grade})`);
