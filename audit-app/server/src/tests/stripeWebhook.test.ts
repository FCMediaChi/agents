// audit-app/server/src/tests/stripeWebhook.test.ts
//
// Unit tests for the Audit app's Stripe webhook grant/revoke/credit logic
// (split Phase 4), mirroring pipeline-app/server/src/tests/stripeWebhook.test.ts
// and blueprint-app/server/src/tests/stripeWebhook.test.ts.
//
// These drive `handleStripeEvent()` / `processStripeEvent()` with synthetic
// Stripe events against a real (temporary, throwaway) SQLite database — no
// network, no Stripe account, no public URL needed. The temp DB is seeded with
// the PRE-Phase-4 schema on purpose, so the stripe_customer_id /
// stripe_subscription_id / paid_audits migrations and the
// stripe_webhook_events ledger are exercised end-to-end.
//
// Run with: npm run test:webhook
//
// Note: LIVE webhook delivery from Stripe can only be confirmed once the app has
// a public URL (post-cutover), at which point STRIPE_WEBHOOK_SECRET is set in the
// deployment environment and the endpoint is registered in the dashboard.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import initSqlJs from 'sql.js';
import type Stripe from 'stripe';

const tmpDbPath = path.join(os.tmpdir(), `audit-webhook-test-${crypto.randomUUID()}.sqlite`);
process.env.AUDIT_DB_PATH = tmpDbPath;

// Seed the temp DB with a pre-Phase-4 users/audit_usage schema (no Stripe
// columns, no paid_audits, no event ledger) so initDb() must migrate it.
{
  const SQL = await initSqlJs();
  const legacy = new SQL.Database();
  legacy.run(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      subscription_tier TEXT NOT NULL DEFAULT 'FREE',
      password_reset_token TEXT,
      password_reset_expires_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  legacy.run(`
    CREATE TABLE audit_usage (
      user_id TEXT PRIMARY KEY,
      audits_run INTEGER NOT NULL DEFAULT 0,
      last_audit_at TEXT
    )
  `);
  fs.writeFileSync(tmpDbPath, Buffer.from(legacy.export()));
  legacy.close();
}

const { initDb, getDb, closeDb } = await import('../db.js');
const { handleStripeEvent, processStripeEvent, sessionPriceId, sessionEmail } = await import(
  '../routes/webhooks.js'
);
const { PRICE_TO_TIER, SINGLE_USE_PRICE_ID, KNOWN_PRICE_IDS } = await import('../stripePricing.js');
const { checkAuditLimit, consumePaidAudit, getPaidAudits } = await import('../routes/audit.js');
const StripeLib = (await import('stripe')).default;

// --- tiny async test harness ------------------------------------------------
let passed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failures.push(name);
    console.error(`  ✗ ${name}\n    ${err?.message ?? err}`);
  }
}

// --- fixtures ---------------------------------------------------------------
const SINGLE = 'price_1UMFmGDHbZkO7vsGyuNy7vVD'; // Single Use, $29 one-time
const TEAM_MONTHLY = 'price_1UMFmHDHbZkO7vsGpaVQn8ya';
const TEAM_YEARLY = 'price_1UMFmHDHbZkO7vsGXU6dF8gO';
const AGENCY_MONTHLY = 'price_1UMFmHDHbZkO7vsGhoLAc7JP';
const AGENCY_YEARLY = 'price_1UMFmHDHbZkO7vsGc3QI8wsV';
const BLUEPRINT_PRICE = 'price_1UMFmGDHbZkO7vsGWsgShwYP';
const PIPELINE_PRICE = 'price_1UMFmHDHbZkO7vsGLYd7xr1g';
const UNKNOWN_PRICE = 'price_NOT_AN_AUDIT_PRICE';
const USER_ID = 'user_test_0001';
const USER_EMAIL = 'Webhook-Test@Example.com';

