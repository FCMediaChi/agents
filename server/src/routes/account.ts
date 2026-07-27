import { Router, Request, Response } from 'express';
import { getDb } from '../db.js';

const router = Router();

function uuid(): string {
  return crypto.randomUUID();
}

// ── Team Management ──────────────────────────────────────────────

// GET /api/account/team — list team members
router.get('/team', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const db = getDb();
    const members = db.prepare(`
      SELECT id, email, role, status, invited_at, accepted_at
      FROM team_members
      WHERE account_id = ?
      ORDER BY invited_at ASC
    `).all(user.id);

    const userRec = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(user.id) as any;
    const tier = userRec?.subscription_tier || 'FREE';
    const maxSeats = tier === 'AGENCY' ? 999 : tier === 'TEAM' ? 5 : 1;

    res.json({
      members,
      maxSeats,
      currentSeats: members.length,
    });
  } catch (err) {
    console.error('[Account] Team list error:', err);
    res.status(500).json({ error: 'Failed to list team members' });
  }
});

// POST /api/account/team/invite — invite a team member
router.post('/team/invite', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const db = getDb();
    const userRec = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(user.id) as any;
    const tier = userRec?.subscription_tier || 'FREE';

    if (tier !== 'TEAM' && tier !== 'AGENCY') {
      return res.status(402).json({ error: 'Team management requires Team or Agency plan. Upgrade to access.' });
    }

    // Check seat limit for Team tier
    if (tier === 'TEAM') {
      const currentSeats = db.prepare('SELECT COUNT(*) as count FROM team_members WHERE account_id = ?').get(user.id) as any;
      if (currentSeats.count >= 5) {
        return res.status(402).json({ error: 'Team seat limit reached (max 5 seats). Upgrade to Agency for unlimited seats.' });
      }
    }

    // Check if already invited
    const existing = db.prepare('SELECT id FROM team_members WHERE account_id = ? AND email = ?').get(user.id, email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ error: 'This email has already been invited.' });
    }

    const memberId = uuid();
    db.prepare(`
      INSERT INTO team_members (id, account_id, email, role, status)
      VALUES (?, ?, ?, 'member', 'invited')
    `).run(memberId, user.id, email.toLowerCase().trim());

    res.status(201).json({
      id: memberId,
      email: email.toLowerCase().trim(),
      role: 'member',
      status: 'invited',
      invited_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Account] Invite error:', err);
    res.status(500).json({ error: 'Failed to invite team member' });
  }
});

// DELETE /api/account/team/:id — remove a team member
router.delete('/team/:id', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const db = getDb();
    const member = db.prepare('SELECT * FROM team_members WHERE id = ? AND account_id = ?')
      .get(req.params.id, user.id) as any;

    if (!member) return res.status(404).json({ error: 'Team member not found' });

    db.prepare('DELETE FROM team_members WHERE id = ? AND account_id = ?')
      .run(req.params.id, user.id);

    res.json({ success: true });
  } catch (err) {
    console.error('[Account] Remove member error:', err);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

// ── White-Label Settings ─────────────────────────────────────────

// GET /api/account/whitelabel — get white-label settings
router.get('/whitelabel', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const db = getDb();
    const settings = db.prepare('SELECT * FROM whitelabel_settings WHERE user_id = ?').get(user.id) as any;

    if (!settings) {
      return res.json({
        enabled: false,
        companyName: '',
        logoUrl: '',
        primaryColor: '#1A9EF2',
        secondaryColor: '#4551D3',
      });
    }

    res.json({
      enabled: settings.enabled === 1,
      companyName: settings.company_name || '',
      logoUrl: settings.logo_url || '',
      primaryColor: settings.primary_color || '#1A9EF2',
      secondaryColor: settings.secondary_color || '#4551D3',
    });
  } catch (err) {
    console.error('[Account] Whitelabel get error:', err);
    res.status(500).json({ error: 'Failed to get white-label settings' });
  }
});

