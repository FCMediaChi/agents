import type { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getDb } from '../db.js';
import type { AuthenticatedRequest, JwtPayload } from '../types.js';

/**
 * Read the user's CURRENT subscription tier from the database.
 *
 * Why not trust the JWT? The token is signed at login with the tier known at
 * that moment, so a Stripe webhook grant (or a revocation) would otherwise not
 * take effect until the user logged out and back in — a paying customer would
 * stay locked out of what they just bought. Resolving the tier per request
 * makes entitlement fresh immediately, and it is a single indexed primary-key
 * lookup, so the cost is negligible.
 *
 * Returns null when the DB is not initialised or the row is gone.
 */
function currentTier(userId: string): string | null {
  try {
    const row = getDb()
      .prepare('SELECT subscription_tier FROM users WHERE id = ?')
      .get(userId) as { subscription_tier?: string } | undefined;
    return row?.subscription_tier ?? null;
  } catch {
    // DB not initialised (unit tests that only exercise pure helpers) — fall
    // back to whatever the token carries.
    return null;
  }
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  // Already resolved by apiKeyAuth (Agency API key) — nothing more to check.
  if (req.user?.userId) {
    next();
    return;
  }
  const token = req.cookies?.[config.cookieName];
  if (!token) {
    res.status(401).json({ error: 'Authentication required', message: 'Please log in to continue.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    // `id` is a compatibility alias for `userId` (see JwtPayload).
    req.user = { ...decoded, id: decoded.userId };
    // Refresh entitlement from the DB so a webhook grant/revoke applies at once.
    const tier = currentTier(decoded.userId);
    if (tier) req.user.subscriptionTier = tier;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token', message: 'Your session has expired. Please log in again.' });
  }
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[config.cookieName];
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
      req.user = { ...decoded, id: decoded.userId };
      const tier = currentTier(decoded.userId);
      if (tier) req.user.subscriptionTier = tier;
    } catch {
      // Invalid token — proceed as anonymous.
    }
  }
  next();
}