function evt(type: string, object: Record<string, any>, id = `evt_${crypto.randomUUID()}`): Stripe.Event {
  return {
    id,
    object: 'event',
    api_version: '2024-06-20',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type,
    data: { object },
  } as unknown as Stripe.Event;
}

function checkoutCompleted(
  opts: {
    clientReferenceId?: string | null;
    priceId?: string | null;
    metadataPriceId?: string;
    customer?: string | null;
    subscription?: string | null;
    email?: string | null;
    mode?: 'payment' | 'subscription';
    includeLineItems?: boolean;
    eventId?: string;
  } = {}
): Stripe.Event {
  const {
    clientReferenceId = USER_ID,
    priceId = TEAM_MONTHLY,
    metadataPriceId,
    customer = 'cus_test_1',
    subscription = 'sub_test_1',
    email = USER_EMAIL,
    mode = 'subscription',
    includeLineItems = true,
    eventId,
  } = opts;

  const object: Record<string, any> = {
    id: `cs_test_${crypto.randomUUID()}`,
    object: 'checkout.session',
    mode,
    client_reference_id: clientReferenceId,
    customer,
    subscription,
    customer_details: email ? { email } : {},
    metadata: metadataPriceId ? { price_id: metadataPriceId } : {},
  };
  if (includeLineItems && priceId) {
    object.line_items = { object: 'list', data: [{ id: 'li_1', price: { id: priceId } }] };
  }
  return evt('checkout.session.completed', object, eventId);
}

function subscriptionEvent(type: string, status: string, subId = 'sub_test_1', customerId = 'cus_test_1'): Stripe.Event {
  return evt(type, { id: subId, object: 'subscription', status, customer: customerId });
}

function userColumns(): string[] {
  return (getDb().prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name);
}

function usageColumns(): string[] {
  return (getDb().prepare('PRAGMA table_info(audit_usage)').all() as { name: string }[]).map((c) => c.name);
}

function userRow(): { subscription_tier: string; stripe_customer_id: string | null; stripe_subscription_id: string | null } {
  return getDb()
    .prepare('SELECT subscription_tier, stripe_customer_id, stripe_subscription_id FROM users WHERE id = ?')
    .get(USER_ID);
}

function resetUser(): void {
  getDb()
    .prepare(
      'UPDATE users SET subscription_tier = ?, stripe_customer_id = NULL, stripe_subscription_id = NULL WHERE id = ?'
    )
    .run('FREE', USER_ID);
  getDb().prepare('UPDATE audit_usage SET audits_run = 0, paid_audits = 0 WHERE user_id = ?').run(USER_ID);
}

// --- run --------------------------------------------------------------------
await initDb();

console.log('\nMigrations');

await test('legacy users table gains stripe_customer_id + stripe_subscription_id', () => {
  const cols = userColumns();
  assert.ok(cols.includes('stripe_customer_id'), 'stripe_customer_id column missing');
  assert.ok(cols.includes('stripe_subscription_id'), 'stripe_subscription_id column missing');
});

await test('legacy audit_usage table gains paid_audits', () => {
  assert.ok(usageColumns().includes('paid_audits'), 'paid_audits column missing');
});

await test('stripe_webhook_events ledger table exists', () => {
  const row = getDb()
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'stripe_webhook_events'")
    .get() as { name: string } | undefined;
  assert.ok(row, 'stripe_webhook_events table missing');
});

await test('re-running initDb() is a no-op (idempotent migrations)', async () => {
  await initDb();
  const cols = userColumns();
  assert.equal(cols.filter((c) => c === 'stripe_customer_id').length, 1);
  assert.equal(cols.filter((c) => c === 'stripe_subscription_id').length, 1);
  assert.equal(usageColumns().filter((c) => c === 'paid_audits').length, 1);
});

// Seed the test user AFTER the migration tests: initDb() re-reads the DB file
// from disk, so anything held only in memory would be discarded by that call.
// The email is deliberately mixed-case, like a user who typed it with capitals.
getDb()
  .prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)')
  .run(USER_ID, USER_EMAIL, 'x');

