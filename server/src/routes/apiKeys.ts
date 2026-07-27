import { Router, Response } from 'express';
import crypto from 'crypto';
import { getDb } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// GET /api/account/api-keys
router.get('/api-keys', (req: any, res: Response): void => {
  const db = getDb();
  const keys = db.prepare('SELECT id, name, created_at, last_used_at FROM api_keys WHERE user_id = ?').all(req.user.userId);
  res.json({ keys: keys || [] });
});

// POST /api/account/api-keys
router.post('/api-keys', (req: any, res: Response): void => {
  const db = getDb();
  const user = db.prepare('SELECT subscription_tier FROM users WHERE id = ?').get(req.user.userId) as any;

  if (user?.subscription_tier !== 'AGENCY') {
    res.status(402).json({ error: 'API keys require the Agency plan.' });
    return;
  }

  const keyCount = db.prepare('SELECT COUNT(*) as count FROM api_keys WHERE user_id = ?').get(req.user.userId) as any;
  if (keyCount?.count >= 5) {
    res.status(400).json({ error: 'Maximum of 5 API keys per account' });
    return;
  }

  const rawKey = `nuria_${crypto.randomBytes(24).toString('hex')}`;
  const hashed = hashKey(rawKey);

  const id = crypto.randomUUID();
  const name = req.body.name || `Key ${keyCount?.count + 1 || 1}`;

  db.prepare('INSERT INTO api_keys (id, user_id, key_hash, name) VALUES (?, ?, ?, ?)').run(id, req.user.userId, hashed, name);

  res.status(201).json({ id, name, key: rawKey, created_at: new Date().toISOString() });
});

// DELETE /api/account/api-keys/:id
router.delete('/api-keys/:id', (req: any, res: Response): void => {
  const db = getDb();
  db.prepare('DELETE FROM api_keys WHERE id = ? AND user_id = ?').run(req.params.id, req.user.userId);
  res.json({ success: true });
});

export default router;
