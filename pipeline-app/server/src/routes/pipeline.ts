import { Router, type Response } from 'express';
import { getDb } from '../db.js';
import { authenticate } from '../middleware/auth.js';
import { requirePipelineAccess } from '../middleware/trial.js';
import type { AuthenticatedRequest } from '../types.js';

const router = Router();

// GET /api/pipeline/me — returns the user's subscription + trial status.
// Phase 1 placeholder that exercises `authenticate` + `requirePipelineAccess`
// (7-day free trial, non-FREE = always access, expired → 402 TRIAL_EXPIRED).
// The full 15-endpoint pipeline API (agency, case studies, pitches) arrives in
// Phase 2.
router.get('/me', authenticate, requirePipelineAccess, (req: AuthenticatedRequest, res: Response): void => {
  const db = getDb();
  const user = db.prepare(
    'SELECT id, email, subscription_tier, trial_started_at, trial_ends_at, created_at FROM users WHERE id = ?'
  ).get(req.user!.userId) as {
    id: string;
    email: string;
    subscription_tier: string;
    trial_started_at: string | null;
    trial_ends_at: string | null;
    created_at: string;
  } | undefined;

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const now = new Date();
  const trialActive = !!user.trial_ends_at && new Date(user.trial_ends_at) > now;
  res.json({
    user: {
      id: user.id,
      email: user.email,
      subscription_tier: user.subscription_tier,
      trial_started_at: user.trial_started_at,
      trial_ends_at: user.trial_ends_at,
      trial_active: trialActive,
      created_at: user.created_at,
    },
  });
});

export default router;