console.log('\nGrant logic — recurring subscriptions (checkout.session.completed)');

const grants: [string, string, string][] = [
  ['Team Monthly', TEAM_MONTHLY, 'TEAM'],
  ['Team Yearly', TEAM_YEARLY, 'TEAM'],
  ['Agency Monthly', AGENCY_MONTHLY, 'AGENCY'],
  ['Agency Yearly', AGENCY_YEARLY, 'AGENCY'],
];

for (const [label, priceId, expectedTier] of grants) {
  await test(`${label} (${priceId}) → grants ${expectedTier}`, () => {
    resetUser();
    const outcome = handleStripeEvent(checkoutCompleted({ priceId }));
    assert.equal(outcome.action, 'granted');
    assert.equal(outcome.tier, expectedTier);
    const row = userRow();
    assert.equal(row.subscription_tier, expectedTier);
    assert.equal(row.stripe_customer_id, 'cus_test_1');
    assert.equal(row.stripe_subscription_id, 'sub_test_1');
  });
}

await test('PRICE_TO_TIER contains exactly the four Audit subscription prices', () => {
  assert.deepEqual(
    Object.keys(PRICE_TO_TIER).sort(),
    [TEAM_MONTHLY, TEAM_YEARLY, AGENCY_MONTHLY, AGENCY_YEARLY].sort()
  );
});

await test('KNOWN_PRICE_IDS = 4 recurring + the one-time Single Use price', () => {
  assert.deepEqual(
    [...KNOWN_PRICE_IDS].sort(),
    [SINGLE, TEAM_MONTHLY, TEAM_YEARLY, AGENCY_MONTHLY, AGENCY_YEARLY].sort()
  );
});

await test('falls back to metadata.price_id when line_items are absent', () => {
  resetUser();
  const outcome = handleStripeEvent(
    checkoutCompleted({ includeLineItems: false, priceId: null, metadataPriceId: AGENCY_YEARLY })
  );
  assert.equal(outcome.action, 'granted');
  assert.equal(outcome.tier, 'AGENCY');
});

await test('tier is derived from the price paid, never from client_reference_id', () => {
  resetUser();
  // A user-supplied reference id can never escalate the tier: Team price → TEAM.
  const outcome = handleStripeEvent(checkoutCompleted({ clientReferenceId: USER_ID, priceId: TEAM_MONTHLY }));
  assert.equal(outcome.tier, 'TEAM');
});

await test('Blueprint / Pipeline price ids never grant Audit access', () => {
  resetUser();
  for (const priceId of [BLUEPRINT_PRICE, PIPELINE_PRICE]) {
    const outcome = handleStripeEvent(checkoutCompleted({ priceId }));
    assert.equal(outcome.action, 'skipped');
    assert.equal(outcome.reason, 'unknown_price');
    assert.equal(userRow().subscription_tier, 'FREE');
  }
});

console.log('\nUser matching (anonymous-first app)');

await test('matches the buyer by email when client_reference_id is absent', () => {
  resetUser();
  const outcome = handleStripeEvent(
    checkoutCompleted({ clientReferenceId: null, email: 'webhook-test@example.com', priceId: TEAM_MONTHLY })
  );
  assert.equal(outcome.action, 'granted');
  assert.equal(outcome.matchedBy, 'email');
  assert.equal(userRow().subscription_tier, 'TEAM');
});

await test('email match is case-insensitive', () => {
  resetUser();
  const outcome = handleStripeEvent(
    checkoutCompleted({ clientReferenceId: null, email: 'WEBHOOK-TEST@EXAMPLE.COM', priceId: AGENCY_MONTHLY })
  );
  assert.equal(outcome.action, 'granted');
  assert.equal(userRow().subscription_tier, 'AGENCY');
});

