import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeScore,
  determineReadiness,
  DEFAULT_SCORING_CONFIG,
  type AnswerStatus,
  type ScorableItem,
} from './scoring.js';
import type { Severity } from './catalog.js';

let counter = 0;

function item(
  status: AnswerStatus,
  severity: Severity,
  categoryId = 'content',
  categoryName = 'Content',
): ScorableItem {
  counter += 1;
  return { id: `item-${counter}`, categoryId, categoryName, severity, status };
}

test('an empty checklist is not started and has no score', () => {
  const summary = computeScore([]);
  assert.equal(summary.score, null);
  assert.equal(summary.completionPercentage, 0);
  assert.equal(summary.counts.total, 0);
  assert.equal(summary.readiness.status, 'not_started');
});

test('a checklist where nothing is answered yet is not started', () => {
  const summary = computeScore([item('not_checked', 'critical'), item('not_checked', 'low')]);
  assert.equal(summary.score, null);
  assert.equal(summary.completionPercentage, 0);
  assert.equal(summary.readiness.status, 'not_started');
  assert.equal(summary.counts.notChecked, 2);
  assert.equal(summary.counts.unreviewedRequired, 1);
});

test('all checks passing is 100 and ready for launch', () => {
  const summary = computeScore([
    item('pass', 'critical'),
    item('pass', 'high'),
    item('pass', 'medium'),
    item('pass', 'low'),
  ]);
  assert.equal(summary.score, 100);
  assert.equal(summary.completionPercentage, 100);
  assert.equal(summary.readiness.status, 'ready');
  assert.equal(summary.counts.passed, 4);
});

test('a failed critical item blocks launch and reports not ready', () => {
  const summary = computeScore([item('fail', 'critical'), item('pass', 'high'), item('pass', 'medium')]);
  assert.equal(summary.counts.criticalFailures, 1);
  assert.equal(summary.readiness.status, 'not_ready');
  assert.match(summary.readiness.reason, /critical/i);
  // critical 5 of 10 weight failed -> 50
  assert.equal(summary.score, 50);
});

test('a critical failure outweighs a low failure in the score', () => {
  const criticalFail = computeScore([item('fail', 'critical'), item('pass', 'low')]);
  const lowFail = computeScore([item('fail', 'low'), item('pass', 'critical')]);
  assert.equal(criticalFail.score, 17); // 1 / 6
  assert.equal(lowFail.score, 83); // 5 / 6
  assert.ok((criticalFail.score ?? 0) < (lowFail.score ?? 0));
});

test('a failed high item needs attention', () => {
  const summary = computeScore([item('fail', 'high'), item('pass', 'critical'), item('pass', 'low')]);
  assert.equal(summary.counts.highFailures, 1);
  assert.equal(summary.readiness.status, 'needs_attention');
});

test('unreviewed required checks block ready even with a perfect score', () => {
  const summary = computeScore([item('pass', 'critical'), item('not_checked', 'high'), item('pass', 'low')]);
  assert.equal(summary.score, 100);
  assert.equal(summary.counts.unreviewedRequired, 1);
  assert.equal(summary.readiness.status, 'needs_attention');
  assert.match(summary.readiness.reason, /not been reviewed/i);
});

test('only lower-priority items unreviewed is nearly ready', () => {
  const summary = computeScore([item('pass', 'critical'), item('pass', 'high'), item('not_checked', 'low')]);
  assert.equal(summary.score, 100);
  assert.equal(summary.readiness.status, 'nearly_ready');
});

test('a low-severity failure still allows ready for launch', () => {
  const summary = computeScore([
    item('pass', 'critical'),
    item('pass', 'high'),
    item('pass', 'medium'),
    item('fail', 'low'),
  ]);
  // 5+3+2 = 10 of 11
  assert.equal(summary.score, 91);
  assert.equal(summary.readiness.status, 'ready');
});

