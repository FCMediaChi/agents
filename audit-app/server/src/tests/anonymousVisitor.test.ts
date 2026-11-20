// Anonymous free-audit identity test.
//
// The no-signup audit door used to key `audit_usage` on the literal string
// 'anonymous', so the first visitor anywhere spent the single free audit for
// the whole internet and every later visitor got 402 "Free tier limited to 1
// audit". This proves the fix: two distinct anonymous visitors each get their
// first audit allowed and their second refused, keyed on their own httpOnly
// visitor cookie rather than a shared row — plus the hashed-IP fallback for a
// client that never sends the cookie back.
//
// Run with: npm run test:visitor

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dbPath = path.join(os.tmpdir(), `audit-visitor-test-${process.pid}.sqlite`);
process.env.AUDIT_DB_PATH = dbPath;
process.env.NODE_ENV = 'test';
try { fs.rmSync(dbPath, { force: true }); } catch { /* fresh */ }

const express = (await import('express')).default;
const cookieParser = (await import('cookie-parser')).default;
const { initDb, getDb, closeDb } = await import('../db.js');
const { resetAbuseProtectionState } = await import('../middleware/abuseProtection.js');
const auditRoutes = (await import('../routes/audit.js')).default;

await initDb();

const app = express();
// Trust X-Forwarded-For so each simulated visitor presents its own address, as
// real deployments do behind their proxy.
app.set('trust proxy', true);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use('/api/audit', auditRoutes);

const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const port = (server.address() as { port: number }).port;

const HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Nuria AI — Website planning, audit and QA tools for small teams</title>
    <meta name="description" content="Plan a website in minutes: sitemaps, page outlines, content questionnaires and wireframes." />
  </head>
  <body><h1>Plan your next website in minutes</h1><p>A free website audit.</p></body>
</html>`;

interface AuditResponse {
  status: number;
  body: { report_id?: string; error?: string };
  setCookie: string | null;
}

async function submitAudit(ip: string, cookie?: string): Promise<AuditResponse> {
  const res = await fetch(`http://127.0.0.1:${port}/api/audit/run-html`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ url: 'https://example.com', html: HTML }),
  });
  return {
    status: res.status,
    body: (await res.json()) as AuditResponse['body'],
    setCookie: res.headers.get('set-cookie'),
  };
}

function visitorIdFrom(setCookie: string | null): string {
  const match = /audit_visitor=([0-9a-f]{32})/.exec(setCookie || '');
  assert.ok(match, `expected an audit_visitor cookie, got: ${setCookie}`);
  return match[1];
}

/** The run is recorded asynchronously once the audit completes — wait for it. */
async function waitForUsage(key: string): Promise<number> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const row = getDb().prepare('SELECT audits_run FROM audit_usage WHERE user_id = ?').get(key) as
      | { audits_run: number }
      | undefined;
    if (row && row.audits_run > 0) return row.audits_run;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`no audit_usage row was written for key ${key}`);
}

// ── Visitor 1 ──────────────────────────────────────────────────
resetAbuseProtectionState();
const first = await submitAudit('203.0.113.10');
assert.equal(first.status, 202, `visitor 1's first audit should be allowed, got ${first.status}: ${first.body.error}`);
const visitorOne = visitorIdFrom(first.setCookie);
assert.match(first.setCookie || '', /HttpOnly/i, 'the visitor cookie must be httpOnly');
assert.notEqual(visitorOne, 'anonymous', 'the visitor must not be keyed on the shared anonymous row');
assert.equal(await waitForUsage(visitorOne), 1);

resetAbuseProtectionState();
const second = await submitAudit('203.0.113.10', `audit_visitor=${visitorOne}`);
assert.equal(second.status, 402, `visitor 1's second audit should be refused, got ${second.status}`);
assert.match(second.body.error || '', /Free tier limited to 1 audit/);

// ── Visitor 2 — a different person, arriving after visitor 1 ────
resetAbuseProtectionState();
const third = await submitAudit('203.0.113.20');
assert.equal(third.status, 202, `visitor 2's first audit should be allowed, got ${third.status}: ${third.body.error}`);
const visitorTwo = visitorIdFrom(third.setCookie);
assert.notEqual(visitorTwo, visitorOne, 'each anonymous visitor needs its own id');
assert.equal(await waitForUsage(visitorTwo), 1);

resetAbuseProtectionState();
const fourth = await submitAudit('203.0.113.20', `audit_visitor=${visitorTwo}`);
assert.equal(fourth.status, 402, `visitor 2's second audit should be refused, got ${fourth.status}`);
assert.match(fourth.body.error || '', /Free tier limited to 1 audit/);

// ── Cookie-refusing client: hashed-IP fallback ─────────────────
resetAbuseProtectionState();
const noCookieOne = await submitAudit('203.0.113.30');
assert.equal(noCookieOne.status, 202, 'a cookie-less first audit should be allowed');
assert.equal(await waitForUsage(visitorIdFrom(noCookieOne.setCookie)), 1);

resetAbuseProtectionState();
const noCookieTwo = await submitAudit('203.0.113.30'); // cookie still not sent back
assert.equal(noCookieTwo.status, 402, 'a cookie-refusing client gets exactly one free audit');
assert.match(noCookieTwo.body.error || '', /Free tier limited to 1 audit/);

// ── The shared 'anonymous' row must never be written again ─────
const legacy = getDb().prepare("SELECT audits_run FROM audit_usage WHERE user_id = 'anonymous'").get() as
  | { audits_run: number }
  | undefined;
assert.equal(legacy, undefined, "no run may be recorded against the shared 'anonymous' key");

server.close();
closeDb();
try { fs.rmSync(dbPath, { force: true }); } catch { /* ignore */ }

console.log('anonymous visitor identity: OK');
