// blueprint-app/server/src/routes/clientPortal.ts
//
// The client-facing portal endpoint, deliberately OUTSIDE the authenticated
// project router.
//
// `GET /api/projects/:id/client-view?token=…` is opened by a CLIENT — someone
// with no Blueprint account and therefore no session cookie. In the monolith the
// handler lived inside `routes/projects.ts` below a blanket
// `router.use(authenticate)`, so an emailed client link answered 401 for
// everyone who was not logged in (a pre-existing bug the Phase 2 port carried
// over). The route is now mounted on its own router BEFORE `projectRoutes` in
// index.ts, which makes it token-only: the `project_members.access_token` IS the
// credential.
//
// Security notes:
//  - The token is scoped to one project (`WHERE project_id = ? AND access_token = ?`),
//    so a valid token only ever exposes its own project.
//  - The response is read-only and limited to the client-portal shape (project
//    summary, pages, questionnaires) — no user ids, no Stripe data, no members list.

import { Router, type Request, type Response } from 'express';
import { getDb } from '../db.js';

const router = Router();

// GET /api/projects/:id/client-view?token=xxx — client portal access
router.get('/:id/client-view', (req: Request, res: Response): void => {
  const db = getDb();
  const token = req.query.token as string;
  if (!token) { res.status(401).json({ error: 'Access token required' }); return; }

  const member = db.prepare('SELECT * FROM project_members WHERE project_id = ? AND access_token = ?').get(req.params.id, token) as any;
  if (!member) { res.status(403).json({ error: 'Invalid access token' }); return; }

  const project = db.prepare('SELECT id, title, description, branding_primary_color, branding_secondary_color FROM projects WHERE id = ?').get(req.params.id) as any;
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }

  const pages = db.prepare('SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order').all(req.params.id) as any[];
  const isClient = member.role === 'client';

  // For each page, get questionnaires
  const pagesWithData = pages.map((p: any) => {
    const q = db.prepare('SELECT questions, answers FROM questionnaires WHERE page_id = ?').get(p.id) as any;
    return {
      ...p,
      questionnaire: q ? { questions: JSON.parse(q.questions || '[]'), answers: q.answers ? JSON.parse(q.answers) : {} } : null,
    };
  });

  res.json({
    project: { id: project.id, title: project.title, description: project.description,
      branding_primary_color: project.branding_primary_color, branding_secondary_color: project.branding_secondary_color },
    member: { role: member.role, email: member.email },
    isClient,
    pages: pagesWithData,
  });
});

export default router;
