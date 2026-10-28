import type { Response, NextFunction } from 'express';
import { getDb } from '../db.js';

// ───────────────────────────────────────────────────────────────
// Blueprint general usage limits.
//
// The monolith kept these in `abuseProtection.ts`, which also carries
// audit-only machinery (single-audit queue, audit cooldowns, a URL
// blacklist). Blueprint needs none of that, so only the four generic
// limits are reimplemented here, Blueprint-native:
//
//   projectCreateCooldown — 3s between project creations
//   maxPageLimit          — 50 sitemap pages per project
//   maxBlockLimit         — 100 wireframe blocks per page
//   exportRateLimit       — 10 exports per user per hour
//   exportCooldown        — 5s between exports
//
// All state is in-memory and per-process; these are abuse guardrails,
// not billing limits (those live in projectLimit.ts).
// ───────────────────────────────────────────────────────────────

interface CounterEntry {
  count: number;
  resetAt: number;
}

/** Fixed-window counter keyed by user id. */
function makeFixedWindow(max: number, windowMs: number, message: string) {
  const counts = new Map<string, CounterEntry>();
  return function limit(req: any, res: Response, next: NextFunction): void {
    const userId: string | undefined = req.user?.userId;
    // Anonymous callers are handled by `authenticate` upstream.
    if (!userId) {
      next();
      return;
    }
    const now = Date.now();
    const entry = counts.get(userId);
    if (entry && now < entry.resetAt) {
      if (entry.count >= max) {
        res.status(429).json({ error: message });
        return;
      }
      entry.count += 1;
    } else {
      counts.set(userId, { count: 1, resetAt: now + windowMs });
    }
    next();
  };
}

/** Minimum gap between two actions for the same user. */
function makeCooldown(minGapMs: number, message: (waitMs: number) => string) {
  const lastAt = new Map<string, number>();
  return function cooldown(req: any, res: Response, next: NextFunction): void {
    const userId: string | undefined = req.user?.userId;
    if (!userId) {
      next();
      return;
    }
    const now = Date.now();
    const last = lastAt.get(userId) ?? 0;
    const elapsed = now - last;
    if (elapsed < minGapMs) {
      res.status(429).json({ error: message(minGapMs - elapsed) });
      return;
    }
    lastAt.set(userId, now);
    next();
  };
}

/** 3 seconds between project creations (guards accidental double-submits). */
export const projectCreateCooldown = makeCooldown(
  3000,
  () => 'Please wait before creating another project.'
);

/** 10 exports per user per hour. */
export const exportRateLimit = makeFixedWindow(
  10,
  60 * 60 * 1000,
  'Export limit reached — 10 exports per hour. Try again later.'
);

/** 5 seconds between exports. */
export const exportCooldown = makeCooldown(
  5000,
  (waitMs) => `Please wait ${Math.ceil(waitMs / 1000)}s before another export.`
);

/** Hard cap of 50 pages per sitemap (project or the parent of the page being added). */
export function maxPageLimit(req: any, res: Response, next: NextFunction): void {
  const projectId: string | undefined = req.params?.projectId || req.body?.project_id;
  if (!projectId) {
    next();
    return;
  }
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM pages WHERE project_id = ?').get(projectId) as
    | { count: number }
    | undefined;
  if ((row?.count ?? 0) >= 50) {
    res.status(400).json({ error: 'Maximum 50 pages per sitemap reached.' });
    return;
  }
  next();
}

/** Hard cap of 100 wireframe blocks per page. */
export function maxBlockLimit(req: any, res: Response, next: NextFunction): void {
  const blocks = req.body?.blocks;
  if (Array.isArray(blocks) && blocks.length > 100) {
    res.status(400).json({ error: 'Maximum 100 wireframe blocks per page.' });
    return;
  }
  next();
}
