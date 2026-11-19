import { Router, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, persistDb } from '../db.js';
import type { AuthenticatedRequest, Project, QaRun } from '../types.js';
import { authenticate } from '../middleware/auth.js';
import { CreateRunSchema, UpdateAnswerSchema } from '../schemas/qa.js';
import type { Severity } from '../qa/catalog.js';
import { computeScore, type AnswerStatus, type ReadinessStatus, type ScorableItem } from '../qa/scoring.js';
import { compareRuns, type ComparableItem, type RunComparison } from '../qa/compare.js';
import { buildReportModel, reportFilename } from '../report/model.js';
import { renderReportHtml } from '../report/html.js';
import { renderReportPdf } from '../report/pdf.js';

const router = Router({ mergeParams: true });

// Every checklist route requires authentication (same cookie as Phase 1).
router.use(authenticate);

interface ChecklistItemRow {
  id: string;
  category_id: string;
  category_name: string;
  category_description: string | null;
  category_order: number;
  title: string;
  description: string | null;
  severity: Severity;
  remediation_guidance: string | null;
  applicable_site_types: string | null;
  item_order: number;
}

interface AnswerRow {
  checklist_item_id: string;
  status: string;
  notes: string | null;
  reviewed_at: string | null;
}

interface RunListRow extends QaRun {
  answered: number;
}

function getProject(req: AuthenticatedRequest, res: Response): Project | null {
  const project = getDb()
    .prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?')
    .get(req.params.projectId, req.user!.userId) as Project | undefined;

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return project;
}

/** Phase 1 wrote `not_reviewed` as the column default; treat it as "not checked". */
function normalizeStatus(raw: string | undefined): AnswerStatus {
  switch (raw) {
    case 'pass':
    case 'fail':
    case 'needs_review':
    case 'not_applicable':
      return raw;
    default:
      return 'not_checked';
  }
}

/** An item applies unless it names specific website types and this project is not one of them. */
function isApplicable(row: ChecklistItemRow, websiteType: string): boolean {
  if (!row.applicable_site_types) return true;
  return row.applicable_site_types
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .includes(websiteType);
}

function loadApplicableItems(project: Project): ChecklistItemRow[] {
  const rows = getDb()
    .prepare(
      `SELECT i.id, i.category_id, c.name AS category_name, c.description AS category_description,
              c."order" AS category_order, i.title, i.description, i.severity, i.remediation_guidance,
              i.applicable_site_types, i."order" AS item_order
         FROM checklist_items i
         JOIN checklist_categories c ON c.id = i.category_id
        WHERE i.active = 1 AND c.active = 1
        ORDER BY c."order" ASC, i."order" ASC`,
    )
    .all() as ChecklistItemRow[];

  return rows.filter((row) => isApplicable(row, project.website_type));
}

/** Runs newest first. The first one is the current run (Phase 3: a run is never deleted). */
function listRunRows(project: Project): RunListRow[] {
  return getDb()
    .prepare(
      `SELECT r.*,
              (SELECT COUNT(*) FROM qa_results res
                WHERE res.qa_run_id = r.id
                  AND res.status IN ('pass', 'fail', 'needs_review', 'not_applicable')) AS answered
         FROM qa_runs r
        WHERE r.project_id = ?
        ORDER BY r.created_at DESC, r.rowid DESC`,
    )
    .all(project.id) as RunListRow[];
}

function getCurrentRun(project: Project): QaRun | null {
  return (listRunRows(project)[0] as QaRun | undefined) ?? null;
}

function createRun(project: Project, label: string | null): QaRun {
  const db = getDb();
  const now = new Date().toISOString();
  const run: QaRun = {
    id: uuidv4(),
    project_id: project.id,
    label,
    version: '1.0',
    started_at: now,
    completed_at: null,
    score: null,
    completion_percentage: null,
    launch_status: null,
    created_at: now,
    updated_at: now,
  };

  db.prepare(
    `INSERT INTO qa_runs
       (id, project_id, label, version, started_at, completed_at, score, completion_percentage, launch_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)`,
  ).run(run.id, run.project_id, run.label, run.version, run.started_at, now, now);

  return run;
}

/** Phase 2 behaviour: the checklist page always has a run to show. */
function getOrCreateRun(project: Project): QaRun {
  return getCurrentRun(project) ?? createRun(project, 'Launch review');
}

