import { Router, type NextFunction, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDb } from '../db.js';
import { config, isProd } from '../config.js';
import {
  RegisterSchema,
  LoginSchema,
  VerifyEmailSchema,
  ResendVerificationSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
} from '../schemas/auth.js';
import type { AuthenticatedRequest, PublicUser, User } from '../types.js';
import { authenticate } from '../middleware/auth.js';
import { checkRateLimit, recordFailedAttempt, clearRateLimit, clientIp } from '../rateLimit.js';
import {
  buildAppLink,
  sendVerificationEmail,
  sendPasswordResetEmail,
  type EmailResult,
} from '../emailService.js';

const router = Router();

/**
 * Express 4 does not await async handlers, so an awaited mail send must have its
 * rejection forwarded to the error middleware rather than becoming an unhandled
 * promise rejection.
 */
function asyncRoute(fn: (req: AuthenticatedRequest, res: Response) => Promise<void>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };
}

const RESEND_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes between verification emails
const FORGOT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const FORGOT_MAX_PER_WINDOW = 3;

// In-memory guards (same approach as the monolith/audit-app).
const resendCooldowns = new Map<string, number>(); // email -> last sent timestamp
const forgotPasswordAttempts = new Map<string, { count: number; windowStart: number }>();

function pruneMaps(): void {
  const now = Date.now();
  if (resendCooldowns.size > 1000) {
    for (const [email, last] of resendCooldowns) {
      if (now - last > RESEND_COOLDOWN_MS) resendCooldowns.delete(email);
    }
  }
  if (forgotPasswordAttempts.size > 1000) {
    for (const [email, entry] of forgotPasswordAttempts) {
      if (now - entry.windowStart > FORGOT_WINDOW_MS) forgotPasswordAttempts.delete(email);
    }
  }
}

function checkResendCooldown(email: string): boolean {
  pruneMaps();
  const last = resendCooldowns.get(email);
  if (last && Date.now() - last < RESEND_COOLDOWN_MS) {
    return false; // still in cooldown
  }
  resendCooldowns.set(email, Date.now());
  return true;
}

function checkForgotPasswordRate(email: string): boolean {
  pruneMaps();
  const now = Date.now();
  const entry = forgotPasswordAttempts.get(email);
  if (entry && now - entry.windowStart > FORGOT_WINDOW_MS) {
    forgotPasswordAttempts.delete(email);
  }
  const current = forgotPasswordAttempts.get(email);
  if (!current) {
    forgotPasswordAttempts.set(email, { count: 1, windowStart: now });
    return true;
  }
  if (current.count >= FORGOT_MAX_PER_WINDOW) return false;
  current.count++;
  return true;
}

function requestOrigin(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0].trim() || req.protocol;
  const host = req.headers['x-forwarded-host'] as string | undefined || req.get('host');
  return host ? `${proto}://${host}` : '';
}

function setAuthCookie(res: Response, token: string): void {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
  });
}

function clearAuthCookie(res: Response): void {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
  });
}

function publicUser(user: Pick<User, 'id' | 'email' | 'subscription_tier' | 'verified' | 'created_at'>): PublicUser {
  return {
    id: user.id,
    email: user.email,
    subscription_tier: user.subscription_tier,
    verified: Boolean(user.verified),
    created_at: user.created_at,
  };
}

/** sha256 hex — reset tokens are stored hashed, never in plaintext. */
function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function emailMeta(result: EmailResult) {
  return { delivered: result.delivered, transport: result.transport };
}

// ============================================================================
// POST /api/auth/register
// Creates the account (unverified) and sends the verification email.
// No session cookie is set — the account must be verified first.
// ============================================================================
router.post('/register', asyncRoute(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

  const id = crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);
  const verificationToken = crypto.randomUUID();

  db.prepare(
    `INSERT INTO users (id, email, password_hash, subscription_tier, verified, verification_token)
     VALUES (?, ?, ?, 'FREE', 0, ?)`
  ).run(id, email, passwordHash, verificationToken);

  const verifyLink = buildAppLink(`/verify?token=${encodeURIComponent(verificationToken)}`, requestOrigin(req));
  const emailResult = await sendVerificationEmail(email, verifyLink);

  res.status(201).json({
    id,
    email,
    subscription_tier: 'FREE',
    verified: false,
    message: 'Account created. Please check your email to verify your account.',
    email_delivery: emailMeta(emailResult),
    // In development (no production release) the token is returned so the flow
    // is testable end-to-end without an inbox. Never exposed in production.
    ...(isProd
      ? {}
      : { dev_verification_token: verificationToken, dev_verify_url: `/verify?token=${verificationToken}` }),
  });
}));

// ============================================================================
// POST /api/auth/verify   (GET also accepted, for links clicked in the inbox)
// ============================================================================
async function handleVerify(req: AuthenticatedRequest, res: Response): Promise<void> {
  const raw = {
    token:
      (req.body && typeof req.body.token === 'string' && req.body.token) ||
      (typeof req.query.token === 'string' && req.query.token) ||
      '',
  };

  const parsed = VerifyEmailSchema.safeParse(raw);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid token', message: 'Verification token is required.' });
    return;
  }

  const db = getDb();
  const user = db
    .prepare('SELECT id, email, verified FROM users WHERE verification_token = ?')
    .get(parsed.data.token) as Pick<User, 'id' | 'email' | 'verified'> | undefined;

  if (!user) {
    res.status(400).json({
      error: 'Invalid or expired link',
      message: 'This verification link is invalid or has already been used.',
    });
    return;
  }

  if (user.verified) {
    res.json({ success: true, verified: true, message: 'Your email is already verified. You can log in.' });
    return;
  }

  db.prepare("UPDATE users SET verified = 1, verification_token = NULL, updated_at = datetime('now') WHERE id = ?").run(user.id);

  res.json({ success: true, verified: true, message: 'Email verified! You can now log in.' });
}

