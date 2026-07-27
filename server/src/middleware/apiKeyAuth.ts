import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getDb } from '../db.js';

// Extend the Request type for API key auth
declare global {
  namespace Express {
    interface Request {
      apiKey?: { userId: string; email: string; subscriptionTier: string };
    }
  }
}

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export function apiKeyAuth(req: any, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string || req.query.api_key as string;

  if (!apiKey) {
    next(); // fall through to cookie auth
    return;
  }

  try {
    const hash = hashKey(apiKey);
    const db = getDb();
    const row = db.prepare(`
      SELECT ak.user_id, u.email, u.subscription_tier
      FROM api_keys ak JOIN users u ON ak.user_id = u.id
      WHERE ak.key_hash = ?
    `).get(hash) as any;

    if (!row) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    // Update last_used_at
    db.prepare('UPDATE api_keys SET last_used_at = datetime(\'now\') WHERE key_hash = ?').run(hash);

    (req as any).apiKey = {
      userId: row.user_id,
      email: row.email,
      subscriptionTier: row.subscription_tier,
    };

    // Also set on req.user for middleware compatibility
    if (!(req as any).user) {
      (req as any).user = {
        userId: row.user_id,
        email: row.email,
        subscriptionTier: row.subscription_tier,
      };
    }

    next();
  } catch (err) {
    res.status(500).json({ error: 'API key validation failed' });
  }
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function apiRateLimit(req: any, res: Response, next: NextFunction): void {
  const key = req.headers['x-api-key'] as string;
  if (!key) { next(); return; }

  const now = Date.now();
  const minute = 60000;
  const entry = rateLimitMap.get(key);

  if (entry && now < entry.resetAt) {
    if (entry.count >= 100) {
      res.status(429).json({ error: 'Rate limit exceeded — 100 requests/minute' });
      return;
    }
    entry.count++;
  } else {
    rateLimitMap.set(key, { count: 1, resetAt: now + minute });
  }

  next();
}
