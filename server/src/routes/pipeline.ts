import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { config } from '../config.js';
import { authenticate } from '../middleware/auth.js';
import { requirePipelineAccess } from '../middleware/trial.js';
import { AuthenticatedRequest } from '../types.js';

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

// --- Case Studies stub ---
router.get('/case-studies', authenticate, requirePipelineAccess, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const studies = db.prepare('SELECT * FROM pipeline_case_studies WHERE user_id = ? ORDER BY created_at DESC').all(req.user!.userId);
  res.json({ case_studies: studies });
});

// --- Pitches stub ---
router.get('/pitches', authenticate, requirePipelineAccess, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const pitches = db.prepare('SELECT * FROM pipeline_pitches WHERE user_id = ? ORDER BY created_at DESC').all(req.user!.userId);
  res.json({ pitches });
});

export default router;
