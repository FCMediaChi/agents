import { Response, NextFunction } from 'express';
import { getDb } from '../db.js';
import { AuthenticatedRequest } from '../types.js';

export async function checkProjectLimit(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const { userId, subscriptionTier } = req.user!;

  if (subscriptionTier === 'FREE') {
    const db = getDb();
    const row = db.prepare('SELECT COUNT(*) as count FROM projects WHERE user_id = ?').get(userId) as { count: number };
    const projectCount = row?.count ?? 0;

    if (projectCount >= 1) {
      res.status(403).json({
        error: 'Limit Reached',
        message: 'Free accounts are limited to 1 planning project. Upgrade to TheBlueprint Premium for unlimited projects, custom branding, and professional PDF exports!',
      });
      return;
    }
  }
  next();
}

export function requirePaidTier(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.user!.subscriptionTier !== 'PAID') {
    res.status(403).json({
      error: 'Premium Feature',
      message: 'This feature (custom branding and professional PDF exporting) is exclusive to TheBlueprint Premium. Please upgrade your plan.',
    });
    return;
  }
  next();
}