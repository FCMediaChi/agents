import { Router, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import type { AuthenticatedRequest, Project } from '../types.js';
import { authenticate } from '../middleware/auth.js';
import { CreateProjectSchema, UpdateProjectSchema } from '../schemas/projects.js';

const router = Router();

// All project routes require authentication.
router.use(authenticate);

// Normalize empty strings to null for optional text fields.
function toNull(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  return (value as string | null) ?? null;
}

function projectFromRow(row: Project): Project {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    website_url: row.website_url ?? null,
    client_name: row.client_name ?? null,
    platform: row.platform,
    website_type: row.website_type,
    notes: row.notes ?? null,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// GET /api/projects
router.get('/', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM projects WHERE user_id = ? ORDER BY updated_at DESC'
  ).all(req.user!.userId) as Project[];
  res.json(rows.map(projectFromRow));
});

// POST /api/projects
router.post('/', (req: AuthenticatedRequest, res: Response): void => {
  const parsed = CreateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const data = parsed.data;
  const db = getDb();
  const id = uuidv4();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO projects
      (id, user_id, name, website_url, client_name, platform, website_type, notes, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    req.user!.userId,
    data.name,
    toNull(data.website_url),
    toNull(data.client_name),
    data.platform,
    data.website_type,
    toNull(data.notes),
    data.status,
    now,
    now,
  );

  const row = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(id, req.user!.userId) as Project;
  res.status(201).json(projectFromRow(row));
});

// GET /api/projects/:id
router.get('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.userId) as Project | undefined;
  if (!row) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json(projectFromRow(row));
});

// PUT /api/projects/:id
router.put('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const parsed = UpdateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const db = getDb();
  const existing = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.userId) as Project | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const data = parsed.data;
  const now = new Date().toISOString();

  const name = data.name ?? existing.name;
  const websiteUrl = data.website_url !== undefined ? toNull(data.website_url) : existing.website_url;
  const clientName = data.client_name !== undefined ? toNull(data.client_name) : existing.client_name;
  const platform = data.platform ?? existing.platform;
  const websiteType = data.website_type ?? existing.website_type;
  const notes = data.notes !== undefined ? toNull(data.notes) : existing.notes;
  const status = data.status ?? existing.status;

  db.prepare(
    `UPDATE projects SET
       name = ?, website_url = ?, client_name = ?, platform = ?, website_type = ?, notes = ?, status = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(name, websiteUrl, clientName, platform, websiteType, notes, status, now, req.params.id, req.user!.userId);

  const row = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.userId) as Project;
  res.json(projectFromRow(row));
});

// DELETE /api/projects/:id
router.delete('/:id', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const result = db.prepare('DELETE FROM projects WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.userId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json({ success: true });
});

export default router;
