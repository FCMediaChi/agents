/**
 * Run-over-run comparison engine.
 *
 * Pure functions only: no database, no clock, no network, no AI. Given the answers of
 * two QA runs it always produces the same diff, which is what makes it testable
 * (see compare.test.ts) and what lets a user prove a fix landed between two reviews.
 *
 * Semantics are documented in qa-app/PHASE-3.md §4.
 */

import type { Severity } from './catalog.js';
import type { AnswerStatus, ReadinessStatus } from './scoring.js';

/** One checklist item as the comparison sees it. */
export interface ComparableItem {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  severity: Severity;
  status: AnswerStatus;
}

/** The headline numbers of one run. */
export interface RunSnapshot {
  runId: string;
  label: string | null;
  startedAt: string | null;
  score: number | null;
  completionPercentage: number;
  readiness: ReadinessStatus;
}

export interface RunSide {
  snapshot: RunSnapshot;
  items: ComparableItem[];
}

/** One item whose answer differs between the two runs. */
export interface ItemChange {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  severity: Severity;
  from: AnswerStatus;
  to: AnswerStatus;
}

/** An item that exists in only one of the two runs (catalog / site type changed). */
export interface SingleSideItem {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  severity: Severity;
  status: AnswerStatus;
}

export interface MetricDelta {
  base: number | null;
  head: number | null;
  /** head − base, or null when either side has no number. */
  delta: number | null;
}

export interface CountDelta {
  base: number;
  head: number;
  delta: number;
}

export type ReadinessDirection = 'improved' | 'unchanged' | 'worsened';

export interface RunComparison {
  base: RunSnapshot;
  head: RunSnapshot;
  score: MetricDelta;
  completion: MetricDelta;
  readiness: {
    base: ReadinessStatus;
    head: ReadinessStatus;
    direction: ReadinessDirection;
  };
  counts: {
    passed: CountDelta;
    failed: CountDelta;
    needsReview: CountDelta;
    notChecked: CountDelta;
    notApplicable: CountDelta;
    criticalFailures: CountDelta;
  };
  /** Previously failing / needs review, now passing. */
  fixed: ItemChange[];
  /** Previously passing / needs review, now failing. */
  broken: ItemChange[];
  /** Failing in both runs. */
  stillFailing: ItemChange[];
  /** fail → needs_review. */
  improved: ItemChange[];
  /** pass → needs_review. */
  worsened: ItemChange[];
  /** Any other difference, e.g. fail → not_applicable or a reset to unchecked. */
  otherChanges: ItemChange[];
  onlyInBase: SingleSideItem[];
  onlyInHead: SingleSideItem[];
  totals: {
    /** Items present in both runs and therefore comparable. */
    comparable: number;
    /** Comparable items whose answer changed at all. */
    changed: number;
    unchangedPassing: number;
  };
}

/** Fixed ladder for readiness movement. */
const READINESS_RANK: Record<ReadinessStatus, number> = {
  not_started: 0,
  not_ready: 1,
  needs_attention: 2,
  nearly_ready: 3,
  ready: 4,
};

function metricDelta(base: number | null, head: number | null): MetricDelta {
  const delta = base === null || head === null ? null : head - base;
  return { base, head, delta };
}

function countDelta(base: number, head: number): CountDelta {
  return { base, head, delta: head - base };
}

/** Tally one run's answers — same buckets the Phase 2 scoring engine counts. */
function tally(items: ComparableItem[]) {
  const counts = { passed: 0, failed: 0, needsReview: 0, notChecked: 0, notApplicable: 0, criticalFailures: 0 };
  for (const item of items) {
    switch (item.status) {
      case 'pass':
        counts.passed += 1;
        break;
      case 'fail':
        counts.failed += 1;
        if (item.severity === 'critical') counts.criticalFailures += 1;
        break;
      case 'needs_review':
        counts.needsReview += 1;
        break;
      case 'not_applicable':
        counts.notApplicable += 1;
        break;
      default:
        counts.notChecked += 1;
        break;
    }
  }
  return counts;
}

type Bucket = 'fixed' | 'broken' | 'stillFailing' | 'improved' | 'worsened' | 'other' | 'unchanged';

/**
 * Classify one item's transition. Order matters: the explicit buckets win, and
 * anything else that differs falls into `other` rather than being silently dropped.
 */
