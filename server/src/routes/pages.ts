import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import slugify from '../utils/slugify.js';
import { getDb } from '../db.js';
import { CreatePageSchema, UpdatePageSchema, UpdateOutlineSchema } from '../schemas/pages.js';
import { AuthenticatedRequest, Page, Project } from '../types.js';
import { authenticate } from '../middleware/auth.js';

const router = Router({ mergeParams: true });

router.use(authenticate);

// Helper: verify project ownership
function getProject(projectId: string, userId: string): Project | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId) as Project | undefined;
}

// Default questionnaire questions by page type
function getDefaultQuestions(pageType: string): string[] {
  const questions: Record<string, string[]> = {
    homepage: [
      'What is the main headline/value proposition?',
      'What are the top 3 action items visitors should take?',
      'Who is your primary target customer segment?',
    ],
    about: [
      'What is the founding story/mission statement of the business?',
      'What are your primary values/guarantees?',
      'Who are the key team members?',
    ],
    services: [
      'List the core services offered.',
      'What key benefits do your services provide over competitors?',
      'What testimonials support these services?',
    ],
    contact: [
      'What contact details should be prominent (phone, email, map)?',
      'What details must be present in the contact form?',
      'What is the average expected response time?',
    ],
    blog: [
      'What categories or topics will be written about?',
      'How frequently will new articles be published?',
      'Are author bios/profiles required?',
    ],
    pricing: [
      'What are the names and costs of each pricing tier?',
      'List the key features included in each tier.',
      'What is the refund policy or guarantee?',
    ],
    generic: [
      'What is the main purpose of this page?',
      'What content needs to be written for this page?',
      'What call to action should be at the bottom?',
    ],
  };
  return questions[pageType] || questions.generic;
}

// Default wireframe blocks by page type
function getDefaultBlocks(pageType: string): any[] {
  const blocks: Record<string, any[]> = {
    homepage: [
      { id: `blk-hdr-${uuidv4().slice(0, 8)}`, type: 'header', title: 'Site Logo', subtitle: 'Nav: Home, About, Services, Contact', content: 'CTA Button: [Get Started]', order: 0 },
      { id: `blk-hero-${uuidv4().slice(0, 8)}`, type: 'hero', title: 'Main Headline', subtitle: 'Supporting subheadline text', content: 'Button: [Primary CTA]', order: 1 },
      { id: `blk-feat-${uuidv4().slice(0, 8)}`, type: 'features', title: 'Features', subtitle: '3-column grid layout', content: 'Feature 1 | Feature 2 | Feature 3', order: 2 },
      { id: `blk-cta-${uuidv4().slice(0, 8)}`, type: 'cta', title: 'Final Call to Action', subtitle: 'Encourage conversion', content: 'Button: [Get Started Free]', order: 3 },
      { id: `blk-ftr-${uuidv4().slice(0, 8)}`, type: 'footer', title: 'Footer', subtitle: 'Links & Copyright', content: 'Social: Twitter, LinkedIn', order: 4 },
    ],
    generic: [
      { id: `blk-hdr-${uuidv4().slice(0, 8)}`, type: 'header', title: 'Page Header', subtitle: 'Navigation', content: 'Logo + Nav', order: 0 },
      { id: `blk-ctnt-${uuidv4().slice(0, 8)}`, type: 'content', title: 'Page Content', subtitle: 'Main content area', content: 'Text, images, and media', order: 1 },
      { id: `blk-ftr-${uuidv4().slice(0, 8)}`, type: 'footer', title: 'Footer', subtitle: 'Copyright & Links', content: 'Standard footer', order: 2 },
    ],
  };
  return blocks[pageType] || blocks.generic;
}

// GET /api/projects/:projectId/pages
router.get('/:projectId/pages', (req: AuthenticatedRequest, res: Response): void => {
  const { projectId } = req.params;
  if (!getProject(projectId, req.user!.userId)) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const db = getDb();
  const pages = db.prepare(
    'SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order ASC'
  ).all(projectId);

  res.json(pages);
});

