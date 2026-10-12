import { Router, Request, Response } from 'express';
import { getDb, getRawDb } from '../../server/src/db.js';
import { runAudit, runAuditFromHtml } from '../engine/index.js';
import { runAuditSchema, runAuditFromHtmlSchema } from '../schemas/audit.js';
import crypto from 'crypto';
import { auditIPRateLimit, singleAuditQueue, auditCooldown, auditURLBlacklist } from '../../server/src/middleware/abuseProtection.js';

const router = Router();

// Generate a simple UUID
function uuid(): string {
  return crypto.randomUUID();
}

// Check if user can run an audit.
// - Premium tiers (SOLO/TEAM/AGENCY) get unlimited FULL audits.
// - Free tier gets 1 lifetime free (homepage-only) audit.
// - A paid "Single Use" purchase grants exactly one extra FULL audit credit
//   (audit_usage.paid_audits), consumed here when it unlocks an audit.
function checkAuditLimit(userId: string): { allowed: boolean; message?: string; isFullAccess: boolean } {
  const db = getDb();
  const user = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(userId) as any;
  if (!user) return { allowed: false, message: 'User not found', isFullAccess: false };

  // Premium tiers get unlimited full audits
  if (user.subscription_tier !== 'FREE') {
    return { allowed: true, isFullAccess: true };
  }

  // Free tier: check usage + paid credits
  const usage = db.prepare('SELECT audits_run, paid_audits FROM audit_usage WHERE user_id = ?').get(userId) as any;
  const count = usage?.audits_run || 0;
  const paidCredits = usage?.paid_audits || 0;

  if (count >= 1 && paidCredits <= 0) {
    return { allowed: false, message: 'Free tier limited to 1 audit. Upgrade to run more.', isFullAccess: false };
  }

  // If this audit is unlocked by a paid credit (free audit already used),
  // consume the credit and run it with full (non-free) access.
  if (count >= 1 && paidCredits > 0) {
    db.prepare('UPDATE audit_usage SET paid_audits = paid_audits - 1 WHERE user_id = ?').run(userId);
    return { allowed: true, isFullAccess: true };
  }

  // First free audit (homepage-only)
  return { allowed: true, isFullAccess: false };
}