await test('client_reference_id wins over the email on the session', () => {
  resetUser();
  const outcome = handleStripeEvent(
    checkoutCompleted({ clientReferenceId: USER_ID, email: 'someone-else@example.com', priceId: TEAM_YEARLY })
  );
  assert.equal(outcome.action, 'granted');
  assert.equal(outcome.matchedBy, 'client_reference_id');
});

await test('no matching account → skipped, 200-safe, nothing written', () => {
  resetUser();
  const outcome = handleStripeEvent(
    checkoutCompleted({ clientReferenceId: 'user_does_not_exist', email: 'nobody@example.com', priceId: TEAM_MONTHLY })
  );
  assert.equal(outcome.action, 'skipped');
  assert.equal(outcome.reason, 'unknown_user');
  assert.equal(userRow().subscription_tier, 'FREE');
});

await test('anonymous purchase with no email → skipped, no throw', () => {
  resetUser();
  const outcome = handleStripeEvent(checkoutCompleted({ clientReferenceId: null, email: null, priceId: TEAM_MONTHLY }));
  assert.equal(outcome.action, 'skipped');
  assert.equal(outcome.reason, 'no_matching_user');
});

console.log('\nOne-time Single Use ($29, mode payment)');

await test('Single Use grants 1 paid audit credit, not a tier', () => {
  resetUser();
  const outcome = handleStripeEvent(
    checkoutCompleted({ priceId: SINGLE, mode: 'payment', subscription: null, customer: 'cus_single_1' })
  );
  assert.equal(outcome.action, 'credited');
  assert.equal(outcome.credits, 1);
  assert.equal(getPaidAudits(USER_ID), 1);
  const row = userRow();
  // No permanent tier and no subscription bookkeeping for a one-time purchase.
  assert.equal(row.subscription_tier, 'FREE');
  assert.equal(row.stripe_subscription_id, null);
  assert.equal(row.stripe_customer_id, null);
});

await test('a second Single Use purchase stacks credits', () => {
  resetUser();
  handleStripeEvent(checkoutCompleted({ priceId: SINGLE, mode: 'payment', subscription: null }));
  handleStripeEvent(checkoutCompleted({ priceId: SINGLE, mode: 'payment', subscription: null }));
  assert.equal(getPaidAudits(USER_ID), 2);
});

await test('Single Use works for an email-matched buyer too', () => {
  resetUser();
  const outcome = handleStripeEvent(
    checkoutCompleted({ clientReferenceId: null, email: USER_EMAIL, priceId: SINGLE, mode: 'payment', subscription: null })
  );
  assert.equal(outcome.action, 'credited');
  assert.equal(outcome.matchedBy, 'email');
  assert.equal(getPaidAudits(USER_ID), 1);
});

await test('Single Use with no matching account → skipped, no credit anywhere', () => {
  resetUser();
  const outcome = handleStripeEvent(
    checkoutCompleted({ clientReferenceId: null, email: 'nobody@example.com', priceId: SINGLE, mode: 'payment' })
  );
  assert.equal(outcome.action, 'skipped');
  assert.equal(getPaidAudits(USER_ID), 0);
});

await test('redelivered Single Use event does not grant a second credit', () => {
  resetUser();
  const event = checkoutCompleted({ priceId: SINGLE, mode: 'payment', subscription: null, eventId: 'evt_fixed_single_1' });
  const first = processStripeEvent(event);
  assert.equal(first.action, 'credited');
  assert.equal(getPaidAudits(USER_ID), 1);

  // Stripe redelivers the exact same event id.
  const second = processStripeEvent(event);
  assert.equal(second.action, 'skipped');
  assert.equal(second.reason, 'duplicate_event');
  assert.equal(getPaidAudits(USER_ID), 1);
});

await test('redelivered recurring grant is a no-op but still idempotent-safe', () => {
  resetUser();
  const event = checkoutCompleted({ priceId: TEAM_MONTHLY, eventId: 'evt_fixed_team_1' });
  assert.equal(processStripeEvent(event).action, 'granted');
  const again = processStripeEvent(event);
  assert.equal(again.action, 'skipped');
  assert.equal(again.reason, 'duplicate_event');
  assert.equal(userRow().subscription_tier, 'TEAM');
});

