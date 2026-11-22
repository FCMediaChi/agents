// pipeline-app/server/src/aiQuota.ts
//
// Per-tier monthly cap on AI prose generations.
//
// One "generation" is one case-study generation or one pitch analysis that the
// model actually wrote. A generation that fell back to the deterministic
// templates is NOT counted — the caller only consumes a unit when the result
// really came from the model (see routes/pipeline.ts).
//
// Usage is stored per user per calendar month (UTC) in `pipeline_ai_usage`.

import { getDb } from './db.js';

/** Monthly AI generations allowed per subscription tier. `null` = unlimited. */
export const AI_MONTHLY_CAP: Record<string, number | null> = {
  FREE: 20,
  SOLO: 100,
  TEAM: 300,
  AGENCY: null,
};

/** Fallback cap for an unknown/blank tier — treated like FREE. */
export const DEFAULT_AI_MONTHLY_CAP = AI_MONTHLY_CAP.FREE;

export interface AiQuotaState {
  tier: string;
  period: string;
  limit: number | null;
  used: number;
  remaining: number | null;
  /** Whether another generation is still permitted. */
  allowed: boolean;
}

/** Cap for a tier (null = unlimited). Unknown tiers fall back to the FREE cap. */
export function capForTier(tier: string | null | undefined): number | null {
  const key = (tier || 'FREE').toUpperCase();
  return key in AI_MONTHLY_CAP ? AI_MONTHLY_CAP[key] : DEFAULT_AI_MONTHLY_CAP;
}

/** Current usage period key, e.g. "2026-11" (UTC calendar month). */
export function monthlyPeriod(now: Date = new Date()): string {
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${now.getUTCFullYear()}-${month}`;
}

function usedCount(userId: string, period: string): number {
  const row = getDb()
    .prepare('SELECT count FROM pipeline_ai_usage WHERE user_id = ? AND period = ?')
    .get(userId, period) as { count?: number } | undefined;
  const n = Number(row?.count ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Read-only check: has this user used up their month's AI generations? */
export function aiQuotaState(
  userId: string,
  tier: string | null | undefined,
  period: string = monthlyPeriod()
): AiQuotaState {
  const limit = capForTier(tier);
  const used = usedCount(userId, period);
  const allowed = limit === null || used < limit;
  return {
    tier: (tier || 'FREE').toUpperCase(),
    period,
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    allowed,
  };
}

/**
 * Record one AI generation for this user/month.
 * Refuses (and does not increment) when the cap is already reached.
 */
export function consumeAiGeneration(
  userId: string,
  tier: string | null | undefined,
  period: string = monthlyPeriod()
): AiQuotaState {
  const before = aiQuotaState(userId, tier, period);
  if (!before.allowed) return before;

  const db = getDb();
  const used = before.used + 1;
  if (before.used === 0) {
    db.prepare('INSERT INTO pipeline_ai_usage (user_id, period, count) VALUES (?, ?, ?)').run(userId, period, used);
  } else {
    db.prepare('UPDATE pipeline_ai_usage SET count = ? WHERE user_id = ? AND period = ?').run(used, userId, period);
  }

  return {
    ...before,
    used,
    remaining: before.limit === null ? null : Math.max(0, before.limit - used),
    allowed: before.limit === null || used < before.limit,
  };
}
