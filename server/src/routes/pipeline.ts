import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { config } from '../config.js';
import { authenticate } from '../middleware/auth.js';
import { requirePipelineAccess } from '../middleware/trial.js';
import { AuthenticatedRequest } from '../types.js';
import { RegisterSchema, LoginSchema } from '../schemas/auth.js';

const router = Router();

// --- Pipeline-specific Auth (starts trial automatically) ---

// POST /api/pipeline/register
router.post('/register', (req: AuthenticatedRequest, res: Response): void => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;
  const db = getDb();

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'Email already registered', message: 'An account with this email already exists.' });
    return;
  }

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);
  const now = new Date();
  const trialEnds = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    'INSERT INTO users (id, email, password_hash, subscription_tier, trial_started_at, trial_ends_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, email, passwordHash, 'FREE', now.toISOString(), trialEnds);

  const token = jwt.sign(
    { userId: id, email, subscriptionTier: 'FREE' },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.status(201).json({
    id,
    email,
    subscription_tier: 'FREE',
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEnds,
  });
});

// POST /api/pipeline/login
router.post('/login', (req: AuthenticatedRequest, res: Response): void => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;
  const db = getDb();

  const user = db.prepare(
    'SELECT id, email, password_hash, subscription_tier, trial_started_at, trial_ends_at FROM users WHERE email = ?'
  ).get(email) as any;

  if (!user) {
    res.status(401).json({ error: 'Invalid credentials', message: 'Email or password is incorrect.' });
    return;
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    res.status(401).json({ error: 'Invalid credentials', message: 'Email or password is incorrect.' });
    return;
  }

  // Start trial if user hasn't started one yet
  let trialStartedAt = user.trial_started_at;
  let trialEndsAt = user.trial_ends_at;
  if (!trialStartedAt && user.subscription_tier === 'FREE') {
    const now = new Date();
    trialStartedAt = now.toISOString();
    trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      'UPDATE users SET trial_started_at = ?, trial_ends_at = ? WHERE id = ?'
    ).run(trialStartedAt, trialEndsAt, user.id);
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email, subscriptionTier: user.subscription_tier },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    id: user.id,
    email: user.email,
    subscription_tier: user.subscription_tier,
    trial_started_at: trialStartedAt,
    trial_ends_at: trialEndsAt,
  });
});

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

  // Check if trial is active
  const now = new Date();
  const trialActive = user.trial_ends_at && new Date(user.trial_ends_at) > now;

  res.json({
    user: {
      id: user.id,
      email: user.email,
      subscription_tier: user.subscription_tier,
      trial_started_at: user.trial_started_at,
      trial_ends_at: user.trial_ends_at,
      trial_active: trialActive,
      created_at: user.created_at,
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

// POST /api/pipeline/agency
router.post('/agency', authenticate, requirePipelineAccess, (req: AuthenticatedRequest, res: Response): void => {
  const { agency_name, website, niche, team_size } = req.body;
  if (!agency_name || !agency_name.trim()) {
    res.status(400).json({ error: 'Agency name is required' });
    return;
  }

  const db = getDb();

  // Check if agency already exists
  const existing = db.prepare('SELECT id FROM pipeline_agencies WHERE user_id = ?').get(req.user!.userId);
  if (existing) {
    res.status(409).json({ error: 'Agency already exists', message: 'You have already set up your agency profile.' });
    return;
  }

  const id = uuidv4();
  db.prepare(
    'INSERT INTO pipeline_agencies (id, user_id, agency_name, website, niche, team_size) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, req.user!.userId, agency_name.trim(), website || null, niche || null, team_size || null);

  const agency = db.prepare('SELECT * FROM pipeline_agencies WHERE id = ?').get(id);
  res.status(201).json({ agency });
});

// PUT /api/pipeline/agency
router.put('/agency', authenticate, requirePipelineAccess, (req: AuthenticatedRequest, res: Response): void => {
  const { agency_name, website, niche, team_size } = req.body;
  const db = getDb();

  const existing = db.prepare('SELECT id FROM pipeline_agencies WHERE user_id = ?').get(req.user!.userId);
  if (!existing) {
    res.status(404).json({ error: 'Agency not found' });
    return;
  }

  db.prepare(
    'UPDATE pipeline_agencies SET agency_name = ?, website = ?, niche = ?, team_size = ?, updated_at = datetime(\'now\') WHERE user_id = ?'
  ).run(agency_name?.trim() || null, website || null, niche || null, team_size || null, req.user!.userId);

  const agency = db.prepare('SELECT * FROM pipeline_agencies WHERE user_id = ?').get(req.user!.userId);
  res.json({ agency });
});

// --- Dashboard stats ---

// GET /api/pipeline/dashboard
router.get('/dashboard', authenticate, requirePipelineAccess, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const userId = req.user!.userId;

  const agency = db.prepare('SELECT * FROM pipeline_agencies WHERE user_id = ?').get(userId);
  const caseStudyCount = db.prepare(
    'SELECT COUNT(*) as count FROM pipeline_case_studies WHERE user_id = ?'
  ).get(userId) as any;
  const pitchCount = db.prepare(
    'SELECT COUNT(*) as count FROM pipeline_pitches WHERE user_id = ?'
  ).get(userId) as any;

  const recentCaseStudies = db.prepare(
    'SELECT * FROM pipeline_case_studies WHERE user_id = ? ORDER BY created_at DESC LIMIT 5'
  ).all(userId);

  const recentPitches = db.prepare(
    'SELECT * FROM pipeline_pitches WHERE user_id = ? ORDER BY created_at DESC LIMIT 5'
  ).all(userId);

  res.json({
    agency: agency || null,
    stats: {
      case_studies: caseStudyCount?.count || 0,
      pitches: pitchCount?.count || 0,
    },
    recent_case_studies: recentCaseStudies,
    recent_pitches: recentPitches,
  });
});

// --- Case Studies (stubs for future implementation) ---

// GET /api/pipeline/case-studies
router.get('/case-studies', authenticate, requirePipelineAccess, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const studies = db.prepare(
    'SELECT * FROM pipeline_case_studies WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user!.userId);
  res.json({ case_studies: studies });
});

// --- Pitches (stubs for future implementation) ---

// GET /api/pipeline/pitches
router.get('/pitches', authenticate, requirePipelineAccess, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const pitches = db.prepare(
    'SELECT * FROM pipeline_pitches WHERE user_id = ? ORDER BY created_at DESC'
  ).all(req.user!.userId);
  res.json({ pitches });
});

export default router;
