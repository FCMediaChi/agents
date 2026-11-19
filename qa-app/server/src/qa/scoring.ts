/**
 * Deterministic QA scoring + launch-readiness engine.
 *
 * Pure functions only: no database, no clock, no network, no AI. Given the same
 * answers this always returns the same numbers, which is what makes it testable
 * (see scoring.test.ts) and what makes the score explainable to a client.
 *
 * Methodology is documented in qa-app/PHASE-2.md §4 and surfaced in the UI.
 */

import type { Severity } from './catalog.js';

export type AnswerStatus = 'not_checked' | 'pass' | 'fail' | 'needs_review' | 'not_applicable';

export const ANSWER_STATUSES: AnswerStatus[] = ['not_checked', 'pass', 'fail', 'needs_review', 'not_applicable'];

export type ReadinessStatus = 'not_started' | 'not_ready' | 'needs_attention' | 'nearly_ready' | 'ready';

/** Severity weights used for the weighted pass rate. */
export const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 5,
  high: 3,
  medium: 2,
  low: 1,
};

export const READINESS_LABELS: Record<ReadinessStatus, string> = {
  not_started: 'Not started',
  not_ready: 'Not ready',
  needs_attention: 'Needs attention',
  nearly_ready: 'Nearly ready',
  ready: 'Ready for launch',
};

export interface ScoringConfig {
  /** Credit given to a `needs_review` answer, as a fraction of the item weight. */
  needsReviewCredit: number;
  /** High-severity failures allowed before "Ready for launch" is blocked. */
  maxHighFailuresForReady: number;
  /** Minimum score for "Ready for launch". */
  readyMinScore: number;
  /** Minimum score for "Nearly ready". */
  nearlyReadyMinScore: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  needsReviewCredit: 0.5,
  maxHighFailuresForReady: 0,
  readyMinScore: 90,
  nearlyReadyMinScore: 70,
};

/** One checklist item as the engine sees it: its severity and the reviewer's answer. */
export interface ScorableItem {
  id: string;
  categoryId: string;
  categoryName: string;
  severity: Severity;
  status: AnswerStatus;
}

export interface AnswerCounts {
  total: number;
  passed: number;
  failed: number;
  needsReview: number;
  notApplicable: number;
  notChecked: number;
  /** Failed items with severity `critical`. */
  criticalFailures: number;
  /** Failed items with severity `high`. */
  highFailures: number;
  /** Unanswered items with severity `critical` or `high`. */
  unreviewedRequired: number;
}

export interface CategoryScore {
  id: string;
  name: string;
  /** Weighted pass rate for this category, or null if nothing is scored yet. */
  score: number | null;
  completionPercentage: number;
  counts: AnswerCounts;
}

export interface ReadinessResult {
  status: ReadinessStatus;
  label: string;
  /** Short plain-language explanation of why this result was reached. */
  reason: string;
}

export interface ScoreSummary {
  /** QA Readiness Score, 0–100, or null when nothing has been reviewed yet. */
  score: number | null;
  completionPercentage: number;
  counts: AnswerCounts;
  readiness: ReadinessResult;
  categories: CategoryScore[];
}

function emptyCounts(): AnswerCounts {
  return {
    total: 0,
    passed: 0,
    failed: 0,
    needsReview: 0,
    notApplicable: 0,
    notChecked: 0,
    criticalFailures: 0,
    highFailures: 0,
    unreviewedRequired: 0,
  };
}

function round(value: number): number {
  return Math.round(value);
}

/**
 * Weighted pass rate over the items that were actually reviewed.
 * N/A and unanswered items are excluded from the denominator.
 */
function weightedScore(items: ScorableItem[], config: ScoringConfig): number | null {
  let possible = 0;
  let earned = 0;

  for (const item of items) {
    const weight = SEVERITY_WEIGHTS[item.severity] ?? 1;
    if (item.status === 'pass') {
      possible += weight;
      earned += weight;
    } else if (item.status === 'fail') {
      possible += weight;
    } else if (item.status === 'needs_review') {
      possible += weight;
      earned += weight * config.needsReviewCredit;
    }
    // not_applicable / not_checked contribute to neither side.
  }

  if (possible === 0) return null;
  // Guard against floating point noise from the needs_review credit.
  return round((earned / possible) * 100);
}

