import { Router, Request, Response } from 'express';
import { getDb, getRawDb } from '../../server/src/db.js';
import { runAudit } from '../engine/index.js';
import { runAuditSchema } from '../schemas/audit.js';
import crypto from 'crypto';

const router = Router();

// Generate a simple UUID
function uuid(): string {
  return crypto.randomUUID();
}

// Check if user can run an audit
function checkAuditLimit(userId: string): { allowed: boolean; message?: string } {
  const db = getDb();
  const user = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(userId) as any;
  if (!user) return { allowed: false, message: 'User not found' };

  // Premium tiers get unlimited audits
  if (user.subscription_tier !== 'FREE') {
    return { allowed: true };
  }

  // Free tier: check usage
  const usage = db.prepare('SELECT audits_run FROM audit_usage WHERE user_id = ?').get(userId) as any;
  const count = usage?.audits_run || 0;

  if (count >= 1) {
    return { allowed: false, message: 'Free tier limited to 1 audit. Upgrade to run more.' };
  }

  return { allowed: true };
}

// POST /api/audit/run
router.post('/run', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const parsed = runAuditSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }

    // Check audit limit
    const limit = checkAuditLimit(user.id);
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
    `).run(reportId, user.id, targetUrl);

    // Run audit asynchronously (don't await — respond immediately)
    const userTier = user.subscription_tier || 'FREE';
    runAudit(targetUrl, { tier: userTier.toLowerCase() }).then(async (report) => {
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
      const existing = db2.prepare('SELECT audits_run FROM audit_usage WHERE user_id = ?').get(user.id) as any;
      if (existing) {
        db2.prepare('UPDATE audit_usage SET audits_run = audits_run + 1, last_audit_at = datetime(\'now\') WHERE user_id = ?').run(user.id);
      } else {
        db2.prepare('INSERT INTO audit_usage (user_id, audits_run, last_audit_at) VALUES (?, 1, datetime(\'now\'))').run(user.id);
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

// GET /api/audit/reports
router.get('/reports', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const db = getDb();
    const reports = db.prepare(`
      SELECT id, target_url, status, overall_score, summary, error, created_at
      FROM audit_reports
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(user.id);

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
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const db = getDb();
    const report = db.prepare(`
      SELECT id, target_url, status, overall_score, summary, error, created_at
      FROM audit_reports
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, user.id) as any;

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
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const db = getDb();
    const report = db.prepare(`
      SELECT status, overall_score
      FROM audit_reports
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, user.id) as any;

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
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const db = getDb();
    const usage = db.prepare('SELECT audits_run, last_audit_at FROM audit_usage WHERE user_id = ?').get(user.id) as any;
    const userRec = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(user.id) as any;

    const auditsRun = usage?.audits_run || 0;
    const isFree = userRec?.subscription_tier === 'FREE';
    const limit = isFree ? 1 : 999999;

    res.json({
      audits_run: auditsRun,
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