// PUT /api/account/whitelabel — update white-label settings
router.put('/whitelabel', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const db = getDb();
    const userRec = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(user.id) as any;
    if (userRec?.subscription_tier !== 'AGENCY') {
      return res.status(402).json({ error: 'White-labeling requires the Agency plan.' });
    }

    const { enabled, companyName, logoUrl, primaryColor, secondaryColor } = req.body;

    const existing = db.prepare('SELECT user_id FROM whitelabel_settings WHERE user_id = ?').get(user.id);
    if (existing) {
      db.prepare(`
        UPDATE whitelabel_settings
        SET enabled = ?, company_name = ?, logo_url = ?, primary_color = ?, secondary_color = ?, updated_at = datetime('now')
        WHERE user_id = ?
      `).run(
        enabled ? 1 : 0,
        companyName || null,
        logoUrl || null,
        primaryColor || '#1A9EF2',
        secondaryColor || '#4551D3',
        user.id
      );
    } else {
      db.prepare(`
        INSERT INTO whitelabel_settings (user_id, enabled, company_name, logo_url, primary_color, secondary_color)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        user.id,
        enabled ? 1 : 0,
        companyName || null,
        logoUrl || null,
        primaryColor || '#1A9EF2',
        secondaryColor || '#4551D3'
      );
    }

    res.json({
      enabled: !!enabled,
      companyName: companyName || '',
      logoUrl: logoUrl || '',
      primaryColor: primaryColor || '#1A9EF2',
      secondaryColor: secondaryColor || '#4551D3',
    });
  } catch (err) {
    console.error('[Account] Whitelabel update error:', err);
    res.status(500).json({ error: 'Failed to update white-label settings' });
  }
});

// ── Blueprint White-Label (separate from Audit) ────────────────

// GET /api/account/blueprint-whitelabel
router.get('/blueprint-whitelabel', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const db = getDb();
    const settings = db.prepare('SELECT * FROM blueprint_whitelabel WHERE user_id = ?').get(user.id) as any;
    if (!settings) return res.json({ enabled: false, companyName: '', logoUrl: '', primaryColor: '#1A9EF2', secondaryColor: '#4551D3' });
    res.json({
      enabled: settings.enabled === 1, companyName: settings.company_name || '', logoUrl: settings.logo_url || '',
      primaryColor: settings.primary_color || '#1A9EF2', secondaryColor: settings.secondary_color || '#4551D3',
    });
  } catch (err) { res.status(500).json({ error: 'Failed to get settings' }); }
});

// PUT /api/account/blueprint-whitelabel
router.put('/blueprint-whitelabel', (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const db = getDb();
    const userRec = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(user.id) as any;
    if (userRec?.subscription_tier !== 'AGENCY') return res.status(402).json({ error: 'Requires Agency plan' });

    const { enabled, companyName, logoUrl, primaryColor, secondaryColor } = req.body;
    const existing = db.prepare('SELECT user_id FROM blueprint_whitelabel WHERE user_id = ?').get(user.id);
    if (existing) {
      db.prepare(`UPDATE blueprint_whitelabel SET enabled=?, company_name=?, logo_url=?, primary_color=?, secondary_color=?, updated_at=datetime('now') WHERE user_id=?`)
        .run(enabled ? 1 : 0, companyName || null, logoUrl || null, primaryColor || '#1A9EF2', secondaryColor || '#4551D3', user.id);
    } else {
      db.prepare('INSERT INTO blueprint_whitelabel (user_id, enabled, company_name, logo_url, primary_color, secondary_color) VALUES (?,?,?,?,?,?)')
        .run(user.id, enabled ? 1 : 0, companyName || null, logoUrl || null, primaryColor || '#1A9EF2', secondaryColor || '#4551D3');
    }
    res.json({ enabled: !!enabled, companyName: companyName || '', logoUrl: logoUrl || '', primaryColor: primaryColor || '#1A9EF2', secondaryColor: secondaryColor || '#4551D3' });
  } catch (err) { res.status(500).json({ error: 'Failed to update settings' }); }
});

export default router;
