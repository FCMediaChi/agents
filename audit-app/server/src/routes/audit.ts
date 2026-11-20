import { Router, type Response } from 'express';
import crypto from 'crypto';
import { getDb, persistDb } from '../db.js';
import { runAudit, runAuditFromHtml } from '../engine/index.js';
import { runAuditSchema, runAuditFromHtmlSchema } from '../schemas/audit.js';
import { auditIPRateLimit, singleAuditQueue, auditCooldown, auditURLBlacklist } from '../middleware/abuseProtection.js';
import { optionalAuth } from '../middleware/auth.js';
import { anonymousVisitor, usageKeys } from '../middleware/visitor.js';
import type { AuthenticatedRequest } from '../types.js';

const router = Router();

// Populate req.user when a valid session cookie is present, but never require
// it: the run-audit flow stays reachable unauthenticated (anonymous = free tier).
router.use(optionalAuth);
// Give every unauthenticated caller their own visitor identity (httpOnly cookie,
// hashed-IP fallback) so the free audit is per visitor rather than one shared
// 'anonymous' row for the whole internet.
router.use(anonymousVisitor);

function uuid(): string {
  return crypto.randomUUID();
}

/** Resolve a scoping key + tier for the request. Anonymous → per-visitor key. */
function resolveUserId(req: AuthenticatedRequest): string {
  return usageKeys(req)[0];
}

function getUserTier(userId: string): string {
  if (userId === 'anonymous') return 'free';
  const db = getDb();
  const user = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(userId) as
    | { subscription_tier: string }
    | undefined;
  return (user?.subscription_tier || 'FREE').toLowerCase();
}

// Free / premium / one-time-credit bookkeeping.
//
// Audit has two entitlement sources:
//   1. `users.subscription_tier` — FREE (default) or a paid tier (TEAM/AGENCY)
//      written by the Stripe webhook. Anything other than FREE is premium:
//      unlimited runs + the full 7-dimension report.
//   2. `audit_usage.paid_audits` — remaining one-time "Single Use" ($29) audit
//      credits, also granted by the Stripe webhook. Each credit buys ONE full
//      premium-quality run and is consumed at submission, without ever changing
//      the account's tier (mirrors the monolith's paid_audits behaviour).
export function getPaidAudits(userId: string): number {
  if (userId === 'anonymous') return 0;
  const db = getDb();
  const row = db.prepare('SELECT paid_audits FROM audit_usage WHERE user_id = ?').get(userId) as
    | { paid_audits: number }
    | undefined;
  return row?.paid_audits || 0;
}

/** Spend one paid audit credit. Returns true when a credit was consumed. */
export function consumePaidAudit(userId: string): boolean {
  if (userId === 'anonymous') return false;
  const db = getDb();
  const row = db.prepare('SELECT paid_audits FROM audit_usage WHERE user_id = ?').get(userId) as
    | { paid_audits: number }
    | undefined;
  if (!row || row.paid_audits <= 0) return false;
  db.prepare('UPDATE audit_usage SET paid_audits = paid_audits - 1 WHERE user_id = ?').run(userId);
  return true;
}

/** What a single run is allowed to do for this caller. */
export interface RunEntitlement {
  allowed: boolean;
  message?: string;
  /** Tier string handed to the engine: 'free' ⇒ homepage-only. */
  tier: string;
  /** True when this run spends one paid Single Use credit. */
  usedCredit: boolean;
  /** Key holding the credit being spent, when usedCredit is true. */
  creditKey?: string;
}

// Enforce the free-tier limit. Premium tiers are unlimited; anonymous visitors
// are treated as free tier with the same 1-audit limit, keyed on their own
// visitor id (see middleware/visitor.ts). `extraKeys` carries the hashed-IP
// fallback key for callers that did not send the visitor cookie. A user holding
// a paid Single Use credit is allowed through even after the free audit is spent.
export function checkAuditLimit(userId: string, extraKeys: string[] = []): RunEntitlement {
  const db = getDb();
  const user = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(userId) as
    | { subscription_tier: string }
    | undefined;

  if (user && user.subscription_tier !== 'FREE') {
    return { allowed: true, tier: user.subscription_tier.toLowerCase(), usedCredit: false };
  }

  const keys = [userId, ...extraKeys];
  const spent = keys.some((key) => {
    const usage = db.prepare('SELECT audits_run FROM audit_usage WHERE user_id = ?').get(key) as
      | { audits_run: number }
      | undefined;
    return (usage?.audits_run || 0) >= 1;
  });

  if (!spent) {
    return { allowed: true, tier: 'free', usedCredit: false };
  }

  const creditKey = keys.find((key) => getPaidAudits(key) > 0);
  if (creditKey) {
    return { allowed: true, tier: 'single', usedCredit: true, creditKey };
  }

  return { allowed: false, message: 'Free tier limited to 1 audit. Upgrade to run more.', tier: 'free', usedCredit: false };
}