// POST /api/audit/run
router.post('/run', auditIPRateLimit, auditCooldown, singleAuditQueue, auditURLBlacklist, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      // Allow unauthenticated users as free tier
      (req as any).tier = 'free';
    } else {
      // Authenticated users get their actual tier
      (req as any).tier = (user.subscription_tier || 'FREE').toLowerCase();
    }

    const parsed = runAuditSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    // Check audit limit (skip for unauthenticated free-tier users)
    const limit = user ? checkAuditLimit(user.id) : { allowed: true, isFullAccess: false };
    if (!limit.allowed) {
      return res.status(402).json({ error: limit.message });
    }

    const targetUrl = parsed.data.url.startsWith('http') ? parsed.data.url : `https://${parsed.data.url}`;
    const db = getDb();
    const reportId = uuid();

    // Create report record
    db.prepare(`
      INSERT INTO audit_reports (id, user_id, target_url, status)
      VALUES (?, ?, ?, 'running')
    `).run(reportId, user ? user.id : 'anonymous', targetUrl);

    // Run audit asynchronously (don't await — respond immediately).
    // A free-tier user who just consumed a paid "Single Use" credit still gets
    // a FULL audit (non-free tier), not the homepage-only free audit.
    const userTier = user ? (user.subscription_tier || 'FREE') : 'FREE';
    const auditTier = limit.isFullAccess ? (userTier === 'FREE' ? 'single' : userTier.toLowerCase()) : 'free';
    runAudit(targetUrl, { tier: auditTier }).then(async (report) => {
      const db2 = getDb();

      // Update report
      db2.prepare(`
        UPDATE audit_reports SET status = ?, overall_score = ?, summary = ?, error = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(report.status, report.overall_score, report.summary, report.error || null, reportId);

      // Insert dimensions and checks
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

      // Update audit usage
      const existing = db2.prepare('SELECT audits_run FROM audit_usage WHERE user_id = ?').get(user ? user.id : 'anonymous') as any;
      if (existing) {
        db2.prepare('UPDATE audit_usage SET audits_run = audits_run + 1, last_audit_at = datetime(\'now\') WHERE user_id = ?').run(user ? user.id : 'anonymous');
      } else {
        db2.prepare('INSERT INTO audit_usage (user_id, audits_run, last_audit_at) VALUES (?, 1, datetime(\'now\'))').run(user ? user.id : 'anonymous');
      }

      // Persist DB changes
      try {
        const rawDb = getRawDb();
        const data = rawDb.export();
        const fs = await import('fs');
        const { config } = await import('../../server/src/config.js');
        fs.writeFileSync(config.dbPath, Buffer.from(data));
      } catch (e) {
        console.error('[Audit] Failed to persist:', e);
      }
    }).catch(async (err) => {
      const db2 = getDb();
      db2.prepare(`
        UPDATE audit_reports SET status = 'failed', error = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(err instanceof Error ? err.message : 'Audit failed', reportId);
    });

    // Respond immediately
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
router.post('/run-html', auditIPRateLimit, auditCooldown, singleAuditQueue, auditURLBlacklist, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      (req as any).tier = 'free';
    } else {
      (req as any).tier = (user.subscription_tier || 'FREE').toLowerCase();
    }

    const parsed = runAuditFromHtmlSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    // Check audit limit (skip for unauthenticated free-tier users)
    const limit = user ? checkAuditLimit(user.id) : { allowed: true, isFullAccess: false };
    if (!limit.allowed) {
      return res.status(402).json({ error: limit.message });
    }

    const sourceUrl = parsed.data.url.startsWith('http') ? parsed.data.url : `https://${parsed.data.url}`;
    const db = getDb();
    const reportId = uuid();

    // Create report record
    db.prepare(`
      INSERT INTO audit_reports (id, user_id, target_url, status)
      VALUES (?, ?, ?, 'running')
    `).run(reportId, user ? user.id : 'anonymous', sourceUrl);

    // Run audit asynchronously
    const userTier = user ? (user.subscription_tier || 'FREE') : 'FREE';
    const auditTier = limit.isFullAccess ? (userTier === 'FREE' ? 'single' : userTier.toLowerCase()) : 'free';
    runAuditFromHtml(parsed.data.html, sourceUrl, auditTier).then(async (report) => {
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

      const existing = db2.prepare('SELECT audits_run FROM audit_usage WHERE user_id = ?').get(user ? user.id : 'anonymous') as any;
      if (existing) {
        db2.prepare('UPDATE audit_usage SET audits_run = audits_run + 1, last_audit_at = datetime(\'now\') WHERE user_id = ?').run(user ? user.id : 'anonymous');
      } else {
        db2.prepare('INSERT INTO audit_usage (user_id, audits_run, last_audit_at) VALUES (?, 1, datetime(\'now\'))').run(user ? user.id : 'anonymous');
      }

      try {
        const rawDb = getRawDb();
        const data = rawDb.export();
        const fs = await import('fs');
        const { config } = await import('../../server/src/config.js');
        fs.writeFileSync(config.dbPath, Buffer.from(data));
      } catch (e) {
        console.error('[Audit] Failed to persist:', e);
      }
    }).catch(async (err) => {
      const db2 = getDb();
      db2.prepare(`
        UPDATE audit_reports SET status = 'failed', error = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(err instanceof Error ? err.message : 'Audit failed', reportId);
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
router.get('/reports', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      // Allow unauthenticated users as free tier
      (req as any).tier = 'free';
    } else {
      // Authenticated users get their actual tier
      (req as any).tier = (user.subscription_tier || 'FREE').toLowerCase();
    }

    const db = getDb();
    const reports = db.prepare(`
      SELECT id, target_url, status, overall_score, summary, error, created_at
      FROM audit_reports
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(user ? user.id : 'anonymous');

    res.json({ reports });
  } catch (err) {
    console.error('[Audit] List error:', err);
    res.status(500).json({ error: 'Failed to list reports' });
  }
});

// GET /api/audit/reports/:id
router.get('/reports/:id', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      // Allow unauthenticated users as free tier
      (req as any).tier = 'free';
    } else {
      // Authenticated users get their actual tier
      (req as any).tier = (user.subscription_tier || 'FREE').toLowerCase();
    }

    const db = getDb();
    const report = db.prepare(`
      SELECT id, target_url, status, overall_score, summary, error, created_at
      FROM audit_reports
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, user ? user.id : "anonymous") as any;

    if (!report) return res.status(404).json({ error: 'Report not found' });

    // Get dimensions
    const dimensions = db.prepare(`
      SELECT id, dimension, label, icon, score, status, summary
      FROM audit_dimensions
      WHERE report_id = ?
      ORDER BY score DESC
    `).all(report.id) as any[];

    // Get checks for each dimension
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
router.get('/reports/:id/status', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      // Allow unauthenticated users as free tier
      (req as any).tier = 'free';
    } else {
      // Authenticated users get their actual tier
      (req as any).tier = (user.subscription_tier || 'FREE').toLowerCase();
    }

    const db = getDb();
    const report = db.prepare(`
      SELECT status, overall_score
      FROM audit_reports
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, user ? user.id : "anonymous") as any;

    if (!report) return res.status(404).json({ error: 'Report not found' });

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
router.get('/usage', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      // Allow unauthenticated users as free tier
      (req as any).tier = 'free';
    } else {
      // Authenticated users get their actual tier
      (req as any).tier = (user.subscription_tier || 'FREE').toLowerCase();
    }

    const db = getDb();
    const usage = db.prepare('SELECT audits_run, paid_audits, last_audit_at FROM audit_usage WHERE user_id = ?').get(user ? user.id : 'anonymous') as any;
    const userRec = user ? db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(user.id) as any : null;

    const auditsRun = usage?.audits_run || 0;
    const paidAudits = usage?.paid_audits || 0;
    const isFree = userRec?.subscription_tier === 'FREE';
    const limit = isFree ? 1 : 999999;

    res.json({
      audits_run: auditsRun,
      paid_audits: paidAudits,
      limit,
      remaining: Math.max(0, limit - auditsRun),
      is_free_tier: isFree,
      last_audit_at: usage?.last_audit_at || null,
    });
  } catch (err) {
    console.error('[Audit] Usage error:', err);
    res.status(500).json({ error: 'Failed to get usage' });
  }
});

export default router;