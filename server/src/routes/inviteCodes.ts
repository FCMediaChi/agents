import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import { config } from '../config.js';

const router = Router();

const VALID_TIERS = ['FREE', 'SOLO', 'TEAM', 'AGENCY'] as const;

/**
 * Generate a single invite code in the format NURIA-XXXX-XXXX-XXXX
 * where each X is an uppercase hex character.
 */
function generateCode(): string {
  const bytes = crypto.randomBytes(6);
  const hex = bytes.toString('hex').toUpperCase();
  return `NURIA-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

/** Check x-admin-key header against the JWT secret */
function requireAdmin(req: Request, res: Response): boolean {
  const adminKey = req.headers['x-admin-key'] as string | undefined;
  if (!adminKey || adminKey !== config.jwtSecret) {
    res.status(403).json({ error: 'Forbidden: invalid or missing x-admin-key header' });
    return false;
  }
  return true;
}

// POST /api/invite-codes — Generate one or more invite codes
router.post('/', (req: Request, res: Response): void => {
  if (!requireAdmin(req, res)) return;

  const { tier, count = 1, max_uses = 1 } = req.body as {
    tier?: string;
    count?: number;
    max_uses?: number;
  };

  if (!tier || !VALID_TIERS.includes(tier as any)) {
    res.status(400).json({ error: `Invalid tier. Must be one of: ${VALID_TIERS.join(', ')}` });
    return;
  }

  const countNum = Math.max(1, Math.min(100, Number(count) || 1));
  const maxUses = Math.max(1, Math.min(1000, Number(max_uses) || 1));

  const db = getDb();
  const codes: string[] = [];

  for (let i = 0; i < countNum; i++) {
    const id = uuidv4();
    const code = generateCode();
    db.prepare(
      'INSERT INTO invite_codes (id, code, tier, max_uses) VALUES (?, ?, ?, ?)'
    ).run(id, code, tier.toUpperCase(), maxUses);
    codes.push(code);
  }

  res.status(201).json({ codes, tier: tier.toUpperCase(), max_uses: maxUses });
});

// GET /api/invite-codes — List all invite codes with usage stats
router.get('/', (req: Request, res: Response): void => {
  if (!requireAdmin(req, res)) return;

  const db = getDb();
  const codes = db.prepare(
    'SELECT id, code, tier, created_at, max_uses, uses, is_active FROM invite_codes ORDER BY created_at DESC'
  ).all();

  res.json({ codes });
});

export default router;