/** Copy the previous run's real answers into a new run as its starting point. */
function carryAnswersForward(previousRunId: string, newRunId: string, reviewedBy: string): number {
  const db = getDb();
  const now = new Date().toISOString();
  const rows = db
    .prepare(
      `SELECT checklist_item_id, status, notes FROM qa_results
        WHERE qa_run_id = ? AND status IN ('pass', 'fail', 'needs_review', 'not_applicable')`,
    )
    .all(previousRunId) as Array<{ checklist_item_id: string; status: string; notes: string | null }>;

  const insert = db.prepare(
    `INSERT INTO qa_results (id, qa_run_id, checklist_item_id, status, notes, reviewed_at, reviewed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const row of rows) {
    insert.run(uuidv4(), newRunId, row.checklist_item_id, row.status, row.notes, now, reviewedBy);
  }

  return rows.length;
}

function loadAnswers(runId: string): Map<string, AnswerRow> {
  const rows = getDb()
    .prepare('SELECT checklist_item_id, status, notes, reviewed_at FROM qa_results WHERE qa_run_id = ?')
    .all(runId) as AnswerRow[];

  return new Map(rows.map((row) => [row.checklist_item_id, row]));
}

function toScorable(items: ChecklistItemRow[], answers: Map<string, AnswerRow>): ScorableItem[] {
  return items.map((item) => ({
    id: item.id,
    categoryId: item.category_id,
    categoryName: item.category_name,
    severity: item.severity,
    status: normalizeStatus(answers.get(item.id)?.status),
  }));
}

/** The run history as the client renders it. */
function serializeRuns(project: Project) {
  const rows = listRunRows(project);
  return rows.map((row, index) => ({
    id: row.id,
    label: row.label,
    started_at: row.started_at,
    completed_at: row.completed_at,
    score: row.score,
    completion_percentage: row.completion_percentage,
    launch_status: row.launch_status as ReadinessStatus | null,
    answered: row.answered ?? 0,
    is_current: index === 0,
  }));
}

/**
 * Build the whole checklist response for one run: the run, the items grouped by
 * category with their answers, the deterministically computed summary, and the run
 * history. Also persists the computed score onto the run row.
 */
function buildChecklist(project: Project, run: QaRun) {
  const db = getDb();
  const items = loadApplicableItems(project);
  const answers = loadAnswers(run.id);

  const summary = computeScore(toScorable(items, answers));
  const now = new Date().toISOString();
  const completedAt =
    summary.completionPercentage === 100 && summary.counts.total > 0 ? (run.completed_at ?? now) : null;

  db.prepare(
    `UPDATE qa_runs
        SET score = ?, completion_percentage = ?, launch_status = ?, completed_at = ?, updated_at = ?
      WHERE id = ?`,
  ).run(
    summary.score,
    summary.completionPercentage,
    summary.readiness.status,
    completedAt,
    now,
    run.id,
  );

  const categoryOrder: string[] = [];
  const categories = new Map<
    string,
    {
      id: string;
      name: string;
      description: string | null;
      items: Array<{
        id: string;
        title: string;
        description: string | null;
        severity: Severity;
        remediation: string | null;
        status: AnswerStatus;
        notes: string | null;
        reviewed_at: string | null;
      }>;
    }
  >();

  for (const item of items) {
    if (!categories.has(item.category_id)) {
      categoryOrder.push(item.category_id);
      categories.set(item.category_id, {
        id: item.category_id,
        name: item.category_name,
        description: item.category_description,
        items: [],
      });
    }
    const answer = answers.get(item.id);
    categories.get(item.category_id)!.items.push({
      id: item.id,
      title: item.title,
      description: item.description,
      severity: item.severity,
      remediation: item.remediation_guidance,
      status: normalizeStatus(answer?.status),
      notes: answer?.notes ?? null,
      reviewed_at: answer?.reviewed_at ?? null,
    });
  }

  const runs = serializeRuns(project);

  return {
    run: {
      id: run.id,
      project_id: run.project_id,
      label: run.label,
      version: run.version,
      started_at: run.started_at,
      completed_at: completedAt,
      score: summary.score,
      completion_percentage: summary.completionPercentage,
      launch_status: summary.readiness.status,
      created_at: run.created_at,
      updated_at: now,
    },
    summary,
    categories: categoryOrder.map((id) => categories.get(id)!),
    runs,
    currentRunId: runs.find((entry) => entry.is_current)?.id ?? run.id,
    is_current: runs[0]?.id === run.id,
  };
}

/** Fetch one run of this project, or null. */
function findRun(project: Project, runId: string): QaRun | null {
  const row = getDb()
    .prepare('SELECT * FROM qa_runs WHERE id = ? AND project_id = ?')
    .get(runId, project.id) as QaRun | undefined;
  return row ?? null;
}

/** One side of a comparison: the run's headline numbers plus its per-item answers. */
function buildComparisonSide(run: QaRun, items: ChecklistItemRow[]) {
  const answers = loadAnswers(run.id);
  const scorable = toScorable(items, answers);
  const summary = computeScore(scorable);

  const comparable: ComparableItem[] = items.map((item, index) => ({
    id: item.id,
    title: item.title,
    categoryId: item.category_id,
    categoryName: item.category_name,
    severity: item.severity,
    status: scorable[index].status,
  }));

  return {
    snapshot: {
      runId: run.id,
      label: run.label,
      startedAt: run.started_at,
      score: summary.score,
      completionPercentage: summary.completionPercentage,
      readiness: summary.readiness.status,
    },
    items: comparable,
  };
}

// GET /api/projects/:projectId/qa — current run: checklist + score + run history
router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const project = getProject(req, res);
  if (!project) return;

  res.json(buildChecklist(project, getOrCreateRun(project)));
});

// GET /api/projects/:projectId/qa/runs — run history, newest first
router.get('/runs', (req: AuthenticatedRequest, res: Response): void => {
  const project = getProject(req, res);
  if (!project) return;

  const runs = serializeRuns(project);
  res.json({ runs, currentRunId: runs.find((entry) => entry.is_current)?.id ?? null });
});

// POST /api/projects/:projectId/qa/runs — start a new run (carries answers forward by default)
router.post('/runs', (req: AuthenticatedRequest, res: Response): void => {
  const project = getProject(req, res);
  if (!project) return;

  const parsed = CreateRunSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const previous = getCurrentRun(project);
  const label = parsed.data.label?.trim() || `Run ${listRunRows(project).length + 1}`;
  const run = createRun(project, label);

  try {
    if (parsed.data.carryForward !== false && previous) {
      carryAnswersForward(previous.id, run.id, req.user!.email);
    }
  } catch (err) {
    // Never leave a half-built run behind in the history.
    const db = getDb();
    db.prepare('DELETE FROM qa_results WHERE qa_run_id = ?').run(run.id);
    db.prepare('DELETE FROM qa_runs WHERE id = ?').run(run.id);
    persistDb();
    console.error('[qa] failed to start a new run:', err);
    res.status(500).json({ error: 'Unable to start a new run' });
    return;
  }

  const payload = buildChecklist(project, run);
  persistDb();

  res.status(201).json(payload);
});

// GET /api/projects/:projectId/qa/runs/:baseId/compare/:headId — run-over-run comparison
router.get('/runs/:baseId/compare/:headId', (req: AuthenticatedRequest, res: Response): void => {
  const project = getProject(req, res);
  if (!project) return;

  const baseRun = findRun(project, String(req.params.baseId));
  const headRun = findRun(project, String(req.params.headId));
  if (!baseRun || !headRun) {
    res.status(404).json({ error: 'QA run not found for this project' });
    return;
  }

  const items = loadApplicableItems(project);
  const comparison = compareRuns(
    buildComparisonSide(baseRun, items),
    buildComparisonSide(headRun, items),
  );

  res.json({ comparison });
});

// GET /api/projects/:projectId/qa/runs/:runId — one run's checklist (past runs are read only)
router.get('/runs/:runId', (req: AuthenticatedRequest, res: Response): void => {
  const project = getProject(req, res);
  if (!project) return;

  const run = findRun(project, String(req.params.runId));
  if (!run) {
    res.status(404).json({ error: 'QA run not found for this project' });
    return;
  }

  res.json(buildChecklist(project, run));
});

// PATCH /api/projects/:projectId/qa/answers/:itemId — set status and/or notes on the current run
router.patch('/answers/:itemId', (req: AuthenticatedRequest, res: Response): void => {
  const project = getProject(req, res);
  if (!project) return;

  const parsed = UpdateAnswerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const item = loadApplicableItems(project).find((row) => row.id === req.params.itemId);
  if (!item) {
    res.status(404).json({ error: 'Checklist item not found for this project' });
    return;
  }

  const db = getDb();
  const run = getOrCreateRun(project);
  const existing = db
    .prepare('SELECT * FROM qa_results WHERE qa_run_id = ? AND checklist_item_id = ?')
    .get(run.id, item.id) as (AnswerRow & { id: string; qa_run_id: string; reviewed_by: string | null }) | undefined;

  const status: AnswerStatus = parsed.data.status
    ? normalizeStatus(parsed.data.status)
    : normalizeStatus(existing?.status);
  const notes = parsed.data.notes !== undefined ? (parsed.data.notes || null) : (existing?.notes ?? null);
  const now = new Date().toISOString();
  const reviewedAt = status === 'not_checked' ? null : now;

  if (existing) {
    db.prepare(
      'UPDATE qa_results SET status = ?, notes = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?',
    ).run(status, notes, reviewedAt, req.user!.email, existing.id);
  } else {
    db.prepare(
      `INSERT INTO qa_results (id, qa_run_id, checklist_item_id, status, notes, reviewed_at, reviewed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(uuidv4(), run.id, item.id, status, notes, reviewedAt, req.user!.email);
  }

  const payload = buildChecklist(project, run);
  persistDb();

  const saved = payload.categories
    .flatMap((category) => category.items)
    .find((entry) => entry.id === item.id);

  res.json({
    item: saved,
    summary: payload.summary,
    run: payload.run,
    runs: payload.runs,
    currentRunId: payload.currentRunId,
    is_current: payload.is_current,
  });
});