/** Record one completed run against every key the caller is known by. */
function recordAuditRun(keys: string[]): void {
  const db = getDb();
  for (const key of keys) {
    const existing = db.prepare('SELECT audits_run FROM audit_usage WHERE user_id = ?').get(key) as
      | { audits_run: number }
      | undefined;
    if (existing) {
      db.prepare("UPDATE audit_usage SET audits_run = audits_run + 1, last_audit_at = datetime('now') WHERE user_id = ?").run(key);
    } else {
      db.prepare("INSERT INTO audit_usage (user_id, audits_run, last_audit_at) VALUES (?, 1, datetime('now'))").run(key);
    }
  }
}

// POST /api/audit/run
router.post('/run', auditIPRateLimit, auditCooldown, singleAuditQueue, auditURLBlacklist, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = runAuditSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const keys = usageKeys(req);
    const userId = keys[0];
    const limit = checkAuditLimit(userId, keys.slice(1));
    if (!limit.allowed) {
      res.status(402).json({ error: limit.message });
      return;
    }

    // A paid Single Use credit is spent at submission, so a failed run still
    // costs a credit exactly once (and a retry needs no second purchase).
    if (limit.usedCredit) consumePaidAudit(limit.creditKey ?? userId);

    const targetUrl = parsed.data.url.startsWith('http') ? parsed.data.url : `https://${parsed.data.url}`;
    const db = getDb();
    const reportId = uuid();

    db.prepare(`
      INSERT INTO audit_reports (id, user_id, target_url, status)
      VALUES (?, ?, ?, 'running')
    `).run(reportId, userId, targetUrl);

    const tier = limit.tier;
    runAudit(targetUrl, { tier }).then((report) => {
      const db2 = getDb();

      db2.prepare(`
        UPDATE audit_reports SET status = ?, overall_score = ?, summary = ?, error = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(report.status, report.overall_score, report.summary, report.error || null, reportId);

      if (report.dimensions) {
        for (const dim of report.dimensions) {
          const dimId = uuid();
          db2.prepare(`
            INSERT INTO audit_dimensions (id, report_id, dimension, label, icon, score, status, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(dimId, reportId, dim.dimension, dim.label, dim.icon, dim.score, dim.grade, dim.summary);

          for (const check of dim.checks) {
            db2.prepare(`
              INSERT INTO audit_checks (id, dimension_id, check_name, label, passed, severity, detail, recommendation)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(uuid(), dimId, check.check_name, check.label, check.passed ? 1 : 0, check.severity, check.detail, check.recommendation);
          }
        }
      }

      recordAuditRun(keys);
      persistDb();
    }).catch((err) => {
      const db2 = getDb();
      db2.prepare(`
        UPDATE audit_reports SET status = 'failed', error = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(err instanceof Error ? err.message : 'Audit failed', reportId);
      persistDb();
    });

    res.status(202).json({
      report_id: reportId,
      status: 'running',
      target_url: targetUrl,
      estimated_time_seconds: 15,
    });
  } catch (err) {
    console.error('[Audit] Run error:', err);
    res.status(500).json({ error: 'Failed to start audit' });
  }
});

// POST /api/audit/run-html — audit from pasted HTML
router.post('/run-html', auditIPRateLimit, auditCooldown, singleAuditQueue, auditURLBlacklist, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = runAuditFromHtmlSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const keys = usageKeys(req);
    const userId = keys[0];
    const limit = checkAuditLimit(userId, keys.slice(1));
    if (!limit.allowed) {
      res.status(402).json({ error: limit.message });
      return;
    }

    // A paid Single Use credit is spent at submission, so a failed run still
    // costs a credit exactly once (and a retry needs no second purchase).
    if (limit.usedCredit) consumePaidAudit(limit.creditKey ?? userId);

    const sourceUrl = parsed.data.url.startsWith('http') ? parsed.data.url : `https://${parsed.data.url}`;
    const db = getDb();
    const reportId = uuid();

    db.prepare(`
      INSERT INTO audit_reports (id, user_id, target_url, status)
      VALUES (?, ?, ?, 'running')
    `).run(reportId, userId, sourceUrl);

    const tier = limit.tier;
    runAuditFromHtml(parsed.data.html, sourceUrl, tier).then((report) => {
      const db2 = getDb();

      db2.prepare(`
        UPDATE audit_reports SET status = ?, overall_score = ?, summary = ?, error = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(report.status, report.overall_score, report.summary, report.error || null, reportId);

      if (report.dimensions) {
        for (const dim of report.dimensions) {
          const dimId = uuid();
          db2.prepare(`
            INSERT INTO audit_dimensions (id, report_id, dimension, label, icon, score, status, summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(dimId, reportId, dim.dimension, dim.label, dim.icon, dim.score, dim.grade, dim.summary);

          for (const check of dim.checks) {
            db2.prepare(`
              INSERT INTO audit_checks (id, dimension_id, check_name, label, passed, severity, detail, recommendation)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(uuid(), dimId, check.check_name, check.label, check.passed ? 1 : 0, check.severity, check.detail, check.recommendation);
          }
        }
      }

      recordAuditRun(keys);
      persistDb();
    }).catch((err) => {
      const db2 = getDb();
      db2.prepare(`
        UPDATE audit_reports SET status = 'failed', error = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(err instanceof Error ? err.message : 'Audit failed', reportId);
      persistDb();
    });

    res.status(202).json({
      report_id: reportId,
      status: 'running',
      target_url: sourceUrl,
      estimated_time_seconds: 15,
    });
  } catch (err) {
    console.error('[Audit] Run-HTML error:', err);
    res.status(500).json({ error: 'Failed to start audit' });
  }
});

// GET /api/audit/reports
router.get('/reports', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const db = getDb();
    const reports = db.prepare(`
      SELECT id, target_url, status, overall_score, summary, error, created_at
      FROM audit_reports
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userId);

    res.json({ reports });
  } catch (err) {
    console.error('[Audit] List error:', err);
    res.status(500).json({ error: 'Failed to list reports' });
  }
});

// GET /api/audit/reports/:id
router.get('/reports/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const db = getDb();
    const report = db.prepare(`
      SELECT id, target_url, status, overall_score, summary, error, created_at
      FROM audit_reports
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, userId) as any;

    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    const dimensions = db.prepare(`
      SELECT id, dimension, label, icon, score, status, summary
      FROM audit_dimensions
      WHERE report_id = ?
      ORDER BY score DESC
    `).all(report.id) as any[];

    const dimensionsWithChecks = dimensions.map((dim: any) => {
      const checks = db.prepare(`
        SELECT check_name, label, passed, severity, detail, recommendation
        FROM audit_checks
        WHERE dimension_id = ?
      `).all(dim.id);

      return {
        dimension: dim.dimension,
        label: dim.label,
        icon: dim.icon,
        score: dim.score,
        status: dim.status,
        summary: dim.summary,
        checks: checks.map((c: any) => ({
          ...c,
          passed: c.passed === 1,
        })),
      };
    });

    res.json({
      id: report.id,
      target_url: report.target_url,
      overall_score: report.overall_score,
      status: report.status,
      summary: report.summary,
      error: report.error,
      created_at: report.created_at,
      dimensions: dimensionsWithChecks,
    });
  } catch (err) {
    console.error('[Audit] Get error:', err);
    res.status(500).json({ error: 'Failed to get report' });
  }
});

// GET /api/audit/reports/:id/status
router.get('/reports/:id/status', (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = resolveUserId(req);
    const db = getDb();
    const report = db.prepare(`
      SELECT status, overall_score
      FROM audit_reports
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, userId) as any;

    if (!report) {
      res.status(404).json({ error: 'Report not found' });
      return;
    }

    res.json({
      status: report.status,
      overall_score: report.overall_score,
    });
  } catch (err) {
    console.error('[Audit] Status error:', err);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// GET /api/audit/usage
router.get('/usage', (req: AuthenticatedRequest, res: Response) => {
  try {
    const keys = usageKeys(req);
    const userId = keys[0];
    const db = getDb();
    let auditsRun = 0;
    let lastAuditAt: string | null = null;
    for (const key of keys) {
      const usage = db.prepare('SELECT audits_run, last_audit_at FROM audit_usage WHERE user_id = ?').get(key) as
        | { audits_run: number; last_audit_at: string | null }
        | undefined;
      auditsRun = Math.max(auditsRun, usage?.audits_run || 0);
      if (!lastAuditAt) lastAuditAt = usage?.last_audit_at || null;
    }

    const isFree = getUserTier(userId) === 'free';
    // Paid Single Use credits grant extra full-audit runs without changing tier.
    const paidAudits = Math.max(0, ...keys.map((key) => getPaidAudits(key)));
    const limit = isFree ? 1 + paidAudits : 999999;

    res.json({
      audits_run: auditsRun,
      limit,
      remaining: isFree && paidAudits > 0 ? paidAudits : Math.max(0, limit - auditsRun),
      is_free_tier: isFree,
      paid_audits_remaining: paidAudits,
      last_audit_at: lastAuditAt,
    });
  } catch (err) {
    console.error('[Audit] Usage error:', err);
    res.status(500).json({ error: 'Failed to get usage' });
  }
});

export default router;
