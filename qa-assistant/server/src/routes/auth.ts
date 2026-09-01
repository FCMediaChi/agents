import { Router, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { config, isProd } from '../config.js';
import { RegisterSchema, LoginSchema, RequestPasswordResetSchema, ResetPasswordSchema } from '../schemas/auth.js';
import type { AuthenticatedRequest, User } from '../types.js';
import { authenticate } from '../middleware/auth.js';
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from '../rateLimit.js';

const router = Router();

function setAuthCookie(res: Response, token: string): void {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function clearAuthCookie(res: Response): void {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
  });
}

function publicUser(user: Pick<User, 'id' | 'email' | 'created_at'>) {
  return { id: user.id, email: user.email, created_at: user.created_at };
}

// POST /api/auth/register
router.post('/register', (req: AuthenticatedRequest, res: Response): void => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
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
  db.prepare(
    'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)'
  ).run(id, email, passwordHash);

  const token = jwt.sign({ userId: id, email }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  setAuthCookie(res, token);

  res.status(201).json(publicUser({ id, email, created_at: new Date().toISOString() }));
});

// POST /api/auth/login
router.post('/login', (req: AuthenticatedRequest, res: Response): void => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { email, password } = parsed.data;
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';

  const blocked = checkRateLimit(ip, email);
  if (blocked) {
    res.status(429).json({ error: 'Too many login attempts', message: `Too many login attempts. Try again in ${blocked}.` });
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

  clearRateLimit(ip, email);
  const token = jwt.sign({ userId: user.id, email: user.email }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  setAuthCookie(res, token);
  res.json(publicUser(user));
});

// POST /api/auth/logout
router.post('/logout', (_req: AuthenticatedRequest, res: Response): void => {
  clearAuthCookie(res);
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const user = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(req.user!.userId) as Pick<User, 'id' | 'email' | 'created_at'> | undefined;
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ user: publicUser(user) });
});

// POST /api/auth/request-password-reset
// Generates a reset token. Email delivery is deferred (no mail provider wired in
// Phase 1), so in development the raw token is returned for end-to-end testing.
router.post('/request-password-reset', (req: AuthenticatedRequest, res: Response): void => {
  const parsed = RequestPasswordResetSchema.safeParse(req.body);
  if (!parsed.success) {
    // Return the same generic response as a valid request to avoid revealing
    // whether an email is registered.
    res.status(202).json({ success: true });
    return;
  }

  const { email } = parsed.data;
  const db = getDb();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;

  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + config.passwordResetTtlMs).toISOString();
    db.prepare(
      'UPDATE users SET password_reset_token = ?, password_reset_expires_at = ?, updated_at = ? WHERE id = ?'
    ).run(tokenHash, expiresAt, new Date().toISOString(), user.id);

    // TODO(Phase integration): send rawToken via email. Until then, only expose
    // it in non-production environments so the flow remains testable.
    if (!isProd) {
      res.status(202).json({
        success: true,
        message: 'If an account exists for that email, a reset link has been generated.',
        debug_reset_token: rawToken,
      });
      return;
    }
    console.log(`[QA Assistant] Password reset token generated for user ${user.id}`);
  }

  res.status(202).json({ success: true, message: 'If an account exists for that email, a reset link has been sent.' });
});

// POST /api/auth/reset-password
router.post('/reset-password', (req: AuthenticatedRequest, res: Response): void => {
  const parsed = ResetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { token, password } = parsed.data;
  const db = getDb();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const user = db.prepare(
    'SELECT id, password_reset_expires_at FROM users WHERE password_reset_token = ?'
  ).get(tokenHash) as { id: string; password_reset_expires_at: string | null } | undefined;

  if (!user) {
    res.status(400).json({ error: 'Invalid or expired reset token', message: 'This reset link is invalid or has expired. Please request a new one.' });
    return;
  }

  if (user.password_reset_expires_at && new Date(user.password_reset_expires_at).getTime() < Date.now()) {
    res.status(400).json({ error: 'Invalid or expired reset token', message: 'This reset link has expired. Please request a new one.' });
    return;
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare(
    'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires_at = NULL, updated_at = ? WHERE id = ?'
  ).run(passwordHash, new Date().toISOString(), user.id);

  res.json({ success: true });
});

export default router;