/**
 * Build the shared report model for one run, optionally compared against an earlier run.
 * Returns null after writing an error response (unknown run, or an unknown comparison run).
 */
function buildReport(req: AuthenticatedRequest, res: Response, project: Project, run: QaRun) {
  const payload = buildChecklist(project, run);

  let comparison: RunComparison | null = null;
  const compareToId = typeof req.query.compareTo === 'string' ? req.query.compareTo.trim() : '';
  if (compareToId && compareToId !== run.id) {
    const baseRun = findRun(project, compareToId);
    if (!baseRun) {
      res.status(404).json({ error: 'Comparison run not found for this project' });
      return null;
    }
    const items = loadApplicableItems(project);
    comparison = compareRuns(
      buildComparisonSide(baseRun, items),
      buildComparisonSide(run, items),
    );
  }

  return buildReportModel({
    project,
    run,
    categories: payload.categories,
    summary: payload.summary,
    comparison,
  });
}

// GET /api/projects/:projectId/qa/runs/:runId/report.html — self-contained HTML report
router.get('/runs/:runId/report.html', (req: AuthenticatedRequest, res: Response): void => {
  const project = getProject(req, res);
  if (!project) return;

  const run = findRun(project, String(req.params.runId));
  if (!run) {
    res.status(404).json({ error: 'QA run not found for this project' });
    return;
  }

  const model = buildReport(req, res, project, run);
  if (!model) return;

  persistDb();

  res
    .status(200)
    .setHeader('Content-Type', 'text/html; charset=utf-8')
    .setHeader('Content-Disposition', `attachment; filename="${reportFilename(model, 'html')}"`)
    .setHeader('Cache-Control', 'no-store')
    .send(renderReportHtml(model));
});

// GET /api/projects/:projectId/qa/runs/:runId/report.pdf — generated PDF report
router.get('/runs/:runId/report.pdf', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const project = getProject(req, res);
  if (!project) return;

  const run = findRun(project, String(req.params.runId));
  if (!run) {
    res.status(404).json({ error: 'QA run not found for this project' });
    return;
  }

  const model = buildReport(req, res, project, run);
  if (!model) return;

  try {
    const bytes = await renderReportPdf(model);
    persistDb();
    res
      .status(200)
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="${reportFilename(model, 'pdf')}"`)
      .setHeader('Cache-Control', 'no-store')
      .send(Buffer.from(bytes));
  } catch (err) {
    console.error('[qa] failed to render PDF report:', err);
    res.status(500).json({ error: 'Unable to generate the PDF report' });
  }
});

export default router;
