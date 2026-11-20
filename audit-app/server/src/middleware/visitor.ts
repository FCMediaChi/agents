import crypto from 'crypto';
import type { Response, NextFunction } from 'express';
import { isProd } from '../config.js';
import type { AuthenticatedRequest } from '../types.js';

// ── Anonymous visitor identity ─────────────────────────────────
// The free audit is a no-signup door, so an unauthenticated caller still needs
// a stable identity to key `audit_usage` on. Before this existed every
// unauthenticated caller shared the literal key 'anonymous', so the first
// visitor anywhere in the world spent the one free audit for everybody and
// every later visitor got "Free tier limited to 1 audit".
//
// Identity is an httpOnly cookie holding a random 128-bit id, minted on the
// first request. A client that never sends the cookie back (cookies refused)
// falls back to a hashed-IP key, which still buys exactly one free audit. The
// IP rate limit in middleware/abuseProtection.ts remains the separate abuse
// guard and is unchanged.
const VISITOR_COOKIE = 'audit_visitor';
const VISITOR_ID_RE = /^[0-9a-f]{32}$/;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function isVisitorId(value: unknown): value is string {
  return typeof value === 'string' && VISITOR_ID_RE.test(value);
}

/** Stable fallback identity for clients that refuse cookies: hash of the IP. */
export function ipVisitorId(ip: string): string {
  return crypto.createHash('sha256').update(`audit-ip:${ip}`).digest('hex').slice(0, 32);
}

function requestIp(req: AuthenticatedRequest): string {
  return req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown';
}

/**
 * Resolve (and if needed mint) the caller's visitor id on `req.visitorId`.
 * Signed-in callers keep their account id, so this is a no-op for them.
 *
 * When no visitor cookie comes back, the hashed-IP key is also attached as
 * `req.visitorFallbackId`, so a run started without the cookie is counted
 * against both keys: the client's cookie id (if it accepts the cookie) and the
 * IP fallback (if it never does). That closes the hole where refusing cookies
 * bought an unlimited number of free audits.
 */
export function anonymousVisitor(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (req.user) {
    next();
    return;
  }

  const existing = req.cookies?.[VISITOR_COOKIE];
  if (isVisitorId(existing)) {
    req.visitorId = existing;
    next();
    return;
  }

  const visitorId = crypto.randomBytes(16).toString('hex');
  req.visitorId = visitorId;
  req.visitorFallbackId = ipVisitorId(requestIp(req));
  res.cookie(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: ONE_YEAR_MS,
  });
  next();
}

/** Every key this request's audit usage may be recorded under. First = primary. */
export function usageKeys(req: AuthenticatedRequest): string[] {
  const primary = req.user?.userId ?? req.visitorId ?? ipVisitorId(requestIp(req));
  return req.visitorFallbackId && !req.user ? [primary, req.visitorFallbackId] : [primary];
}
