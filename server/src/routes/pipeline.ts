import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { requirePipelineAccess } from '../middleware/trial.js';
import { AuthenticatedRequest } from '../types.js';
import { generateCaseStudy, auditSite, type CaseStudyInput } from '../caseStudyEngine.js';

const router = Router();

// GET /api/pipeline/me — returns user + trial info
router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const user = db.prepare(
    'SELECT id, email, subscription_tier, trial_started_at, trial_ends_at, created_at FROM users WHERE id = ?'
  ).get(req.user!.userId) as any;

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const now = new Date();
  const trialActive = user.trial_ends_at && new Date(user.trial_ends_at) > now;

  res.json({
    user: {
      id: user.id, email: user.email, subscription_tier: user.subscription_tier,
      trial_started_at: user.trial_started_at, trial_ends_at: user.trial_ends_at,
      trial_active: trialActive, created_at: user.created_at,
    },
  });
});

// --- Agency onboarding ---

// GET /api/pipeline/agency
router.get('/agency', authenticate, requirePipelineAccess, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const agency = db.prepare('SELECT * FROM pipeline_agencies WHERE user_id = ?').get(req.user!.userId);
  res.json({ agency: agency || null });
});

// POST /api/pipeline/onboarding
router.post('/onboarding', authenticate, requirePipelineAccess, (req: AuthenticatedRequest, res: Response): void => {
  const { agency_name, website_url, services, industries } = req.body;
  if (!agency_name || !agency_name.trim()) {
    res.status(400).json({ error: 'Agency name is required' });
    return;
  }
  const db = getDb();
  const existing = db.prepare('SELECT id FROM pipeline_agencies WHERE user_id = ?').get(req.user!.userId);
  if (existing) {
    res.status(409).json({ error: 'Agency already exists' });
    return;
  }
  const id = uuidv4();
  const s = Array.isArray(services) ? JSON.stringify(services) : (services || null);
  const i = Array.isArray(industries) ? JSON.stringify(industries) : (industries || null);
  db.prepare(
    'INSERT INTO pipeline_agencies (id, user_id, agency_name, website_url, services, industries) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, req.user!.userId, agency_name.trim(), website_url || null, s, i);
  const agency = db.prepare('SELECT * FROM pipeline_agencies WHERE id = ?').get(id);
  res.status(201).json({ agency });
});

// PUT /api/pipeline/agency
router.put('/agency', authenticate, requirePipelineAccess, (req: AuthenticatedRequest, res: Response): void => {
  const { agency_name, website_url, services, industries } = req.body;
  const db = getDb();
  const existing = db.prepare('SELECT id FROM pipeline_agencies WHERE user_id = ?').get(req.user!.userId);
  if (!existing) { res.status(404).json({ error: 'Agency not found' }); return; }
  const s = Array.isArray(services) ? JSON.stringify(services) : (services || null);
  const i = Array.isArray(industries) ? JSON.stringify(industries) : (industries || null);
  db.prepare(
    'UPDATE pipeline_agencies SET agency_name = ?, website_url = ?, services = ?, industries = ? WHERE user_id = ?'
  ).run(agency_name?.trim() || null, website_url || null, s, i, req.user!.userId);
  const agency = db.prepare('SELECT * FROM pipeline_agencies WHERE user_id = ?').get(req.user!.userId);
  res.json({ agency });
});

// --- Dashboard stats ---

router.get('/dashboard', authenticate, requirePipelineAccess, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const userId = req.user!.userId;
  const agency = db.prepare('SELECT * FROM pipeline_agencies WHERE user_id = ?').get(userId);
  const cs = db.prepare('SELECT COUNT(*) as c FROM pipeline_case_studies WHERE user_id = ?').get(userId) as any;
  const pc = db.prepare('SELECT COUNT(*) as c FROM pipeline_pitches WHERE user_id = ?').get(userId) as any;
  const recentCS = db.prepare('SELECT * FROM pipeline_case_studies WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(userId);
  const recentP = db.prepare('SELECT * FROM pipeline_pitches WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(userId);
  res.json({
    agency: agency || null,
    stats: { case_studies: cs?.c || 0, pitches: pc?.c || 0, meetings_booked: 0 },
    recent_case_studies: recentCS, recent_pitches: recentP,
  });
});

// --- Case Studies CRUD ---

// GET /api/pipeline/case-studies
router.get('/case-studies', authenticate, requirePipelineAccess, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const studies = db.prepare('SELECT * FROM pipeline_case_studies WHERE user_id = ? ORDER BY created_at DESC').all(req.user!.userId);
  const parsed = studies.map((s: any) => ({
    ...s,
    traffic_data: s.traffic_data ? JSON.parse(s.traffic_data) : null,
    revenue_data: s.revenue_data ? JSON.parse(s.revenue_data) : null,
    generated_content: s.generated_content ? JSON.parse(s.generated_content) : null,
  }));
  res.json({ case_studies: parsed });
});

// GET /api/pipeline/case-studies/:id
router.get('/case-studies/:id', authenticate, requirePipelineAccess, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const study = db.prepare('SELECT * FROM pipeline_case_studies WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.userId) as any;
  if (!study) { res.status(404).json({ error: 'Case study not found' }); return; }
  if (study.traffic_data) study.traffic_data = JSON.parse(study.traffic_data);
  if (study.revenue_data) study.revenue_data = JSON.parse(study.revenue_data);
  if (study.generated_content) study.generated_content = JSON.parse(study.generated_content);
  res.json({ case_study: study });
});

// POST /api/pipeline/case-studies
router.post('/case-studies', authenticate, requirePipelineAccess, (req: AuthenticatedRequest, res: Response): void => {
  const { client_name, client_url, old_site_url, traffic_data, revenue_data, screenshots } = req.body;
  if (!client_name || !client_name.trim()) {
    res.status(400).json({ error: 'Client name is required' }); return;
  }
  const db = getDb();
  const id = uuidv4();
  const td = traffic_data ? JSON.stringify(traffic_data) : null;
  const rd = revenue_data ? JSON.stringify(revenue_data) : null;
  const ss = screenshots ? JSON.stringify(screenshots) : null;
  db.prepare(
    'INSERT INTO pipeline_case_studies (id, user_id, client_name, client_url, old_site_url, screenshots, traffic_data, revenue_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, req.user!.userId, client_name.trim(), client_url || null, old_site_url || null, ss, td, rd);
  const study = db.prepare('SELECT * FROM pipeline_case_studies WHERE id = ?').get(id) as any;
  res.status(201).json({ case_study: study });
});

// PUT /api/pipeline/case-studies/:id
router.put('/case-studies/:id', authenticate, requirePipelineAccess, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM pipeline_case_studies WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.userId) as any;
  if (!existing) { res.status(404).json({ error: 'Case study not found' }); return; }

  const { client_name, client_url, old_site_url, traffic_data, revenue_data, generated_content, screenshots } = req.body;
  const td = traffic_data ? JSON.stringify(traffic_data) : existing.traffic_data;
  const rd = revenue_data ? JSON.stringify(revenue_data) : existing.revenue_data;
  const gc = generated_content ? JSON.stringify(generated_content) : existing.generated_content;
  const ss = screenshots ? JSON.stringify(screenshots) : existing.screenshots;

  db.prepare(
    'UPDATE pipeline_case_studies SET client_name = ?, client_url = ?, old_site_url = ?, traffic_data = ?, revenue_data = ?, generated_content = ?, screenshots = ? WHERE id = ? AND user_id = ?'
  ).run(client_name?.trim() || existing.client_name, client_url ?? existing.client_url, old_site_url ?? existing.old_site_url, td, rd, gc, ss, req.params.id, req.user!.userId);

  const study = db.prepare('SELECT * FROM pipeline_case_studies WHERE id = ?').get(req.params.id) as any;
  if (study.traffic_data) study.traffic_data = JSON.parse(study.traffic_data);
  if (study.revenue_data) study.revenue_data = JSON.parse(study.revenue_data);
  if (study.generated_content) study.generated_content = JSON.parse(study.generated_content);
  res.json({ case_study: study });
});

