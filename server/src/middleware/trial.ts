import { Response, NextFunction } from 'express';
import { getDb } from '../db.js';
import { AuthenticatedRequest } from '../types.js';

/**
 * Middleware that checks whether the authenticated user has an active trial
 * or paid subscription for the Pipeline product.
 * 
 * Free users get a 7-day trial from signup. After trial expires,
 * they must upgrade to continue using Pipeline features.
 */
export function requirePipelineAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const db = getDb();
  const user = db.prepare(
    'SELECT subscription_tier, trial_started_at, trial_ends_at FROM users WHERE id = ?'
  ).get(req.user.userId) as { subscription_tier: string; trial_started_at: string | null; trial_ends_at: string | null } | undefined;

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Paid users always have access
  if (user.subscription_tier !== 'FREE') {
    return next();
  }

  // Check trial status
  const now = new Date();
  if (user.trial_ends_at && new Date(user.trial_ends_at) > now) {
    return next();
  }

  // Trial expired or never started
  res.status(402).json({
    error: 'Trial expired. Please choose a plan.',
    message: 'Your 7-day free trial has ended. Please upgrade to continue using Nuria Client Pipeline.',
    code: 'TRIAL_EXPIRED',
  });
}
