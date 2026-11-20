/**
 * Client-ready QA report model.
 *
 * One pure builder that both renderers (HTML and PDF) consume, so the two formats can
 * never disagree about what a run says. No database, no network, no AI — everything here
 * comes from the Phase 2 scoring engine and the Phase 3 comparison engine.
 *
 * Scope is documented in qa-app/PHASE-4.md §3.
 */

import type { Project, QaRun } from '../types.js';
import type { Severity } from '../qa/catalog.js';
import type { AnswerStatus, ReadinessStatus, ScoreSummary } from '../qa/scoring.js';
import { READINESS_LABELS } from '../qa/scoring.js';
import type { ItemChange, ReadinessDirection, RunComparison } from '../qa/compare.js';

export const REPORT_BRAND = {
  name: 'Nuria AI',
  product: 'Nuria Design QA Assistant',
  tagline: 'A smarter final check before your website goes live.',
} as const;

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const STATUS_LABELS: Record<AnswerStatus, string> = {
  not_checked: 'Not checked',
  pass: 'Pass',
  fail: 'Fail',
  needs_review: 'Needs review',
  not_applicable: 'N/A',
};

/** A checklist item as the report sees it (the shape the QA routes already return). */
export interface ReportItemInput {
  id: string;
  title: string;
  description: string | null;
  severity: Severity;
  remediation: string | null;
  status: AnswerStatus;
  notes: string | null;
}

export interface ReportCategoryInput {
  id: string;
  name: string;
  description: string | null;
  items: ReportItemInput[];
}

export interface ReportFinding {
  id: string;
  title: string;
  categoryName: string;
  severity: Severity;
  severityLabel: string;
  status: AnswerStatus;
  statusLabel: string;
  notes: string | null;
  remediation: string | null;
}

export interface ReportComparisonSide {
  label: string;
  startedAt: string | null;
  score: number | null;
  readiness: ReadinessStatus;
  readinessLabel: string;
}

export interface ReportComparison {
  base: ReportComparisonSide;
  head: ReportComparisonSide;
  scoreDelta: number | null;
  completionDelta: number | null;
  readinessDirection: ReadinessDirection;
  fixed: ReportFinding[];
  broken: ReportFinding[];
  improved: ReportFinding[];
  worsened: ReportFinding[];
  stillFailing: ReportFinding[];
  totals: { comparable: number; changed: number; unchangedPassing: number };
}

export interface QaReportModel {
  brand: typeof REPORT_BRAND;
  project: {
    name: string;
    clientName: string | null;
    websiteUrl: string | null;
    websiteType: string;
    platform: string;
  };
  run: {
    id: string;
    label: string;
    startedAt: string | null;
    completedAt: string | null;
    score: number | null;
    completionPercentage: number;
    readiness: { status: ReadinessStatus; label: string; reason: string };
  };
  counts: ScoreSummary['counts'];
  categories: Array<{
    id: string;
    name: string;
    description: string | null;
    score: number | null;
    completionPercentage: number;
    counts: ScoreSummary['counts'];
  }>;
  findings: { failures: ReportFinding[]; needsReview: ReportFinding[] };
  comparison: ReportComparison | null;
  generatedAt: string;
}

