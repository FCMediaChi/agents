import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDb } from '../db.js';
import { config } from '../config.js';
import {
  RegisterSchema,
  LoginSchema,
  VerifySchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '../schemas/auth.js';
import { AuthenticatedRequest, User } from '../types.js';
import { authenticate } from '../middleware/auth.js';
import { checkRateLimit, recordFailedAttempt, clearRateLimit } from '../rateLimit.js';
import { sendAuthEmail } from '../emailService.js';

const router = Router();

// --- In-memory rate limiters for resend-verification & forgot-password ---
const resendCooldowns = new Map<string, number>(); // email -> last sent timestamp
const forgotPasswordAttempts = new Map<string, { count: number; windowStart: number }>();

function checkResendCooldown(email: string): boolean {
  const last = resendCooldowns.get(email);
  if (last && Date.now() - last < 2 * 60 * 1000) {
    return false; // still in cooldown
  }
  resendCooldowns.set(email, Date.now());
  return true;
}

function checkForgotPasswordRate(email: string): boolean {
  const now = Date.now();
  const entry = forgotPasswordAttempts.get(email);
  // Reset window if expired
  if (entry && now - entry.windowStart > 60 * 60 * 1000) {
    forgotPasswordAttempts.delete(email);
  }
  const current = forgotPasswordAttempts.get(email);
  if (!current) {
    forgotPasswordAttempts.set(email, { count: 1, windowStart: now });
    return true;
  }
  if (current.count >= 3) return false;
  current.count++;
  return true;
}

// ============================================================================
// POST /api/auth/register
// ============================================================================
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

  const id = crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);
  const verificationToken = crypto.randomUUID();
  const now = new Date().toISOString();
  const trialEnds = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    'INSERT INTO users (id, email, password_hash, subscription_tier, verified, verification_token, trial_started_at, trial_ends_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, email, passwordHash, 'FREE', 0, verificationToken, now, trialEnds);

  // Send verification email (fire-and-forget)
  const verifyLink = `https://nuriaai.ctonew.app/verify?token=${verificationToken}`;
  sendAuthEmail(
    email,
    'Verify your Nuria AI account',
    `Welcome to Nuria AI!\n\nPlease verify your email address by clicking the link below:\n\n${verifyLink}\n\nThis link is unique to your account. If you did not create this account, you can safely ignore this email.\n\n— The Nuria AI Team`
  );

  // Don't set JWT cookie — user must verify first
  res.status(201).json({
    id,
    email,
    subscription_tier: 'FREE',
    verified: false,
    trial_started_at: now,
    trial_ends_at: trialEnds,
    message: 'Account created. Please check your email to verify your account.',
  });
});

// ============================================================================
// POST /api/auth/verify
// ============================================================================
router.post('/verify', (req: AuthenticatedRequest, res: Response): void => {
  const parsed = VerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid token', message: 'Verification token is required.' });
    return;
  }

  const { token } = parsed.data;
  const db = getDb();

  const user = db.prepare('SELECT id, email FROM users WHERE verification_token = ? AND verified = 0').get(token) as Pick<User, 'id' | 'email'> | undefined;
  if (!user) {
    res.status(400).json({ error: 'Invalid or expired link', message: 'This verification link is invalid or has already been used.' });
    return;
  }

  db.prepare('UPDATE users SET verified = 1, verification_token = NULL WHERE id = ?').run(user.id);

  res.json({ success: true, message: 'Email verified! You can now log in.' });
});