console.log('\nCredit consumption (routes/audit.ts)');

await test('free user with a spent free audit but a credit → allowed as tier "single"', () => {
  resetUser();
  handleStripeEvent(checkoutCompleted({ priceId: SINGLE, mode: 'payment', subscription: null }));
  getDb().prepare('UPDATE audit_usage SET audits_run = 1 WHERE user_id = ?').run(USER_ID);

  const ent = checkAuditLimit(USER_ID);
  assert.equal(ent.allowed, true);
  assert.equal(ent.tier, 'single'); // engine treats anything but 'free' as premium
  assert.equal(ent.usedCredit, true);
});

await test('free user with no credit and a spent free audit → blocked', () => {
  resetUser();
  getDb().prepare('UPDATE audit_usage SET audits_run = 1 WHERE user_id = ?').run(USER_ID);
  const ent = checkAuditLimit(USER_ID);
  assert.equal(ent.allowed, false);
  assert.equal(ent.tier, 'free');
});

await test('paid tier user → allowed, unlimited, no credit needed', () => {
  resetUser();
  getDb().prepare("UPDATE users SET subscription_tier = 'TEAM' WHERE id = ?").run(USER_ID);
  getDb().prepare('UPDATE audit_usage SET audits_run = 5 WHERE user_id = ?').run(USER_ID);
  const ent = checkAuditLimit(USER_ID);
  assert.equal(ent.allowed, true);
  assert.equal(ent.tier, 'team');
  assert.equal(ent.usedCredit, false);
});

await test('consumePaidAudit decrements and stops at zero', () => {
  resetUser();
  handleStripeEvent(checkoutCompleted({ priceId: SINGLE, mode: 'payment', subscription: null }));
  assert.equal(consumePaidAudit(USER_ID), true);
  assert.equal(getPaidAudits(USER_ID), 0);
  assert.equal(consumePaidAudit(USER_ID), false);
  assert.equal(getPaidAudits(USER_ID), 0);
});

await test('anonymous callers never get credits', () => {
  assert.equal(getPaidAudits('anonymous'), 0);
  assert.equal(consumePaidAudit('anonymous'), false);
  const ent = checkAuditLimit('anonymous');
  assert.equal(ent.allowed, true); // first anonymous audit still runs (no auth required)
  assert.equal(ent.tier, 'free');
});

console.log('\nRevoke logic');

await test('customer.subscription.deleted → revokes to FREE', () => {
  resetUser();
  handleStripeEvent(checkoutCompleted({ priceId: TEAM_MONTHLY }));
  assert.equal(userRow().subscription_tier, 'TEAM');

  const outcome = handleStripeEvent(subscriptionEvent('customer.subscription.deleted', 'canceled'));
  assert.equal(outcome.action, 'revoked');
  const row = userRow();
  assert.equal(row.subscription_tier, 'FREE');
  assert.equal(row.stripe_subscription_id, null);
});

await test('revocation is idempotent (repeat event is a no-op, stays FREE)', () => {
  resetUser();
  handleStripeEvent(checkoutCompleted({ priceId: TEAM_MONTHLY }));
  handleStripeEvent(subscriptionEvent('customer.subscription.deleted', 'canceled'));
  const again = handleStripeEvent(subscriptionEvent('customer.subscription.deleted', 'canceled'));
  assert.equal(again.action, 'skipped');
  assert.equal(again.reason, 'already_revoked');
  assert.equal(userRow().subscription_tier, 'FREE');
});

await test('customer.subscription.updated (unpaid) → revokes to FREE', () => {
  resetUser();
  handleStripeEvent(checkoutCompleted({ priceId: AGENCY_YEARLY }));
  const outcome = handleStripeEvent(subscriptionEvent('customer.subscription.updated', 'unpaid'));
  assert.equal(outcome.action, 'revoked');
  assert.equal(userRow().subscription_tier, 'FREE');
});