export interface BuildReportInput {
  project: Project;
  run: QaRun;
  categories: ReportCategoryInput[];
  summary: ScoreSummary;
  comparison?: RunComparison | null;
  /** Injectable clock so tests are deterministic. */
  generatedAt?: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "19 Nov 2026" — fixed formatting so HTML and PDF print the same string. */
export function formatReportDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "19 Nov 2026, 14:32 UTC" */
export function formatReportDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${formatReportDate(value)}, ${hours}:${minutes} UTC`;
}

function toFinding(item: ReportItemInput, categoryName: string): ReportFinding {
  return {
    id: item.id,
    title: item.title,
    categoryName,
    severity: item.severity,
    severityLabel: SEVERITY_LABELS[item.severity] ?? 'Low',
    status: item.status,
    statusLabel: STATUS_LABELS[item.status] ?? 'Needs review',
    notes: item.notes && item.notes.trim() ? item.notes.trim() : null,
    remediation: item.remediation,
  };
}

function toComparisonFinding(change: ItemChange): ReportFinding {
  return {
    id: change.id,
    title: change.title,
    categoryName: change.categoryName,
    severity: change.severity,
    severityLabel: SEVERITY_LABELS[change.severity] ?? 'Low',
    status: change.to,
    statusLabel: STATUS_LABELS[change.to] ?? 'Needs review',
    notes: null,
    remediation: null,
  };
}

/** Most serious first, then checklist order (the input is already in catalog order). */
function sortBySeverity(findings: ReportFinding[]): ReportFinding[] {
  return [...findings].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
}

function sideOf(snapshot: RunComparison['base']): ReportComparisonSide {
  return {
    label: snapshot.label || 'QA run',
    startedAt: snapshot.startedAt,
    score: snapshot.score,
    readiness: snapshot.readiness,
    readinessLabel: READINESS_LABELS[snapshot.readiness] ?? 'Not started',
  };
}

export function buildReportModel(input: BuildReportInput): QaReportModel {
  const { project, run, categories, summary, comparison } = input;

  const failures: ReportFinding[] = [];
  const needsReview: ReportFinding[] = [];

  for (const category of categories) {
    for (const item of category.items) {
      if (item.status === 'fail') failures.push(toFinding(item, category.name));
      else if (item.status === 'needs_review') needsReview.push(toFinding(item, category.name));
    }
  }

  return {
    brand: REPORT_BRAND,
    project: {
      name: project.name,
      clientName: project.client_name,
      websiteUrl: project.website_url,
      websiteType: project.website_type,
      platform: project.platform,
    },
    run: {
      id: run.id,
      label: run.label || 'QA run',
      startedAt: run.started_at,
      completedAt: run.completed_at,
      score: summary.score,
      completionPercentage: summary.completionPercentage,
      readiness: {
        status: summary.readiness.status,
        label: summary.readiness.label,
        reason: summary.readiness.reason,
      },
    },
    counts: summary.counts,
    categories: summary.categories.map((category) => ({
      id: category.id,
      name: category.name,
      description:
        categories.find((entry) => entry.id === category.id)?.description ?? null,
      score: category.score,
      completionPercentage: category.completionPercentage,
      counts: category.counts,
    })),
    findings: {
      failures: sortBySeverity(failures),
      needsReview: sortBySeverity(needsReview),
    },
    comparison: comparison
      ? {
          base: sideOf(comparison.base),
          head: sideOf(comparison.head),
          scoreDelta: comparison.score.delta,
          completionDelta: comparison.completion.delta,
          readinessDirection: comparison.readiness.direction,
          fixed: sortBySeverity(comparison.fixed.map(toComparisonFinding)),
          broken: sortBySeverity(comparison.broken.map(toComparisonFinding)),
          improved: sortBySeverity(comparison.improved.map(toComparisonFinding)),
          worsened: sortBySeverity(comparison.worsened.map(toComparisonFinding)),
          stillFailing: sortBySeverity(comparison.stillFailing.map(toComparisonFinding)),
          totals: comparison.totals,
        }
      : null,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  };
}

/** Lowercase, dash-separated, ASCII-only — safe as a download filename on any OS. */
export function slugify(value: string, fallback = 'report'): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug || fallback;
}

/** e.g. `nuria-qa-acme-redesign-run-2-2026-11-19.pdf` */
export function reportFilename(model: QaReportModel, extension: 'html' | 'pdf'): string {
  const date = new Date(model.generatedAt);
  const stamp = Number.isNaN(date.getTime())
    ? 'report'
    : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(
        date.getUTCDate(),
      ).padStart(2, '0')}`;
  const name = slugify(`${model.project.name}-${model.run.label}`);
  return `nuria-qa-${name}-${stamp}.${extension}`;
}
