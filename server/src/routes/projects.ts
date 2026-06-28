import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { CreateProjectSchema, UpdateProjectSchema } from '../schemas/projects.js';
import { AuthenticatedRequest, Project } from '../types.js';
import { authenticate } from '../middleware/auth.js';
import { checkProjectLimit, requirePaidTier } from '../middleware/projectLimit.js';

const router = Router();

// All project routes require authentication
router.use(authenticate);

// GET /api/projects
router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const projects = db.prepare(
    'SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user!.userId);

  res.json(projects.map((p: any) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    branding_logo_url: p.branding_logo_url,
    branding_primary_color: p.branding_primary_color,
    branding_secondary_color: p.branding_secondary_color,
    created_at: p.created_at,
    updated_at: p.updated_at,
  })));
});

// POST /api/projects
router.post('/', checkProjectLimit, (req: AuthenticatedRequest, res: Response): void => {
  const parsed = CreateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { title, description } = parsed.data;
  const db = getDb();
  const id = uuidv4();

  db.prepare(
    'INSERT INTO projects (id, user_id, title, description) VALUES (?, ?, ?, ?)'
  ).run(id, req.user!.userId, title, description ?? null);

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project;

  res.status(201).json({
    id: project.id,
    title: project.title,
    description: project.description,
    user_id: project.user_id,
    branding_logo_url: project.branding_logo_url,
    branding_primary_color: project.branding_primary_color,
    branding_secondary_color: project.branding_secondary_color,
    created_at: project.created_at,
    updated_at: project.updated_at,
  });
});

// GET /api/projects/:id
router.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.userId) as Project | undefined;

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  res.json({
    id: project.id,
    title: project.title,
    description: project.description,
    user_id: project.user_id,
    branding_logo_url: project.branding_logo_url,
    branding_primary_color: project.branding_primary_color,
    branding_secondary_color: project.branding_secondary_color,
    created_at: project.created_at,
    updated_at: project.updated_at,
  });
});

// PUT /api/projects/:id
router.put('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.userId) as Project | undefined;

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const parsed = UpdateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;

  // Branding fields require paid tier
  if ((data.branding_logo_url !== undefined || data.branding_primary_color !== undefined || data.branding_secondary_color !== undefined) && req.user!.subscriptionTier !== 'PAID') {
    res.status(403).json({
      error: 'Premium Feature',
      message: 'Custom branding is exclusive to TheBlueprint Premium. Please upgrade your plan.',
    });
    return;
  }

  const updates: string[] = [];
  const values: any[] = [];

  if (data.title !== undefined) { updates.push('title = ?'); values.push(data.title); }
  if (data.description !== undefined) { updates.push('description = ?'); values.push(data.description); }
  if (data.branding_logo_url !== undefined) { updates.push('branding_logo_url = ?'); values.push(data.branding_logo_url); }
  if (data.branding_primary_color !== undefined) { updates.push('branding_primary_color = ?'); values.push(data.branding_primary_color); }
  if (data.branding_secondary_color !== undefined) { updates.push('branding_secondary_color = ?'); values.push(data.branding_secondary_color); }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(req.params.id);

  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id) as Project;
  res.json({
    id: updated.id,
    title: updated.title,
    description: updated.description,
    branding_logo_url: updated.branding_logo_url,
    branding_primary_color: updated.branding_primary_color,
    branding_secondary_color: updated.branding_secondary_color,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
  });
});

// DELETE /api/projects/:id
router.delete('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.userId);

  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;