// POST /api/pipeline/case-studies/:id/generate
router.post('/case-studies/:id/generate', authenticate, requirePipelineAccess, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM pipeline_case_studies WHERE id = ? AND user_id = ?').get(req.params.id, req.user!.userId) as any;
  if (!existing) { res.status(404).json({ error: 'Case study not found' }); return; }

  // Parse stored data
  const td = existing.traffic_data ? JSON.parse(existing.traffic_data) : {};
  const rd = existing.revenue_data ? JSON.parse(existing.revenue_data) : {};

  // Run light audit on old site
  let audit;
  if (existing.old_site_url) {
    try {
      audit = await auditSite(existing.old_site_url);
    } catch { /* audit failure is non-fatal */ }
  }

  // Generate
  const input: CaseStudyInput = {
    client_name: existing.client_name,
    client_url: existing.client_url,
    old_site_url: existing.old_site_url,
    traffic_data: td,
    revenue_data: rd,
  };
  const generated = generateCaseStudy(input, audit);

  // Save
  const gc = JSON.stringify(generated);
  db.prepare('UPDATE pipeline_case_studies SET generated_content = ?, status = ? WHERE id = ?').run(gc, 'generated', req.params.id);

  res.json({ case_study: { ...existing, generated_content: generated, status: 'generated' } });
});

// --- Pitches stub ---
router.get('/pitches', authenticate, requirePipelineAccess, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const pitches = db.prepare('SELECT * FROM pipeline_pitches WHERE user_id = ? ORDER BY created_at DESC').all(req.user!.userId);
  res.json({ pitches });
});

export default router;