// POST /api/projects/:projectId/pages
router.post('/:projectId/pages', (req: AuthenticatedRequest, res: Response): void => {
  const { projectId } = req.params;
  if (!getProject(projectId, req.user!.userId)) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const parsed = CreatePageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { title, parent_id, page_type, sort_order } = parsed.data;
  const db = getDb();
  const id = uuidv4();

  // Auto-generate slug
  const slug = slugify(title);

  // Determine sort_order if not provided
  let order = sort_order;
  if (order === undefined) {
    const maxOrder = db.prepare(
      'SELECT MAX(sort_order) as max_order FROM pages WHERE project_id = ?'
    ).get(projectId) as { max_order: number | null };
    order = (maxOrder?.max_order ?? -1) + 1;
  }

  db.prepare(
    'INSERT INTO pages (id, project_id, parent_id, title, slug, sort_order, page_type) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, projectId, parent_id ?? null, title, slug, order, page_type);

  const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as Page;

  // Auto-create questionnaire with default questions
  const qId = uuidv4();
  const questions = JSON.stringify(getDefaultQuestions(page_type));
  db.prepare(
    'INSERT INTO questionnaires (id, page_id, questions) VALUES (?, ?, ?)'
  ).run(qId, id, questions);

  // Auto-create wireframe with default blocks
  const wId = uuidv4();
  const blocks = JSON.stringify(getDefaultBlocks(page_type));
  db.prepare(
    'INSERT INTO wireframes (id, page_id, blocks) VALUES (?, ?, ?)'
  ).run(wId, id, blocks);

  res.status(201).json(page);
});

// PUT /api/projects/:projectId/pages/:pageId
router.put('/:projectId/pages/:pageId', (req: AuthenticatedRequest, res: Response): void => {
  const { projectId, pageId } = req.params;
  if (!getProject(projectId, req.user!.userId)) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const db = getDb();
  const page = db.prepare('SELECT * FROM pages WHERE id = ? AND project_id = ?').get(pageId, projectId) as Page | undefined;
  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }

  const parsed = UpdatePageSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const data = parsed.data;
  const updates: string[] = [];
  const values: any[] = [];

  if (data.title !== undefined) { updates.push('title = ?'); values.push(data.title); updates.push('slug = ?'); values.push(slugify(data.title)); }
  if (data.parent_id !== undefined) { updates.push('parent_id = ?'); values.push(data.parent_id); }
  if (data.sort_order !== undefined) { updates.push('sort_order = ?'); values.push(data.sort_order); }
  if (data.page_type !== undefined) { updates.push('page_type = ?'); values.push(data.page_type); }

  if (updates.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(pageId);

  db.prepare(`UPDATE pages SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT * FROM pages WHERE id = ?').get(pageId);
  res.json(updated);
});

// PUT /api/projects/:projectId/pages/:pageId/outline
router.put('/:projectId/pages/:pageId/outline', (req: AuthenticatedRequest, res: Response): void => {
  const { projectId, pageId } = req.params;
  if (!getProject(projectId, req.user!.userId)) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const db = getDb();
  const page = db.prepare('SELECT id FROM pages WHERE id = ? AND project_id = ?').get(pageId, projectId);
  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }

  const parsed = UpdateOutlineSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { description, goals, notes } = parsed.data;
  db.prepare(
    'UPDATE pages SET description = ?, goals = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(description ?? null, goals ?? null, notes ?? null, pageId);

  const updated = db.prepare('SELECT * FROM pages WHERE id = ?').get(pageId);
  res.json(updated);
});

// DELETE /api/projects/:projectId/pages/:pageId
router.delete('/:projectId/pages/:pageId', (req: AuthenticatedRequest, res: Response): void => {
  const { projectId, pageId } = req.params;
  if (!getProject(projectId, req.user!.userId)) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const db = getDb();
  const page = db.prepare('SELECT id FROM pages WHERE id = ? AND project_id = ?').get(pageId, projectId);
  if (!page) {
    res.status(404).json({ error: 'Page not found' });
    return;
  }

  db.prepare('DELETE FROM pages WHERE id = ?').run(pageId);
  res.json({ success: true });
});

export default router;