export function classifyTransition(from: AnswerStatus, to: AnswerStatus): Bucket {
  if (from === to) {
    // A check that is still failing is its own bucket; the rest are unchanged.
    return from === 'fail' ? 'stillFailing' : 'unchanged';
  }
  if ((from === 'fail' || from === 'needs_review') && to === 'pass') return 'fixed';
  if ((from === 'pass' || from === 'needs_review') && to === 'fail') return 'broken';
  if (from === 'fail' && to === 'needs_review') return 'improved';
  if (from === 'pass' && to === 'needs_review') return 'worsened';
  return 'other';
}

function toChange(item: ComparableItem, to: AnswerStatus): ItemChange {
  return {
    id: item.id,
    title: item.title,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    severity: item.severity,
    from: item.status,
    to,
  };
}

function toSingleSide(item: ComparableItem): SingleSideItem {
  return {
    id: item.id,
    title: item.title,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    severity: item.severity,
    status: item.status,
  };
}

/**
 * Compare two runs of the same project.
 * Items are matched by checklist item id; both sides should already be filtered to the
 * items applicable to the project.
 */
export function compareRuns(base: RunSide, head: RunSide): RunComparison {
  const headById = new Map(head.items.map((item) => [item.id, item]));
  const baseById = new Map(base.items.map((item) => [item.id, item]));

  const fixed: ItemChange[] = [];
  const broken: ItemChange[] = [];
  const stillFailing: ItemChange[] = [];
  const improved: ItemChange[] = [];
  const worsened: ItemChange[] = [];
  const otherChanges: ItemChange[] = [];
  const onlyInBase: SingleSideItem[] = [];

  let comparable = 0;
  let changed = 0;
  let unchangedPassing = 0;

  for (const item of base.items) {
    const counterpart = headById.get(item.id);
    if (!counterpart) {
      onlyInBase.push(toSingleSide(item));
      continue;
    }

    comparable += 1;
    const bucket = classifyTransition(item.status, counterpart.status);
    if (bucket === 'unchanged') {
      if (item.status === 'pass') unchangedPassing += 1;
      continue;
    }

    const change = toChange(item, counterpart.status);
    switch (bucket) {
      case 'fixed':
        changed += 1;
        fixed.push(change);
        break;
      case 'broken':
        changed += 1;
        broken.push(change);
        break;
      case 'stillFailing':
        // Nothing changed here — the check is simply still open.
        stillFailing.push(change);
        break;
      case 'improved':
        changed += 1;
        improved.push(change);
        break;
      case 'worsened':
        changed += 1;
        worsened.push(change);
        break;
      default:
        changed += 1;
        otherChanges.push(change);
        break;
    }
  }

  const onlyInHead: SingleSideItem[] = [];
  for (const item of head.items) {
    if (!baseById.has(item.id)) onlyInHead.push(toSingleSide(item));
  }

  const baseRank = READINESS_RANK[base.snapshot.readiness] ?? 0;
  const headRank = READINESS_RANK[head.snapshot.readiness] ?? 0;
  const direction: ReadinessDirection =
    headRank > baseRank ? 'improved' : headRank < baseRank ? 'worsened' : 'unchanged';

  const baseCounts = tally(base.items);
  const headCounts = tally(head.items);

  return {
    base: base.snapshot,
    head: head.snapshot,
    score: metricDelta(base.snapshot.score, head.snapshot.score),
    completion: metricDelta(base.snapshot.completionPercentage, head.snapshot.completionPercentage),
    readiness: {
      base: base.snapshot.readiness,
      head: head.snapshot.readiness,
      direction,
    },
    counts: {
      passed: countDelta(baseCounts.passed, headCounts.passed),
      failed: countDelta(baseCounts.failed, headCounts.failed),
      needsReview: countDelta(baseCounts.needsReview, headCounts.needsReview),
      notChecked: countDelta(baseCounts.notChecked, headCounts.notChecked),
      notApplicable: countDelta(baseCounts.notApplicable, headCounts.notApplicable),
      criticalFailures: countDelta(baseCounts.criticalFailures, headCounts.criticalFailures),
    },
    fixed,
    broken,
    stillFailing,
    improved,
    worsened,
    otherChanges,
    onlyInBase,
    onlyInHead,
    totals: { comparable, changed, unchangedPassing },
  };
}
