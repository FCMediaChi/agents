import { Router, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb, persistDb } from '../db.js';
import type { AuthenticatedRequest, Project, QaRun } from '../types.js';
import { authenticate } from '../middleware/auth.js';
import { UpdateAnswerSchema } from '../schemas/qa.js';
import type { Severity } from '../qa/catalog.js';
import { computeScore, type AnswerStatus, type ScorableItem } from '../qa/scoring.js';

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

function getOrCreateRun(project: Project): QaRun {
  const db = getDb();
  const existing = db
    .prepare('SELECT * FROM qa_runs WHERE project_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(project.id) as QaRun | undefined;

  if (existing) return existing;

  const now = new Date().toISOString();
  const run: QaRun = {
    id: uuidv4(),
    project_id: project.id,
    label: 'Launch review',
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

function loadAnswers(runId: string): Map<string, AnswerRow> {
  const rows = getDb()
    .prepare('SELECT checklist_item_id, status, notes, reviewed_at FROM qa_results WHERE qa_run_id = ?')
    .all(runId) as AnswerRow[];

  return new Map(rows.map((row) => [row.checklist_item_id, row]));
}

/**
 * Build the whole checklist response for a project: the run, the items grouped by
 * category with their answers, and the deterministically computed summary.
 * Also persists the computed score onto the run row.
 */
function buildChecklist(project: Project) {
  const db = getDb();
  const run = getOrCreateRun(project);
  const items = loadApplicableItems(project);
  const answers = loadAnswers(run.id);

  const scorable: ScorableItem[] = items.map((item) => ({
    id: item.id,
    categoryId: item.category_id,
    categoryName: item.category_name,
    severity: item.severity,
    status: normalizeStatus(answers.get(item.id)?.status),
  }));

  const summary = computeScore(scorable);
  const now = new Date().toISOString();
  const completedAt = summary.completionPercentage === 100 && summary.counts.total > 0 ? now : null;

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
  };
}

// GET /api/projects/:projectId/qa — checklist + score
router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const project = getProject(req, res);
  if (!project) return;

  res.json(buildChecklist(project));
});

// PATCH /api/projects/:projectId/qa/answers/:itemId — set status and/or notes
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

  const payload = buildChecklist(project);
  persistDb();

  const saved = payload.categories
    .flatMap((category) => category.items)
    .find((entry) => entry.id === item.id);

  res.json({ item: saved, summary: payload.summary, run: payload.run });
});

export default router;