await test('customer.subscription.updated (canceled) → revokes to FREE', () => {
  resetUser();
  handleStripeEvent(checkoutCompleted({ priceId: AGENCY_MONTHLY }));
  const outcome = handleStripeEvent(subscriptionEvent('customer.subscription.updated', 'canceled'));
  assert.equal(outcome.action, 'revoked');
  assert.equal(userRow().subscription_tier, 'FREE');
});

await test('customer.subscription.updated (active) → entitlement intact', () => {
  resetUser();
  handleStripeEvent(checkoutCompleted({ priceId: TEAM_MONTHLY }));
  const outcome = handleStripeEvent(subscriptionEvent('customer.subscription.updated', 'active'));
  assert.equal(outcome.action, 'ignored');
  assert.equal(userRow().subscription_tier, 'TEAM');
});

await test('cancel for an unknown subscription → skipped, no throw', () => {
  const outcome = handleStripeEvent(subscriptionEvent('customer.subscription.deleted', 'canceled', 'sub_unknown', 'cus_unknown'));
  assert.equal(outcome.action, 'skipped');
  assert.equal(outcome.reason, 'no_matching_user');
});

await test('unrelated event type → ignored', () => {
  const outcome = handleStripeEvent(evt('invoice.created', { id: 'in_1', object: 'invoice' }));
  assert.equal(outcome.action, 'ignored');
});

console.log('\nSignature verification (static helper, no API key)');

await test('a valid stripe-signature header verifies against the raw body', () => {
  const secret = 'whsec_test_secret_for_unit_tests';
  const event = checkoutCompleted({ priceId: TEAM_MONTHLY });
  const payload = JSON.stringify(event);
  const header = StripeLib.webhooks.generateTestHeaderString({ payload, secret });

  const verified = StripeLib.webhooks.constructEvent(Buffer.from(payload), header, secret);
  assert.equal(verified.id, (event as any).id);
  assert.equal(verified.type, 'checkout.session.completed');
});

await test('a body tampered with after signing fails verification', () => {
  const secret = 'whsec_test_secret_for_unit_tests';
  const payload = JSON.stringify(checkoutCompleted({ priceId: TEAM_MONTHLY }));
  const header = StripeLib.webhooks.generateTestHeaderString({ payload, secret });
  const tampered = Buffer.from(payload.replace(TEAM_MONTHLY, AGENCY_YEARLY));
  assert.throws(() => StripeLib.webhooks.constructEvent(tampered, header, secret));
});

await test('the wrong signing secret fails verification', () => {
  const payload = JSON.stringify(checkoutCompleted({ priceId: TEAM_MONTHLY }));
  const header = StripeLib.webhooks.generateTestHeaderString({ payload, secret: 'whsec_right' });
  assert.throws(() => StripeLib.webhooks.constructEvent(Buffer.from(payload), header, 'whsec_wrong'));
});

console.log('\nHelpers');

await test('sessionPriceId prefers line_items over metadata', () => {
  const session = checkoutCompleted({ priceId: TEAM_MONTHLY, metadataPriceId: AGENCY_YEARLY });
  assert.equal(sessionPriceId(session.data.object as any), TEAM_MONTHLY);
});

await test('sessionEmail lowercases and falls back to customer_email', () => {
  assert.equal(sessionEmail({ customer_details: { email: ' BUYER@Example.COM ' } } as any), 'buyer@example.com');
  assert.equal(sessionEmail({ customer_email: 'Other@Example.com' } as any), 'other@example.com');
  assert.equal(sessionEmail({} as any), null);
});

// --- teardown ---------------------------------------------------------------
closeDb();
try {
  fs.rmSync(tmpDbPath, { force: true });
} catch {
  /* best effort */
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.error('Failing tests:', failures.join('; '));
  process.exit(1);
}