router.post('/verify', asyncRoute(handleVerify));
router.get('/verify', asyncRoute(handleVerify));

// ============================================================================
// POST /api/auth/resend-verification
// ============================================================================
router.post('/resend-verification', asyncRoute(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parsed = ResendVerificationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid email', message: 'A valid email address is required.' });
    return;
  }

  const { email } = parsed.data;

  if (!checkResendCooldown(email)) {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Please wait 2 minutes before requesting another verification email.',
    });
    return;
  }

  const db = getDb();
  const user = db
    .prepare('SELECT id, verified, verification_token FROM users WHERE email = ?')
    .get(email) as Pick<User, 'id' | 'verified' | 'verification_token'> | undefined;

  if (!user) {
    // Do not reveal whether the address is registered.
    res.json({ success: true, message: 'If an account exists with that email, a verification link has been sent.' });
    return;
  }

  if (user.verified) {
    res.json({ success: true, message: 'Your account is already verified. You can log in.' });
    return;
  }

  const token = user.verification_token || crypto.randomUUID();
  if (!user.verification_token) {
    db.prepare("UPDATE users SET verification_token = ?, updated_at = datetime('now') WHERE id = ?").run(token, user.id);
  }

  const verifyLink = buildAppLink(`/verify?token=${encodeURIComponent(token)}`, requestOrigin(req));
  const emailResult = await sendVerificationEmail(email, verifyLink);

  res.json({
    success: true,
    message: 'Verification email sent. Check your inbox.',
    email_delivery: emailMeta(emailResult),
    ...(isProd ? {} : { dev_verification_token: token, dev_verify_url: `/verify?token=${token}` }),
  });
}));

// ============================================================================
// POST /api/auth/login
// ============================================================================
router.post('/login', (req: AuthenticatedRequest, res: Response): void => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { email, password } = parsed.data;
  const ip = clientIp(req);

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

  if (config.requireEmailVerification && !user.verified) {
    // Correct credentials — don't count this as an attack.
    clearRateLimit(ip, email);
    res.status(403).json({
      error: 'Email not verified',
      message: 'Please verify your email address before logging in. Check your inbox.',
      email: user.email,
      verification_required: true,
    });
    return;
  }

  clearRateLimit(ip, email);

  const token = jwt.sign(
    { userId: user.id, email: user.email, subscriptionTier: user.subscription_tier },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn },
  );
  setAuthCookie(res, token);

  res.json({
    id: user.id,
    email: user.email,
    subscription_tier: user.subscription_tier,
    verified: Boolean(user.verified),
    created_at: user.created_at,
  });
});

// ============================================================================
// POST /api/auth/logout
// ============================================================================
router.post('/logout', (_req: AuthenticatedRequest, res: Response): void => {
  clearAuthCookie(res);
  res.json({ success: true });
});

// ============================================================================
// GET /api/auth/me
// ============================================================================
router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const user = db
    .prepare('SELECT id, email, subscription_tier, verified, created_at FROM users WHERE id = ?')
    .get(req.user!.userId) as Pick<User, 'id' | 'email' | 'subscription_tier' | 'verified' | 'created_at'> | undefined;

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user: publicUser(user) });
});

// ============================================================================
// POST /api/auth/forgot-password
// Generates a reset token (stored hashed, 1 hour) and emails the reset link.
// ============================================================================
router.post('/forgot-password', asyncRoute(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    // Same generic response as a successful request — never reveal account existence.
    res.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' });
    return;
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + config.passwordResetTtlMs).toISOString();

  db.prepare("UPDATE users SET reset_token = ?, reset_token_expiry = ?, updated_at = datetime('now') WHERE id = ?").run(
    hashToken(rawToken),
    expiry,
    user.id,
  );

  const resetLink = buildAppLink(`/reset-password?token=${encodeURIComponent(rawToken)}`, requestOrigin(req));
  const emailResult = await sendPasswordResetEmail(email, resetLink, Math.round(config.passwordResetTtlMs / 60000));

  res.json({
    success: true,
    message: 'If an account exists with that email, a reset link has been sent.',
    email_delivery: emailMeta(emailResult),
    ...(isProd
      ? {}
      : { dev_reset_token: rawToken, dev_reset_url: `/reset-password?token=${rawToken}` }),
  });
}));

// ============================================================================
// POST /api/auth/reset-password
// ============================================================================
router.post('/reset-password', (req: AuthenticatedRequest, res: Response): void => {
  const parsed = ResetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const { token } = parsed.data;
  const newPassword = (parsed.data.newPassword || parsed.data.password) as string;
  const db = getDb();

  const user = db
    .prepare('SELECT id, reset_token_expiry FROM users WHERE reset_token = ?')
    .get(hashToken(token)) as Pick<User, 'id' | 'reset_token_expiry'> | undefined;

  if (!user) {
    res.status(400).json({
      error: 'Invalid or expired link',
      message: 'This password reset link is invalid or has already been used.',
    });
    return;
  }

  if (user.reset_token_expiry && new Date(user.reset_token_expiry).getTime() < Date.now()) {
    db.prepare("UPDATE users SET reset_token = NULL, reset_token_expiry = NULL, updated_at = datetime('now') WHERE id = ?").run(user.id);
    res.status(400).json({ error: 'Expired link', message: 'This password reset link has expired. Please request a new one.' });
    return;
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  db.prepare(
    "UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL, updated_at = datetime('now') WHERE id = ?"
  ).run(passwordHash, user.id);

  res.json({ success: true, message: 'Password reset! You can now log in with your new password.' });
});

export default router;
