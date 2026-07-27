import { Router, Response } from 'express';
import { getDb } from '../db.js';
import { UpdateAnswersSchema } from '../schemas/pages.js';
import { AuthenticatedRequest, Questionnaire } from '../types.js';
import { authenticate } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

// GET /api/pages/:pageId/questionnaire
router.get('/:pageId/questionnaire', (req: AuthenticatedRequest, res: Response): void => {
  const { pageId } = req.params;
  const db = getDb();

  // Verify page belongs to a project owned by the user
  const page = db.prepare(`
    SELECT p.id FROM pages p
    JOIN projects pr ON p.project_id = pr.id
    WHERE p.id = ? AND pr.user_id = ?
  `).get(pageId, req.user!.userId);

  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }

  const questionnaire = db.prepare('SELECT * FROM questionnaires WHERE page_id = ?').get(pageId) as Questionnaire | undefined;

  if (!questionnaire) {
    res.status(404).json({ error: 'Questionnaire not found' });
    return;
  }

  res.json({
    id: questionnaire.id,
    page_id: questionnaire.page_id,
    questions: JSON.parse(questionnaire.questions),
    answers: JSON.parse(questionnaire.answers),
    created_at: questionnaire.created_at,
    updated_at: questionnaire.updated_at,
  });
});

// PUT /api/pages/:pageId/questionnaire
router.put('/:pageId/questionnaire', (req: AuthenticatedRequest, res: Response): void => {
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

  const parsed = UpdateAnswersSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { answers } = parsed.data;
  const answersJson = JSON.stringify(answers);

  db.prepare(
    'UPDATE questionnaires SET answers = ?, updated_at = CURRENT_TIMESTAMP WHERE page_id = ?'
  ).run(answersJson, pageId);

  const questionnaire = db.prepare('SELECT * FROM questionnaires WHERE page_id = ?').get(pageId) as Questionnaire;

  res.json({
    id: questionnaire.id,
    page_id: questionnaire.page_id,
    questions: JSON.parse(questionnaire.questions),
    answers: JSON.parse(questionnaire.answers),
    created_at: questionnaire.created_at,
    updated_at: questionnaire.updated_at,
  });
});

export default router;