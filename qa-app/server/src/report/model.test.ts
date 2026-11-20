/**
 * Unit tests for the report model (Phase 4).
 *
 * The renderers are thin: everything that decides what a report says lives in
 * buildReportModel, so these tests pin the content rules rather than the pixels.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { computeScore, type ScorableItem } from '../qa/scoring.js';
import { compareRuns, type ComparableItem, type RunSide } from '../qa/compare.js';
import type { Project, QaRun } from '../types.js';
import {
  buildReportModel,
  formatReportDate,
  reportFilename,
  slugify,
  type ReportCategoryInput,
} from './model.js';

const project: Project = {
  id: 'proj-1',
  user_id: 'user-1',
  name: 'Acme Redesign',
  website_url: 'https://acme.example',
  client_name: 'Acme Ltd',
  platform: 'Webflow',
  website_type: 'Marketing',
  notes: null,
  status: 'in_progress',
  created_at: '2026-11-01T09:00:00.000Z',
  updated_at: '2026-11-01T09:00:00.000Z',
};

const run: QaRun = {
  id: 'run-2',
  project_id: project.id,
  label: 'Run 2',
  version: '1.0',
  started_at: '2026-11-12T10:00:00.000Z',
  completed_at: null,
  score: null,
  completion_percentage: null,
  launch_status: null,
  created_at: '2026-11-12T10:00:00.000Z',
  updated_at: '2026-11-12T10:00:00.000Z',
};

function item(
  id: string,
  title: string,
  severity: ScorableItem['severity'],
  status: ScorableItem['status'],
  notes: string | null = null,
): ReportCategoryInput['items'][number] {
  return {
    id,
    title,
    description: null,
    severity,
    remediation: `Check ${title.toLowerCase()}`,
    status,
    notes,
  };
}

const categories: ReportCategoryInput[] = [
  {
    id: 'cat-content',
    name: 'Content',
    description: 'Copy and structure',
    items: [
      item('c1', 'Headline is clear', 'low', 'fail', 'Reads like a placeholder.'),
      item('c2', 'Legal pages exist', 'critical', 'fail'),
      item('c3', 'Alt text present', 'medium', 'needs_review', 'Spot-checked the hero only.'),
      item('c4', 'Meta descriptions', 'medium', 'pass'),
    ],
  },
  {
    id: 'cat-forms',
    name: 'Forms',
    description: null,
    items: [
      item('f1', 'Form errors are announced', 'high', 'fail', 'Only shown in red.'),
      item('f2', 'Double submit blocked', 'low', 'not_checked'),
    ],
  },
];

function scorable(input: ReportCategoryInput[]): ScorableItem[] {
  return input.flatMap((category) =>
    category.items.map((entry) => ({
      id: entry.id,
      categoryId: category.id,
      categoryName: category.name,
      severity: entry.severity,
      status: entry.status,
    })),
  );
}

function build(overrides: Partial<Parameters<typeof buildReportModel>[0]> = {}) {
  return buildReportModel({
    project,
    run,
    categories,
    summary: computeScore(scorable(categories)),
    generatedAt: '2026-11-19T12:30:00.000Z',
    ...overrides,
  });
}

test('report carries the project, run and readiness result', () => {
  const model = build();

  assert.equal(model.project.name, 'Acme Redesign');
  assert.equal(model.project.clientName, 'Acme Ltd');
  assert.equal(model.run.label, 'Run 2');
  assert.equal(model.run.startedAt, '2026-11-12T10:00:00.000Z');
  assert.equal(model.run.readiness.status, 'not_ready');
  assert.equal(model.run.readiness.label, 'Not ready');
  assert.equal(model.run.score, computeScore(scorable(categories)).score);
  assert.equal(model.categories.length, 2);
  assert.equal(model.categories[0].name, 'Content');
});

test('findings are only failing and needs-review checks, most serious first', () => {
  const model = build();

  assert.deepEqual(
    model.findings.failures.map((finding) => finding.id),
    ['c2', 'f1', 'c1'],
  );
  assert.deepEqual(
    model.findings.needsReview.map((finding) => finding.id),
    ['c3'],
  );

  // Passing and unchecked checks never appear as findings.
  const ids = [
    ...model.findings.failures.map((finding) => finding.id),
    ...model.findings.needsReview.map((finding) => finding.id),
  ];
  assert.ok(!ids.includes('c4'));
  assert.ok(!ids.includes('f2'));
});

test('findings keep the reviewer notes and the how-to-check guidance', () => {
  const model = build();
  const headline = model.findings.failures.find((finding) => finding.id === 'c1');
  const legal = model.findings.failures.find((finding) => finding.id === 'c2');

  assert.equal(headline?.notes, 'Reads like a placeholder.');
  assert.equal(headline?.categoryName, 'Content');
  assert.equal(headline?.severityLabel, 'Low');
  assert.equal(legal?.notes, null);
  assert.equal(legal?.remediation, 'Check legal pages exist');
});

test('a clean run has no findings and says so', () => {
  const clean: ReportCategoryInput[] = [
    {
      id: 'cat-content',
      name: 'Content',
      description: null,
      items: [item('c1', 'Headline is clear', 'high', 'pass')],
    },
  ];
  const model = build({ categories: clean, summary: computeScore(scorable(clean)) });

  assert.equal(model.findings.failures.length, 0);
  assert.equal(model.findings.needsReview.length, 0);
  assert.equal(model.comparison, null);
});

function side(runId: string, label: string, statuses: Record<string, ComparableItem['status']>): RunSide {
  const items: ComparableItem[] = (
    [
      { id: 'c1', title: 'Headline is clear', categoryId: 'cat-content', categoryName: 'Content', severity: 'low', status: 'pass' },
      { id: 'c2', title: 'Legal pages exist', categoryId: 'cat-content', categoryName: 'Content', severity: 'critical', status: 'pass' },
      { id: 'c3', title: 'Alt text present', categoryId: 'cat-content', categoryName: 'Content', severity: 'medium', status: 'pass' },
    ] satisfies ComparableItem[]
  ).map((entry) => ({ ...entry, status: statuses[entry.id] ?? entry.status }));

  const summary = computeScore(
    items.map((entry) => ({
      id: entry.id,
      categoryId: entry.categoryId,
      categoryName: entry.categoryName,
      severity: entry.severity,
      status: entry.status,
    })),
  );

  return {
    snapshot: {
      runId,
      label,
      startedAt: '2026-11-10T10:00:00.000Z',
      score: summary.score,
      completionPercentage: summary.completionPercentage,
      readiness: summary.readiness.status,
    },
    items,
  };
}

test('comparison section reports fixed, broken and the score movement', () => {
  const base = side('run-1', 'Run 1', { c1: 'fail', c2: 'fail', c3: 'pass' });
  const head = side('run-2', 'Run 2', { c1: 'pass', c2: 'pass', c3: 'fail' });
  const comparison = compareRuns(base, head);

  const model = build({ comparison });

  assert.ok(model.comparison);
  assert.equal(model.comparison.base.label, 'Run 1');
  assert.equal(model.comparison.head.label, 'Run 2');
  assert.equal(model.comparison.scoreDelta, comparison.score.delta);
  assert.deepEqual(model.comparison.fixed.map((entry) => entry.id).sort(), ['c1', 'c2']);
  assert.deepEqual(model.comparison.broken.map((entry) => entry.id), ['c3']);
  assert.equal(model.comparison.readinessDirection, comparison.readiness.direction);
  assert.equal(model.comparison.totals.comparable, 3);
});

test('an unscored comparison reports a null delta instead of a fake zero', () => {
  const empty: RunSide = {
    snapshot: {
      runId: 'run-1',
      label: 'Run 1',
      startedAt: '2026-11-10T10:00:00.000Z',
      score: null,
      completionPercentage: 0,
      readiness: 'not_started',
    },
    items: [
      { id: 'c1', title: 'Headline is clear', categoryId: 'cat-content', categoryName: 'Content', severity: 'low', status: 'not_checked' },
    ],
  };
  const model = build({ comparison: compareRuns(empty, side('run-2', 'Run 2', { c1: 'pass' })) });

  assert.equal(model.comparison?.scoreDelta, null);
});

test('dates are formatted the same way in both renderers', () => {
  assert.equal(formatReportDate('2026-11-19T12:30:00.000Z'), '19 Nov 2026');
  assert.equal(formatReportDate(null), '—');
  assert.equal(formatReportDate('not-a-date'), '—');
});

test('download filenames are safe and identifiable', () => {
  assert.equal(slugify('Acme Redesign — Run 2!'), 'acme-redesign-run-2');
  assert.equal(slugify('***'), 'report');

  const model = build();
  assert.equal(reportFilename(model, 'pdf'), 'nuria-qa-acme-redesign-run-2-2026-11-19.pdf');
  assert.equal(reportFilename(model, 'html'), 'nuria-qa-acme-redesign-run-2-2026-11-19.html');
});
