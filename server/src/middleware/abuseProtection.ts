import { Response, NextFunction } from 'express';

import { getDb } from '../db.js';
// ── Audit protections ──────────────────────────────────────────

// IP-based rate limit: 3 audits per IP per 24h (free tier)
const ipAuditMap = new Map<string, { count: number; resetAt: number }>();

export function auditIPRateLimit(req: any, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  if (user && (user.subscriptionTier !== 'FREE' || user.subscription_tier === undefined)) { next(); return; }

  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  const entry = ipAuditMap.get(ip);

  if (entry && now < entry.resetAt) {
    if (entry.count >= 3) {
      res.status(429).json({ error: 'Free tier limited to 3 audits per 24 hours. Sign in or upgrade for more.' }); return;
    }
    entry.count++;
  } else {
    ipAuditMap.set(ip, { count: 1, resetAt: now + 86400000 });
  }
  next();
}

// Single audit queue per user (max 1 running)
export function singleAuditQueue(req: any, res: Response, next: NextFunction): void {
  
  const db = getDb();
  const userId = req.user?.userId;
  if (!userId) { next(); return; }
  const running = db.prepare('SELECT id FROM audit_reports WHERE user_id = ? AND status = ?').get(userId, 'running');
  if (running) { res.status(429).json({ error: 'An audit is already running. Please wait for it to complete.' }); return; }
  next();
}

// Audit cooldown: 30s between submissions
const auditCooldownMap = new Map<string, number>();
export function auditCooldown(req: any, res: Response, next: NextFunction): void {
  const user = (req as any).user;
  const key = user?.userId || req.ip || 'unknown';
  const last = auditCooldownMap.get(key) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < 30000) {
    res.status(429).json({ error: `Please wait ${Math.ceil((30000 - elapsed) / 1000)} seconds before starting another audit.` }); return;
  }
  auditCooldownMap.set(key, Date.now());
  next();
}

// URL blacklist: block localhost, private IPs, app's own domain
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

export function auditURLBlacklist(req: any, res: Response, next: NextFunction): void {
  const url = req.body?.url || '';
  if (!url) { next(); return; }
  const normalized = url.startsWith('http') ? url : `https://${url}`;
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalized)) {
      res.status(400).json({ error: 'This URL cannot be audited. Please enter a public website URL.' }); return;
    }
  }
  next();
}

// ── Blueprint protections ──────────────────────────────────────

// Export rate limit: 10 exports per hour
const exportCountMap = new Map<string, { count: number; resetAt: number }>();
export function exportRateLimit(req: any, res: Response, next: NextFunction): void {
  const userId = req.user?.userId;
  if (!userId) { next(); return; }
  const now = Date.now();
  const entry = exportCountMap.get(userId);
  if (entry && now < entry.resetAt) {
    if (entry.count >= 10) {
      res.status(429).json({ error: 'Export limit reached — 10 exports per hour. Try again later.' }); return;
    }
    entry.count++;
  } else {
    exportCountMap.set(userId, { count: 1, resetAt: now + 3600000 });
  }
  next();
}

// Export cooldown: 5s between exports
const exportCooldownMap = new Map<string, number>();
export function exportCooldown(req: any, res: Response, next: NextFunction): void {
  const userId = req.user?.userId;
  if (!userId) { next(); return; }
  const last = exportCooldownMap.get(userId) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < 5000) {
    res.status(429).json({ error: `Please wait ${Math.ceil((5000 - elapsed) / 1000)}s before another export.` }); return;
  }
  exportCooldownMap.set(userId, Date.now());
  next();
}

// Project creation cooldown: 3s between creates
const projectCooldownMap = new Map<string, number>();
export function projectCreateCooldown(req: any, res: Response, next: NextFunction): void {
  const userId = req.user?.userId;
  if (!userId) { next(); return; }
  const last = projectCooldownMap.get(userId) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < 3000) {
    res.status(429).json({ error: 'Please wait before creating another project.' }); return;
  }
  projectCooldownMap.set(userId, Date.now());
  next();
}

// Max sitemap pages: 50 cap
export function maxPageLimit(req: any, res: Response, next: NextFunction): void {
  
  const db = getDb();
  const projectId = req.params.projectId || req.body?.project_id;
  if (!projectId) { next(); return; }
  const count = db.prepare('SELECT COUNT(*) as count FROM pages WHERE project_id = ?').get(projectId) as any;
  if (count?.count >= 50) {
    res.status(400).json({ error: 'Maximum 50 pages per sitemap reached.' }); return;
  }
  next();
}

// Max wireframe blocks: 100 per page
export function maxBlockLimit(req: any, res: Response, next: NextFunction): void {
  const blocks = req.body?.blocks;
  if (blocks && Array.isArray(blocks) && blocks.length > 100) {
    res.status(400).json({ error: 'Maximum 100 wireframe blocks per page.' }); return;
  }
  next();
}