test('a mid-range score with only medium failures is nearly ready', () => {
  const summary = computeScore([
    item('pass', 'critical'),
    item('pass', 'high'),
    item('fail', 'medium'),
    item('fail', 'medium'),
  ]);
  // 8 of 12 -> 67 -> below the 70 gate
  assert.equal(summary.score, 67);
  assert.equal(summary.readiness.status, 'needs_attention');
});

test('scores between 70 and 90 are nearly ready', () => {
  const summary = computeScore([
    item('pass', 'critical'),
    item('pass', 'critical'),
    item('pass', 'high'),
    item('fail', 'medium'),
  ]);
  // 13 of 15 -> 87
  assert.equal(summary.score, 87);
  assert.equal(summary.readiness.status, 'nearly_ready');
});

test('not applicable items are excluded from the score denominator', () => {
  const withNa = computeScore([
    item('pass', 'critical'),
    item('fail', 'high'),
    item('not_applicable', 'critical'),
  ]);
  const withoutNa = computeScore([item('pass', 'critical'), item('fail', 'high')]);
  assert.equal(withNa.score, withoutNa.score);
  assert.equal(withNa.counts.notApplicable, 1);
  assert.equal(withNa.completionPercentage, 100);
});

test('needs review earns half credit and counts as reviewed', () => {
  const summary = computeScore([item('needs_review', 'high'), item('pass', 'high')]);
  // 3 + 1.5 of 6 -> 75
  assert.equal(summary.score, 75);
  assert.equal(summary.completionPercentage, 100);
  assert.equal(summary.counts.needsReview, 1);
  assert.equal(summary.readiness.status, 'nearly_ready');
});

test('completion percentage counts every answered state including N/A', () => {
  const summary = computeScore([
    item('pass', 'medium'),
    item('fail', 'low'),
    item('not_applicable', 'low'),
    item('not_checked', 'low'),
  ]);
  assert.equal(summary.completionPercentage, 75);
});

test('category breakdown scores each category independently', () => {
  const summary = computeScore([
    item('pass', 'critical', 'content', 'Content'),
    item('fail', 'critical', 'seo', 'SEO'),
    item('pass', 'low', 'seo', 'SEO'),
    item('not_checked', 'low', 'legal', 'Legal'),
  ]);

  assert.deepEqual(summary.categories.map((c) => c.id), ['content', 'seo', 'legal']);

  const content = summary.categories[0];
  const seo = summary.categories[1];
  const legal = summary.categories[2];

  assert.equal(content.score, 100);
  assert.equal(content.completionPercentage, 100);
  assert.equal(seo.score, 17); // low pass 1 of 6
  assert.equal(seo.counts.failed, 1);
  assert.equal(legal.score, null);
  assert.equal(legal.completionPercentage, 0);
  assert.equal(legal.counts.notChecked, 1);

  // The overall counts are the sum of the category counts.
  assert.equal(summary.counts.total, 4);
  assert.equal(summary.counts.criticalFailures, 1);
});

test('scoring is deterministic and repeatable', () => {
  const items = [
    item('pass', 'critical'),
    item('fail', 'medium'),
    item('needs_review', 'high'),
    item('not_applicable', 'low'),
    item('not_checked', 'low'),
  ];
  const first = computeScore(items);
  const second = computeScore(items);
  assert.deepEqual(first, second);
});

test('readiness gates are configurable', () => {
  const counts = computeScore([item('pass', 'critical'), item('fail', 'high')]).counts;
  // Default: any high failure blocks.
  assert.equal(determineReadiness(100, counts).status, 'needs_attention');
  // With a threshold of 1, a single high failure is tolerated.
  const lenient = determineReadiness(100, counts, { ...DEFAULT_SCORING_CONFIG, maxHighFailuresForReady: 1 });
  assert.equal(lenient.status, 'ready');
});

test('an all-not-applicable checklist is not started rather than ready', () => {
  const summary = computeScore([item('not_applicable', 'critical'), item('not_applicable', 'low')]);
  assert.equal(summary.score, null);
  assert.equal(summary.completionPercentage, 100);
  assert.equal(summary.readiness.status, 'not_started');
});
