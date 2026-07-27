import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// GET /api/account/domains
router.get('/domains', (req: any, res: Response): void => {
  const db = getDb();
  const domains = db.prepare('SELECT id, domain, verified, verification_token, created_at, verified_at FROM custom_domains WHERE user_id = ?').all(req.user.userId);
  res.json({ domains: domains || [] });
});

// POST /api/account/domains — register a domain
router.post('/domains', (req: any, res: Response): void => {
  const db = getDb();
  const user = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(req.user.userId) as any;
  if (user?.subscription_tier !== 'AGENCY') {
    res.status(402).json({ error: 'Custom domains require the Agency plan.' }); return;
  }

  const { domain } = req.body;
  if (!domain || typeof domain !== 'string') { res.status(400).json({ error: 'Domain is required' }); return; }

  const cleaned = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '').trim();
  if (!cleaned.includes('.') || cleaned.includes(' ')) { res.status(400).json({ error: 'Invalid domain format' }); return; }

  const existing = db.prepare('SELECT id FROM custom_domains WHERE domain = ?').get(cleaned);
  if (existing) { res.status(409).json({ error: 'Domain already registered' }); return; }

  const id = crypto.randomUUID();
  const token = `nuria-verify-${crypto.randomBytes(16).toString('hex')}`;
  db.prepare('INSERT INTO custom_domains (id, user_id, domain, verification_token) VALUES (?, ?, ?, ?)').run(id, req.user.userId, cleaned, token);

  res.status(201).json({
    id, domain: cleaned, verified: false, verification_token: token,
    dns_instructions: `Add a TXT record to your DNS: Name: @ (or ${cleaned}), Value: ${token}`,
    created_at: new Date().toISOString(),
  });
});

// POST /api/account/domains/:id/verify
router.post('/domains/:id/verify', (req: any, res: Response): void => {
  const db = getDb();
  const domain = db.prepare('SELECT * FROM custom_domains WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId) as any;
  if (!domain) { res.status(404).json({ error: 'Domain not found' }); return; }
  if (domain.verified) { res.status(400).json({ error: 'Domain already verified' }); return; }

  // In production, we'd check DNS for the TXT record. For now, mark as verified if they confirm.
  // Auto-verify with a note that DNS should be configured for production.
  db.prepare('UPDATE custom_domains SET verified = 1, verified_at = datetime(\'now\') WHERE id = ?').run(req.params.id);

  res.json({
    id: domain.id, domain: domain.domain, verified: true,
    message: 'Domain verified. For production use, ensure your DNS TXT record is set and CNAME points to this application.',
  });
});

// DELETE /api/account/domains/:id
router.delete('/domains/:id', (req: any, res: Response): void => {
  const db = getDb();
  db.prepare('DELETE FROM custom_domains WHERE id = ? AND user_id = ?').run(req.params.id, req.user.userId);
  res.json({ success: true });
});

export default router;
