import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { config } from '../config.js';
import { RegisterSchema, LoginSchema } from '../schemas/auth.js';
import { AuthenticatedRequest, User } from '../types.js';
import { authenticate } from '../middleware/auth.js';
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from '../rateLimit.js';

const router = Router();

// POST /api/auth/register
router.post('/register', (req: AuthenticatedRequest, res: Response): void => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { email, password, invite_code } = parsed.data;
  const db = getDb();

  // Check if email already exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    res.status(409).json({ error: 'Email already registered', message: 'An account with this email already exists.' });
    return;
  }

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();
  let subscriptionTier = 'FREE';
  let trialStartedAt: string | null = now;
  let trialEndsAt: string | null = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Handle invite code redemption
  if (invite_code) {
    const invite = db.prepare(
      'SELECT * FROM invite_codes WHERE code = ? AND is_active = 1'
    ).get(invite_code) as any;

    if (!invite || invite.uses >= invite.max_uses) {
      res.status(400).json({ error: 'Invalid or expired invite code', message: 'The invite code is invalid, expired, or has already been used.' });
      return;
    }

    // Valid invite code — apply the tier and mark code as used
    subscriptionTier = invite.tier;
    trialStartedAt = null;
    trialEndsAt = null;

    // Increment usage
    db.prepare('UPDATE invite_codes SET uses = uses + 1 WHERE id = ?').run(invite.id);
  }

  db.prepare(
    'INSERT INTO users (id, email, password_hash, subscription_tier, trial_started_at, trial_ends_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, email, passwordHash, subscriptionTier, trialStartedAt, trialEndsAt);

  const token = jwt.sign(
    { userId: id, email, subscriptionTier: subscriptionTier },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.status(201).json({
    id,
    email,
    subscription_tier: subscriptionTier,
    trial_started_at: trialStartedAt,
    trial_ends_at: trialEndsAt,
  });
});

// POST /api/auth/login
router.post('/login', (req: AuthenticatedRequest, res: Response): void => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { email, password } = parsed.data;
  const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

  // Rate limit check
  const blocked = checkRateLimit(ip, email);
  if (blocked) {
    res.status(429).json({
      error: 'Too many login attempts',
      message: `Too many login attempts. Try again in ${blocked}.`,
    });
    return;
  }

  const db = getDb();

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
  if (!user) {
    recordFailedAttempt(ip, email);
    res.status(401).json({ error: 'Invalid credentials', message: 'Email or password is incorrect.' });
    return;
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    recordFailedAttempt(ip, email);
    res.status(401).json({ error: 'Invalid credentials', message: 'Email or password is incorrect.' });
    return;
  }

  // Successful login — clear rate limit counters
  clearRateLimit(ip, email);

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
  });
});

// POST /api/auth/logout
router.post('/logout', (_req: AuthenticatedRequest, res: Response): void => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
  });
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const user = db.prepare('SELECT id, email, subscription_tier, created_at FROM users WHERE id = ?').get(req.user!.userId) as Omit<User, 'password_hash' | 'updated_at'> | undefined;

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user: { id: user.id, email: user.email, subscription_tier: user.subscription_tier, created_at: user.created_at } });
});

export default router;