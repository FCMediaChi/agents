// Unit test for the per-IP audit rate limit in middleware/abuseProtection.ts.
//
// It is a coarse abuse guard, not a per-person quota: 30 audits per IP per 24h,
// because mobile carriers and office NATs put thousands of real visitors behind
// one address. The per-visitor free audit limit lives elsewhere (audit_usage)
// and is not touched by this test.
//
// Run with: npm run test:ip-rate-limit
import assert from 'node:assert/strict';
import { auditIPRateLimit, resetAbuseProtectionState } from '../middleware/abuseProtection.js';

interface CallResult {
  status?: number;
  body?: { error?: string };
  passed: boolean;
}

function call(ip: string): CallResult {
  const result: CallResult = { passed: false };
  const req = { ip, headers: {}, user: undefined } as never;
  const res = {
    status(code: number) {
      result.status = code;
      return this;
    },
    json(payload: { error?: string }) {
      result.body = payload;
      return this;
    },
  } as never;
  auditIPRateLimit(req, res, () => {
    result.passed = true;
  });
  return result;
}

resetAbuseProtectionState();

// ── 30 audits from one IP are allowed ──────────────────────────────
for (let i = 1; i <= 30; i++) {
  const r = call('203.0.113.7');
  assert.equal(r.passed, true, `audit #${i} from one IP should be allowed, got status ${r.status}`);
}

// ── the 31st is refused ────────────────────────────────────────────
const blocked = call('203.0.113.7');
assert.equal(blocked.passed, false, 'the 31st audit from one IP should be refused');
assert.equal(blocked.status, 429, `expected 429, got ${blocked.status}`);
const message = blocked.body?.error || '';
assert.ok(message.length > 0, 'the 429 must carry an error message');

// The message must not read as the visitor's own quota, and must not quote a
// number that no longer exists.
assert.doesNotMatch(message, /Free tier limited/i, `the 429 must not describe a free-tier quota: "${message}"`);
assert.doesNotMatch(message, /\b3 audits\b/i, `the 429 must not mention the old limit: "${message}"`);
assert.doesNotMatch(message, /upgrade/i, `the 429 must not push an upgrade: "${message}"`);
assert.match(message, /could not be completed from your network/i, `the 429 should say the request could not be completed from their network: "${message}"`);
assert.match(message, /try again later/i, `the 429 should suggest trying again later: "${message}"`);
assert.match(message, /sign in/i, `the 429 should offer signing in: "${message}"`);

// ── a different IP is unaffected ───────────────────────────────────
const other = call('198.51.100.42');
assert.equal(other.passed, true, 'a different IP should still be allowed');

console.log('ip rate limit (30/24h): OK');