function countItems(items: ScorableItem[]): AnswerCounts {
  const counts = emptyCounts();
  for (const item of items) {
    counts.total += 1;
    switch (item.status) {
      case 'pass':
        counts.passed += 1;
        break;
      case 'fail':
        counts.failed += 1;
        if (item.severity === 'critical') counts.criticalFailures += 1;
        if (item.severity === 'high') counts.highFailures += 1;
        break;
      case 'needs_review':
        counts.needsReview += 1;
        break;
      case 'not_applicable':
        counts.notApplicable += 1;
        break;
      default:
        counts.notChecked += 1;
        if (item.severity === 'critical' || item.severity === 'high') counts.unreviewedRequired += 1;
        break;
    }
  }
  return counts;
}

function completionFor(counts: AnswerCounts): number {
  if (counts.total === 0) return 0;
  const answered = counts.passed + counts.failed + counts.needsReview + counts.notApplicable;
  return round((answered / counts.total) * 100);
}

/**
 * Launch-readiness gates. Order matters — the first matching rule wins.
 * A project is never "Ready for launch" merely because most boxes are ticked.
 */
export function determineReadiness(
  score: number | null,
  counts: AnswerCounts,
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): ReadinessResult {
  const reviewed = counts.passed + counts.failed + counts.needsReview;

  const result = (status: ReadinessStatus, reason: string): ReadinessResult => ({
    status,
    label: READINESS_LABELS[status],
    reason,
  });

  if (counts.total === 0) {
    return result('not_started', 'This project has no applicable checklist items.');
  }
  if (reviewed === 0) {
    return result('not_started', 'No checklist items have been reviewed yet.');
  }
  if (counts.criticalFailures > 0) {
    return result(
      'not_ready',
      `${counts.criticalFailures} critical ${counts.criticalFailures === 1 ? 'issue remains' : 'issues remain'} unresolved.`,
    );
  }
  if (counts.highFailures > config.maxHighFailuresForReady) {
    return result(
      'needs_attention',
      `${counts.highFailures} high-severity ${counts.highFailures === 1 ? 'issue is' : 'issues are'} still failing.`,
    );
  }
  if (counts.unreviewedRequired > 0) {
    return result(
      'needs_attention',
      `${counts.unreviewedRequired} required (critical or high) ${counts.unreviewedRequired === 1 ? 'check has' : 'checks have'} not been reviewed yet.`,
    );
  }
  if (score !== null && score < config.nearlyReadyMinScore) {
    return result('needs_attention', `The QA readiness score is below ${config.nearlyReadyMinScore}.`);
  }
  if (score !== null && score < config.readyMinScore) {
    return result('nearly_ready', `The QA readiness score is below ${config.readyMinScore}, so lower-priority issues remain.`);
  }
  if (counts.notChecked > 0) {
    return result('nearly_ready', `${counts.notChecked} lower-priority ${counts.notChecked === 1 ? 'item is' : 'items are'} still unreviewed.`);
  }
  return result('ready', 'Every check is reviewed, with no critical or high-severity failures.');
}

/** Score one group of items (one category, or the whole checklist). */
function scoreGroup(
  id: string,
  name: string,
  items: ScorableItem[],
  config: ScoringConfig,
): CategoryScore {
  const counts = countItems(items);
  return {
    id,
    name,
    score: weightedScore(items, config),
    completionPercentage: completionFor(counts),
    counts,
  };
}

/**
 * Compute the full QA summary from a flat list of applicable items.
 * The caller is responsible for filtering out items that do not apply to the project.
 */
export function computeScore(
  items: ScorableItem[],
  config: ScoringConfig = DEFAULT_SCORING_CONFIG,
): ScoreSummary {
  const counts = countItems(items);

  // Category order follows first appearance in the input, which the API sends in
  // catalog order — deterministic for a given checklist.
  const order: string[] = [];
  const byCategory = new Map<string, ScorableItem[]>();
  for (const item of items) {
    if (!byCategory.has(item.categoryId)) {
      byCategory.set(item.categoryId, []);
      order.push(item.categoryId);
    }
    byCategory.get(item.categoryId)!.push(item);
  }

  const categories = order.map((categoryId) => {
    const group = byCategory.get(categoryId)!;
    return scoreGroup(categoryId, group[0].categoryName, group, config);
  });

  const score = weightedScore(items, config);

  return {
    score,
    completionPercentage: completionFor(counts),
    counts,
    readiness: determineReadiness(score, counts, config),
    categories,
  };
}
