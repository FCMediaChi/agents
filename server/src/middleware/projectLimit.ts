import { Response, NextFunction } from 'express';
import { getDb } from '../db.js';
import { AuthenticatedRequest } from '../types.js';

const MONTHLY_LIMITS: Record<string, number> = {
  FREE: 1,    // lifetime
  SOLO: 5,
  TEAM: 10,
  AGENCY: 999999,
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export async function checkProjectLimit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const { userId, subscriptionTier } = req.user!;
  const tier = subscriptionTier || 'FREE';
  const limit = MONTHLY_LIMITS[tier] ?? 1;

  const db = getDb();
  const month = currentMonth();

  if (tier === 'FREE') {
    // Free tier: 1 project lifetime, no monthly reset
    const row = db.prepare('SELECT COUNT(*) as count FROM projects WHERE user_id = ?').get(userId) as { count: number };
    const projectCount = row?.count ?? 0;

    if (projectCount >= 1) {
      res.status(403).json({
        error: 'Limit Reached',
        message: 'Free accounts are limited to 1 planning project. Upgrade to Solo ($59/mo) for 5 projects/month, Team ($149/mo) for 10, or Agency ($297/mo) for unlimited.',
      });
      return;
    }
  } else {
    // Paid tiers: monthly limits tracked via project_monthly_counter
    const counter = db.prepare('SELECT project_count FROM project_monthly WHERE user_id = ? AND month_key = ?')
      .get(userId, month) as { project_count: number } | undefined;
    const count = counter?.project_count ?? 0;

    if (count >= limit) {
      res.status(403).json({
        error: 'Monthly Limit Reached',
        message: `Your ${tier.toLowerCase()} plan allows ${limit} projects per month. You've reached this limit. Upgrade to a higher tier or wait until next month.`,
      });
      return;
    }
  }

  next();
}

export function incrementProjectCount(userId: string, tier: string): void {
  if (tier === 'FREE') return; // Free tier tracked by COUNT(*)
  const db = getDb();
  const month = currentMonth();

  const existing = db.prepare('SELECT project_count FROM project_monthly WHERE user_id = ? AND month_key = ?')
    .get(userId, month) as { project_count: number } | undefined;

  if (existing) {
    db.prepare('UPDATE project_monthly SET project_count = project_count + 1 WHERE user_id = ? AND month_key = ?')
      .run(userId, month);
  } else {
    db.prepare('INSERT INTO project_monthly (user_id, month_key, project_count) VALUES (?, ?, 1)')
      .run(userId, month);
  }
}

export function requirePaidTier(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const tier = req.user!.subscriptionTier || 'FREE';
  if (tier === 'FREE') {
    res.status(403).json({
      error: 'Premium Feature',
      message: 'This feature requires a paid plan. Upgrade to Solo ($59/mo), Team ($149/mo), or Agency ($297/mo).',
    });
    return;
  }
  next();
}
