import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../db.js';
import { CreateProjectSchema, UpdateProjectSchema } from '../schemas/projects.js';
import type { AuthenticatedRequest, Project } from '../types.js';
import { authenticate } from '../middleware/auth.js';
import { checkProjectLimit, requirePaidTier, incrementProjectCount } from '../middleware/projectLimit.js';
import { projectCreateCooldown } from '../middleware/limits.js';
import { buildAppLink, sendProjectInviteEmail, type EmailResult } from '../emailService.js';

/** Absolute origin of the current request, used to build emailed links. */
function requestOrigin(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0].trim() || req.protocol;
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.get('host');
  return host ? `${proto}://${host}` : '';
}

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
router.post('/', checkProjectLimit, projectCreateCooldown, (req: AuthenticatedRequest, res: Response): void => {
  const parsed = CreateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { title, description } = parsed.data;
  const db = getDb();
  const id = crypto.randomUUID();

  db.prepare(
    'INSERT INTO projects (id, user_id, title, description) VALUES (?, ?, ?, ?)'
  ).run(id, req.user!.userId, title, description ?? null);

  // Increment monthly project counter for paid tiers
  incrementProjectCount(req.user!.userId, req.user!.subscriptionTier || 'FREE');

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
      message: 'Custom branding is exclusive to Nuria Website Blueprint Premium. Please upgrade your plan.',
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

// ── Project Collaboration ─────────────────────────────────────

// GET /api/projects/:id/members
router.get('/:id/members', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const project = db.prepare('SELECT user_id FROM projects WHERE id = ?').get(req.params.id) as any;
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  if (project.user_id !== req.user!.userId) { res.status(403).json({ error: 'Access denied' }); return; }

  const members = db.prepare('SELECT id, email, role, status, invited_at FROM project_members WHERE project_id = ?').all(req.params.id);
  res.json({ members: members || [] });
});

// POST /api/projects/:id/invite — invite a collaborator
router.post('/:id/invite', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { email, role } = req.body;
  if (!email) { res.status(400).json({ error: 'Email is required' }); return; }

  const db = getDb();
  const project = db.prepare('SELECT user_id, title FROM projects WHERE id = ?').get(req.params.id) as any;
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  if (project.user_id !== req.user!.userId) { res.status(403).json({ error: 'Only the project owner can invite members' }); return; }

  const validRoles = ['editor', 'client'];
  const memberRole = validRoles.includes(role) ? role : 'editor';

  const existing = db.prepare('SELECT id FROM project_members WHERE project_id = ? AND email = ?').get(req.params.id, email.toLowerCase().trim());
  if (existing) { res.status(409).json({ error: 'Already invited' }); return; }

  const id = crypto.randomUUID();
  const token = crypto.randomBytes(16).toString('hex');
  db.prepare('INSERT INTO project_members (id, project_id, email, role, access_token, status) VALUES (?, ?, ?, ?, ?, ?)').run(id, req.params.id, email.toLowerCase().trim(), memberRole, token, 'invited');

  // Email the portal link. The recipient is a CLIENT of the planner, so the link
  // carries the project-scoped access token and opens without an account (see
  // routes/clientPortal.ts). Delivery never blocks the invite from being
  // recorded: a Resend failure is logged and reported, not thrown.
  const portalLink = buildAppLink(
    `/project/${encodeURIComponent(String(req.params.id))}/client?token=${encodeURIComponent(token)}`,
    requestOrigin(req),
  );
  let emailResult: EmailResult = { delivered: false, transport: 'log' };
  try {
    emailResult = await sendProjectInviteEmail({
      to: email.toLowerCase().trim(),
      projectTitle: project.title || 'your website plan',
      portalLink,
      role: memberRole,
      invitedByEmail: req.user!.email,
    });
  } catch (err: any) {
    console.error('[Blueprint] Failed to send project invite email:', err?.message ?? err);
  }

  res.status(201).json({
    id,
    email: email.toLowerCase().trim(),
    role: memberRole,
    status: 'invited',
    accessToken: token,
    portalLink,
    emailDelivery: { transport: emailResult.transport, delivered: emailResult.delivered },
  });
});

// DELETE /api/projects/:id/members/:memberId
router.delete('/:id/members/:memberId', (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const project = db.prepare('SELECT user_id FROM projects WHERE id = ?').get(req.params.id) as any;
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
  if (project.user_id !== req.user!.userId) { res.status(403).json({ error: 'Access denied' }); return; }

  db.prepare('DELETE FROM project_members WHERE id = ? AND project_id = ?').run(req.params.memberId, req.params.id);
  res.json({ success: true });
});

// NOTE: GET /api/projects/:id/client-view lives in routes/clientPortal.ts and is
// mounted BEFORE this router in index.ts — a client opening an emailed link has
// no session cookie, so it must not pass through `authenticate`.

export default router;
