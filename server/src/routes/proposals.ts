import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { UpdateProposalSchema } from '../schemas/pages.js';
import { AuthenticatedRequest, Proposal, Project } from '../types.js';
import { authenticate } from '../middleware/auth.js';
import { requirePaidTier } from '../middleware/projectLimit.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

// GET /api/projects/:projectId/proposal
router.get('/:projectId/proposal', (req: AuthenticatedRequest, res: Response): void => {
  const { projectId } = req.params;
  const db = getDb();

  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, req.user!.userId) as Project | undefined;
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const proposal = db.prepare('SELECT * FROM proposals WHERE project_id = ?').get(projectId) as Proposal | undefined;

  if (!proposal) {
    // Return empty proposal structure if none exists yet
    res.json({
      id: null,
      project_id: projectId,
      client_name: '',
      executive_summary: null,
      pricing_estimate: null,
      timeline_weeks: 4,
      terms_conditions: null,
      status: 'draft',
      created_at: null,
      updated_at: null,
    });
    return;
  }

  res.json(proposal);
});

// PUT /api/projects/:projectId/proposal
router.put('/:projectId/proposal', (req: AuthenticatedRequest, res: Response): void => {
  const { projectId } = req.params;
  const db = getDb();

  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, req.user!.userId) as Project | undefined;
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const parsed = UpdateProposalSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;

  // Check if proposal exists
  const existing = db.prepare('SELECT id FROM proposals WHERE project_id = ?').get(projectId);

  if (existing) {
    const updates: string[] = [];
    const values: any[] = [];

    if (data.client_name !== undefined) { updates.push('client_name = ?'); values.push(data.client_name); }
    if (data.executive_summary !== undefined) { updates.push('executive_summary = ?'); values.push(data.executive_summary); }
    if (data.pricing_estimate !== undefined) { updates.push('pricing_estimate = ?'); values.push(data.pricing_estimate); }
    if (data.timeline_weeks !== undefined) { updates.push('timeline_weeks = ?'); values.push(data.timeline_weeks); }
    if (data.terms_conditions !== undefined) { updates.push('terms_conditions = ?'); values.push(data.terms_conditions); }
    if (data.status !== undefined) { updates.push('status = ?'); values.push(data.status); }

    if (updates.length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(projectId);

    db.prepare(`UPDATE proposals SET ${updates.join(', ')} WHERE project_id = ?`).run(...values);
  } else {
    const id = uuidv4();
    db.prepare(
      'INSERT INTO proposals (id, project_id, client_name, executive_summary, pricing_estimate, timeline_weeks, terms_conditions, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      id,
      projectId,
      data.client_name || 'New Client',
      data.executive_summary ?? null,
      data.pricing_estimate ?? null,
      data.timeline_weeks ?? 4,
      data.terms_conditions ?? null,
      data.status ?? 'draft'
    );
  }

  const proposal = db.prepare('SELECT * FROM proposals WHERE project_id = ?').get(projectId) as Proposal;
  res.json(proposal);
});

export default router;