/**
 * Unit tests for the run-over-run comparison engine.
 * Run with `npm run test:qa` inside qa-app/ (Node's built-in test runner).
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { classifyTransition, compareRuns, type ComparableItem, type RunSide } from './compare.js';
import type { AnswerStatus } from './scoring.js';
import type { Severity } from './catalog.js';

let seq = 0;
function item(
  status: AnswerStatus,
  options: { id?: string; title?: string; severity?: Severity; categoryId?: string } = {},
): ComparableItem {
  seq += 1;
  const id = options.id ?? `item-${seq}`;
  return {
    id,
    title: options.title ?? `Check ${id}`,
    categoryId: options.categoryId ?? 'content',
    categoryName: 'Content',
    severity: options.severity ?? 'medium',
    status,
  };
}

function side(
  items: ComparableItem[],
  snapshot: { score?: number | null; completion?: number; readiness?: RunSide['snapshot']['readiness']; runId?: string } = {},
): RunSide {
  return {
    snapshot: {
      runId: snapshot.runId ?? 'run',
      label: 'Run',
      startedAt: '2026-11-01T00:00:00.000Z',
      score: snapshot.score === undefined ? 50 : snapshot.score,
      completionPercentage: snapshot.completion ?? 100,
      readiness: snapshot.readiness ?? 'needs_attention',
    },
    items,
  };
}

describe('classifyTransition', () => {
  test('fail and needs_review to pass are fixed', () => {
    assert.equal(classifyTransition('fail', 'pass'), 'fixed');
    assert.equal(classifyTransition('needs_review', 'pass'), 'fixed');
  });

  test('pass and needs_review to fail are broken', () => {
    assert.equal(classifyTransition('pass', 'fail'), 'broken');
    assert.equal(classifyTransition('needs_review', 'fail'), 'broken');
  });

  test('fail to fail is still failing, not unchanged', () => {
    assert.equal(classifyTransition('fail', 'fail'), 'stillFailing');
  });

  test('partial movements are their own buckets', () => {
    assert.equal(classifyTransition('fail', 'needs_review'), 'improved');
    assert.equal(classifyTransition('pass', 'needs_review'), 'worsened');
  });

  test('every other difference lands in other rather than being dropped', () => {
    assert.equal(classifyTransition('fail', 'not_applicable'), 'other');
    assert.equal(classifyTransition('pass', 'not_checked'), 'other');
    assert.equal(classifyTransition('not_checked', 'fail'), 'other');
    assert.equal(classifyTransition('not_applicable', 'pass'), 'other');
  });

  test('identical answers are unchanged', () => {
    assert.equal(classifyTransition('pass', 'pass'), 'unchanged');
    assert.equal(classifyTransition('needs_review', 'needs_review'), 'unchanged');
    assert.equal(classifyTransition('not_checked', 'not_checked'), 'unchanged');
    assert.equal(classifyTransition('not_applicable', 'not_applicable'), 'unchanged');
  });
});

describe('compareRuns', () => {
  test('a fixed check is reported as fixed, and the score rises', () => {
    const base = side([item('fail', { id: 'a' }), item('pass', { id: 'b' })], { score: 50 });
    const head = side([item('pass', { id: 'a' }), item('pass', { id: 'b' })], { score: 100 });

    const result = compareRuns(base, head);

    assert.deepEqual(result.fixed.map((c) => c.id), ['a']);
    assert.deepEqual(result.fixed[0].from, 'fail');
    assert.deepEqual(result.fixed[0].to, 'pass');
    assert.equal(result.broken.length, 0);
    assert.equal(result.stillFailing.length, 0);
    assert.equal(result.score.delta, 50);
    assert.equal(result.totals.changed, 1);
    assert.equal(result.totals.comparable, 2);
    assert.equal(result.totals.unchangedPassing, 1);
  });

  test('a regression is reported as newly broken, and the score falls', () => {
    const base = side([item('pass', { id: 'a' }), item('pass', { id: 'b' })], { score: 100 });
    const head = side([item('fail', { id: 'a' }), item('pass', { id: 'b' })], { score: 40 });

    const result = compareRuns(base, head);

    assert.deepEqual(result.broken.map((c) => c.id), ['a']);
    assert.equal(result.fixed.length, 0);
    assert.equal(result.score.delta, -60);
    assert.equal(result.counts.failed.delta, 1);
    assert.equal(result.counts.passed.delta, -1);
  });

  test('checks failing in both runs are still failing, not fixed or broken', () => {
    const base = side([item('fail', { id: 'a', severity: 'critical' })], { score: 0 });
    const head = side([item('fail', { id: 'a', severity: 'critical' })], { score: 0 });

    const result = compareRuns(base, head);

    assert.deepEqual(result.stillFailing.map((c) => c.id), ['a']);
    assert.equal(result.fixed.length, 0);
    assert.equal(result.broken.length, 0);
    assert.equal(result.totals.changed, 0);
    assert.equal(result.score.delta, 0);
    assert.equal(result.counts.criticalFailures.head, 1);
  });

  test('all four buckets can appear in one comparison', () => {
    const base = side(
      [
        item('fail', { id: 'fixed' }),
        item('pass', { id: 'broken' }),
        item('fail', { id: 'still' }),
        item('needs_review', { id: 'reviewed' }),
        item('pass', { id: 'untouched' }),
      ],
      { score: 40 },
    );
    const head = side(
      [
        item('pass', { id: 'fixed' }),
        item('fail', { id: 'broken' }),
        item('fail', { id: 'still' }),
        item('pass', { id: 'reviewed' }),
        item('pass', { id: 'untouched' }),
      ],
      { score: 60 },
    );

    const result = compareRuns(base, head);

    assert.deepEqual(result.fixed.map((c) => c.id), ['fixed', 'reviewed']);
    assert.deepEqual(result.broken.map((c) => c.id), ['broken']);
    assert.deepEqual(result.stillFailing.map((c) => c.id), ['still']);
    assert.equal(result.score.delta, 20);
    assert.equal(result.totals.changed, 3, 'the still-failing check did not change');
  });

  test('partial movements are separated from fixed and broken', () => {
    const base = side([item('fail', { id: 'a' }), item('pass', { id: 'b' })], { score: 50 });
    const head = side([item('needs_review', { id: 'a' }), item('needs_review', { id: 'b' })], { score: 50 });

    const result = compareRuns(base, head);

    assert.deepEqual(result.improved.map((c) => c.id), ['a']);
    assert.deepEqual(result.worsened.map((c) => c.id), ['b']);
    assert.equal(result.fixed.length, 0);
    assert.equal(result.broken.length, 0);
  });

  test('hiding a failure by marking it N/A shows up as another change', () => {
    const base = side([item('fail', { id: 'a', severity: 'critical' })], { score: 0 });
    const head = side([item('not_applicable', { id: 'a', severity: 'critical' })], { score: null });

    const result = compareRuns(base, head);

    assert.deepEqual(result.otherChanges.map((c) => c.id), ['a']);
    assert.equal(result.fixed.length, 0);
    assert.equal(result.score.delta, null, 'score is not comparable when the head run is unscored');
  });

  test('an unscored run makes the score movement null, not zero', () => {
    const base = side([item('not_checked', { id: 'a' })], { score: null, completion: 0 });
    const head = side([item('pass', { id: 'a' })], { score: 100, completion: 100 });

    const result = compareRuns(base, head);

    assert.equal(result.score.base, null);
    assert.equal(result.score.head, 100);
    assert.equal(result.score.delta, null);
    assert.equal(result.completion.delta, 100);
  });

  test('items present in only one run are listed, not scored as changes', () => {
    const base = side([item('fail', { id: 'shared' }), item('fail', { id: 'gone' })], { score: 0 });
    const head = side([item('pass', { id: 'shared' }), item('pass', { id: 'added' })], { score: 100 });

    const result = compareRuns(base, head);

    assert.deepEqual(result.onlyInBase.map((c) => c.id), ['gone']);
    assert.deepEqual(result.onlyInHead.map((c) => c.id), ['added']);
    assert.deepEqual(result.fixed.map((c) => c.id), ['shared']);
    assert.equal(result.totals.comparable, 1);
    assert.equal(result.totals.changed, 1);
  });

  test('comparing a run with itself is the identity: nothing changed, zero movement', () => {
    const items = [item('pass', { id: 'a' }), item('fail', { id: 'b' }), item('not_checked', { id: 'c' })];
    const run = side(items, { score: 50, completion: 66, readiness: 'needs_attention' });

    const result = compareRuns(run, run);

    assert.equal(result.fixed.length, 0);
    assert.equal(result.broken.length, 0);
    assert.equal(result.stillFailing.length, 1);
    assert.equal(result.improved.length, 0);
    assert.equal(result.worsened.length, 0);
    assert.equal(result.otherChanges.length, 0);
    assert.equal(result.score.delta, 0);
    assert.equal(result.completion.delta, 0);
    assert.equal(result.readiness.direction, 'unchanged');
    assert.equal(result.totals.changed, 0);
  });

  test('readiness movement follows the fixed ladder in both directions', () => {
    const items = [item('pass', { id: 'a' })];

    const up = compareRuns(
      side(items, { readiness: 'not_ready' }),
      side(items, { readiness: 'ready' }),
    );
    assert.equal(up.readiness.direction, 'improved');

    const down = compareRuns(
      side(items, { readiness: 'ready' }),
      side(items, { readiness: 'needs_attention' }),
    );
    assert.equal(down.readiness.direction, 'worsened');

    const sideways = compareRuns(
      side(items, { readiness: 'nearly_ready' }),
      side(items, { readiness: 'nearly_ready' }),
    );
    assert.equal(sideways.readiness.direction, 'unchanged');
  });

  test('a real fix round: three failures fixed, one regression, score up', () => {
    const base = side(
      [
        item('fail', { id: 'alt-text', severity: 'critical' }),
        item('fail', { id: 'meta-desc', severity: 'high' }),
        item('fail', { id: 'favicon', severity: 'low' }),
        item('pass', { id: 'robots' }),
        item('needs_review', { id: 'privacy' }),
      ],
      { score: 20, completion: 100, readiness: 'not_ready' },
    );
    const head = side(
      [
        item('pass', { id: 'alt-text', severity: 'critical' }),
        item('pass', { id: 'meta-desc', severity: 'high' }),
        item('fail', { id: 'favicon', severity: 'low' }),
        item('fail', { id: 'robots' }),
        item('pass', { id: 'privacy' }),
      ],
      { score: 60, completion: 100, readiness: 'needs_attention' },
    );

    const result = compareRuns(base, head);

    assert.deepEqual(result.fixed.map((c) => c.id).sort(), ['alt-text', 'meta-desc', 'privacy']);
    assert.deepEqual(result.broken.map((c) => c.id), ['robots']);
    assert.deepEqual(result.stillFailing.map((c) => c.id), ['favicon']);
    assert.equal(result.score.delta, 40);
    assert.equal(result.readiness.direction, 'improved');
    assert.equal(result.counts.criticalFailures.base, 1);
    assert.equal(result.counts.criticalFailures.head, 0);
  });
});
