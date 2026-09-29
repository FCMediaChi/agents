import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types.js';
import { getDb } from '../db.js';

// ── Audit protections ──────────────────────────────────────────
// Self-contained copy of the monolith's audit abuse-protection middleware,
// retargeted to audit-app's own db.ts and JWT payload (userId).

// IP-based rate limit: 3 audits per IP per 24h (free tier / anonymous).
// Premium users skip this limit.
const ipAuditMap = new Map<string, { count: number; resetAt: number }>();

function isPremiumUser(userId: string | undefined): boolean {
  if (!userId) return false;
  const db = getDb();
  const rec = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(userId) as
    | { subscription_tier: string }
    | undefined;
  return !!rec && rec.subscription_tier !== 'FREE';
}

export function auditIPRateLimit(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (isPremiumUser(req.user?.userId)) {
    next();
    return;
  }

  const ip = req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
  const now = Date.now();
  const entry = ipAuditMap.get(ip);

  if (entry && now < entry.resetAt) {
    if (entry.count >= 3) {
      res.status(429).json({ error: 'Free tier limited to 3 audits per 24 hours. Sign in or upgrade for more.' });
      return;
    }
    entry.count++;
  } else {
    ipAuditMap.set(ip, { count: 1, resetAt: now + 86400000 });
  }
  next();
}

// Single audit queue per user (max 1 running at a time)
export function singleAuditQueue(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const db = getDb();
  const userId = req.user?.userId;
  if (!userId) {
    next();
    return;
  }
  const running = db.prepare('SELECT id FROM audit_reports WHERE user_id = ? AND status = ?').get(userId, 'running');
  if (running) {
    res.status(429).json({ error: 'An audit is already running. Please wait for it to complete.' });
    return;
  }
  next();
}

// Audit cooldown: 30s between submissions
const auditCooldownMap = new Map<string, number>();
export function auditCooldown(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const key = req.user?.userId || req.ip || 'unknown';
  const last = auditCooldownMap.get(key) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < 30000) {
    res.status(429).json({
      error: `Please wait ${Math.ceil((30000 - elapsed) / 1000)} seconds before starting another audit.`,
    });
    return;
  }
  auditCooldownMap.set(key, Date.now());
  next();
}

// URL blacklist: block localhost, private IPs, and the app's own domain
const BLOCKED_PATTERNS = [
  /^https?:\/\/localhost/i,
  /^https?:\/\/127\.0\.0\.\d+/,
  /^https?:\/\/10\.\d+\.\d+\.\d+/,
  /^https?:\/\/192\.168\.\d+\.\d+/,
  /^https?:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/,
  /^https?:\/\/0\.0\.0\.0/,
  /firstcreationmedia\.com/i,
  /\.local$/i,
  /\.internal$/i,
];

export function auditURLBlacklist(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const url = req.body?.url || '';
  if (!url) {
    next();
    return;
  }
  const normalized = url.startsWith('http') ? url : `https://${url}`;
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) {
      res.status(400).json({ error: 'This URL cannot be audited. Please enter a public website URL.' });
      return;
    }
  }
  next();
}