// ============================================================================
// POST /api/auth/resend-verification
// ============================================================================
router.post('/resend-verification', (req: AuthenticatedRequest, res: Response): void => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'Email is required' });
    return;
  }

  if (!checkResendCooldown(email)) {
    res.status(429).json({ error: 'Too many requests', message: 'Please wait 2 minutes before requesting another verification email.' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT id, verified, verification_token FROM users WHERE email = ?').get(email) as Pick<User, 'id' | 'verified' | 'verification_token'> | undefined;

  if (!user) {
    // Don't reveal whether email exists
    res.json({ success: true, message: 'If an account exists with that email, a verification link has been sent.' });
    return;
  }

  if (user.verified) {
    res.json({ success: true, message: 'Your account is already verified. You can log in.' });
    return;
  }

  // Generate new token if needed
  const newToken = crypto.randomUUID();
  db.prepare('UPDATE users SET verification_token = ? WHERE id = ?').run(newToken, user.id);

  const verifyLink = `https://nuriaai.ctonew.app/verify?token=${newToken}`;
  sendAuthEmail(
    email,
    'Verify your Nuria AI account',
    `Welcome to Nuria AI!\n\nPlease verify your email address by clicking the link below:\n\n${verifyLink}\n\nThis link is unique to your account. If you did not create this account, you can safely ignore this email.\n\n— The Nuria AI Team`
  );

  res.json({ success: true, message: 'Verification email sent. Check your inbox.' });
});

// ============================================================================
// POST /api/auth/login
// ============================================================================
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

  // Check email verification
  if (!user.verified) {
    clearRateLimit(ip, email); // don't count verified-but-correct credentials as attacks
    res.status(403).json({
      error: 'Email not verified',
      message: 'Please verify your email. Check your inbox.',
      email: user.email,
    });
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

// ============================================================================
// POST /api/auth/forgot-password
// ============================================================================
router.post('/forgot-password', (req: AuthenticatedRequest, res: Response): void => {
  const parsed = ForgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid email', message: 'A valid email address is required.' });
    return;
  }

  const { email } = parsed.data;

  if (!checkForgotPasswordRate(email)) {
    res.status(429).json({ error: 'Too many requests', message: 'Too many password reset requests. Please try again later.' });
    return;
  }

  const db = getDb();
  const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email) as Pick<User, 'id' | 'email'> | undefined;

  if (!user) {
    // Don't reveal whether email exists
    res.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' });
    return;
  }

  const resetToken = crypto.randomUUID();
  const expiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

  db.prepare('UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?').run(resetToken, expiry, user.id);

  const resetLink = `https://nuriaai.ctonew.app/reset-password?token=${resetToken}`;
  sendAuthEmail(
    email,
    'Reset your Nuria AI password',
    `Click here to reset your password:\n\n${resetLink}\n\nThis link expires in 1 hour.\n\nIf you did not request a password reset, you can safely ignore this email.\n\n— The Nuria AI Team`
  );

  res.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' });
});

// ============================================================================
// POST /api/auth/reset-password
// ============================================================================
router.post('/reset-password', (req: AuthenticatedRequest, res: Response): void => {
  const parsed = ResetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }

  const { token, newPassword } = parsed.data;
  const db = getDb();

  const user = db.prepare(
    'SELECT id, reset_token_expiry FROM users WHERE reset_token = ?'
  ).get(token) as Pick<User, 'id' | 'reset_token_expiry'> | undefined;

  if (!user) {
    res.status(400).json({ error: 'Invalid or expired link', message: 'This password reset link is invalid.' });
    return;
  }

  // Check expiry
  if (user.reset_token_expiry && new Date(user.reset_token_expiry) < new Date()) {
    db.prepare('UPDATE users SET reset_token = NULL, reset_token_expiry = NULL WHERE id = ?').run(user.id);
    res.status(400).json({ error: 'Expired link', message: 'This password reset link has expired. Please request a new one.' });
    return;
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?').run(passwordHash, user.id);

  res.json({ success: true, message: 'Password reset! You can now log in with your new password.' });
});

// ============================================================================
// POST /api/auth/logout
// ============================================================================
router.post('/logout', (_req: AuthenticatedRequest, res: Response): void => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict',
  });
  res.json({ success: true });
});

// ============================================================================
// GET /api/auth/me
// ============================================================================
router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const user = db.prepare('SELECT id, email, subscription_tier, created_at FROM users WHERE id = ?').get(req.user!.userId) as Omit<User, 'password_hash' | 'updated_at' | 'verified' | 'verification_token' | 'reset_token' | 'reset_token_expiry' | 'trial_started_at' | 'trial_ends_at'> | undefined;

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user: { id: user.id, email: user.email, subscription_tier: user.subscription_tier, created_at: user.created_at } });
});

export default router;
