import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types.js';

// ── Pipeline general abuse protection ─────────────────────────
// A minimal, self-contained guard for Pipeline's expensive scrape operations
// (case-study generation + pitch analysis both fetch a user-supplied URL).
//
// Deliberately NOT a copy of the monolith's audit protections: Pipeline is
// auth-required (no anonymous free tier), so it needs no audit queue and no
// audit URL blacklist. IP/email rate limiting for login already lives in
// `../rateLimit.ts`. This file only adds a per-user cooldown so a single
// account can't hammer the outbound fetch engine.

const scrapeCooldownMap = new Map<string, number>();
const SCRAPE_COOLDOWN_MS = 5000;

export function scrapeCooldown(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const key = req.user?.userId || req.ip || 'unknown';
  const last = scrapeCooldownMap.get(key) || 0;
  const elapsed = Date.now() - last;
  if (elapsed < SCRAPE_COOLDOWN_MS) {
    res.status(429).json({
      error: `Please wait ${Math.ceil((SCRAPE_COOLDOWN_MS - elapsed) / 1000)}s before running another analysis.`,
    });
    return;
  }
  scrapeCooldownMap.set(key, Date.now());
  next();
}
