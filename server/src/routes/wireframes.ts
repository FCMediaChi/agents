import { Router, Response } from 'express';
import { getDb } from '../db.js';
import { UpdateBlocksSchema } from '../schemas/pages.js';
import { AuthenticatedRequest, Wireframe } from '../types.js';
import { authenticate } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

// GET /api/pages/:pageId/wireframe
router.get('/:pageId/wireframe', (req: AuthenticatedRequest, res: Response): void => {
  const { pageId } = req.params;
  const db = getDb();

  const page = db.prepare(`
    SELECT p.id FROM pages p
    JOIN projects pr ON p.project_id = pr.id
    WHERE p.id = ? AND pr.user_id = ?
  `).get(pageId, req.user!.userId);

  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }

  const wireframe = db.prepare('SELECT * FROM wireframes WHERE page_id = ?').get(pageId) as Wireframe | undefined;

  if (!wireframe) {
    res.status(404).json({ error: 'Wireframe not found' });
    return;
  }

  res.json({
    id: wireframe.id,
    page_id: wireframe.page_id,
    blocks: JSON.parse(wireframe.blocks),
    created_at: wireframe.created_at,
    updated_at: wireframe.updated_at,
  });
});

// PUT /api/pages/:pageId/wireframe
router.put('/:pageId/wireframe', (req: AuthenticatedRequest, res: Response): void => {
  const { pageId } = req.params;
  const db = getDb();

  const page = db.prepare(`
    SELECT p.id FROM pages p
    JOIN projects pr ON p.project_id = pr.id
    WHERE p.id = ? AND pr.user_id = ?
  `).get(pageId, req.user!.userId);

  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }

  const parsed = UpdateBlocksSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { blocks } = parsed.data;
  const blocksJson = JSON.stringify(blocks);

  db.prepare(
    'UPDATE wireframes SET blocks = ?, updated_at = CURRENT_TIMESTAMP WHERE page_id = ?'
  ).run(blocksJson, pageId);

  const wireframe = db.prepare('SELECT * FROM wireframes WHERE page_id = ?').get(pageId) as Wireframe;

  res.json({
    id: wireframe.id,
    page_id: wireframe.page_id,
    blocks: JSON.parse(wireframe.blocks),
    created_at: wireframe.created_at,
    updated_at: wireframe.updated_at,
  });
});

export default router;