// blueprint-app/server/src/tests/stripeWebhook.test.ts
//
// Unit tests for the Blueprint Stripe webhook grant/revoke logic (split Phase 4).
//
// These drive `handleStripeEvent()` with synthetic Stripe events against a real
// (temporary, throwaway) SQLite database — no network, no Stripe account and no
// public URL needed. The temp DB is seeded with the PRE-Phase-4 `users` schema on
// purpose, so the stripe_customer_id / stripe_subscription_id migrations are
// exercised end-to-end.
//
// Run with: npm run test:webhook
//
// Note: LIVE webhook delivery from Stripe can only be confirmed once the app has
// a public URL (post-cutover), at which point STRIPE_WEBHOOK_SECRET is set in the
// deployment environment and the endpoint is registered in the Stripe dashboard.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import initSqlJs from 'sql.js';
import type Stripe from 'stripe';

const tmpDbPath = path.join(os.tmpdir(), `blueprint-webhook-test-${crypto.randomUUID()}.sqlite`);
process.env.BLUEPRINT_DB_PATH = tmpDbPath;

// Seed the temp DB with a pre-Phase-4 `users` table (no Stripe columns) so
// initDb() has to run the ALTER TABLE migrations.
{
  const SQL = await initSqlJs();
  const legacy = new SQL.Database();
  legacy.run(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      subscription_tier TEXT NOT NULL DEFAULT 'FREE',
      verified INTEGER NOT NULL DEFAULT 0,
      verification_token TEXT,
      reset_token TEXT,
      reset_token_expiry TEXT,
      trial_started_at TEXT,
      trial_ends_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  fs.writeFileSync(tmpDbPath, Buffer.from(legacy.export()));
  legacy.close();
}

const { initDb, getDb, closeDb } = await import('../db.js');
const { handleStripeEvent, sessionPriceId } = await import('../routes/webhooks.js');
const { PRICE_TO_TIER } = await import('../stripePricing.js');

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
const SOLO_MONTHLY = 'price_1UMFmGDHbZkO7vsGWsgShwYP';
const SOLO_YEARLY = 'price_1UMFmGDHbZkO7vsGhvtmzYng';
const TEAM_MONTHLY = 'price_1UMFmGDHbZkO7vsG4raaQeAb';
const TEAM_YEARLY = 'price_1UMFmIDHbZkO7vsGoNN5rw7Q';
const UNKNOWN_PRICE = 'price_NOT_A_BLUEPRINT_PRICE';
// A Pipeline price: it must never unlock Blueprint (separate catalog slices).
const PIPELINE_SOLO_MONTHLY = 'price_1UMFmHDHbZkO7vsGLYd7xr1g';
const USER_ID = 'user_test_0001';

function evt(type: string, object: Record<string, any>): Stripe.Event {
  return {
    id: `evt_${crypto.randomUUID()}`,
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

function checkoutCompleted(opts: {
  clientReferenceId?: string | null;
  priceId?: string | null;
  metadataPriceId?: string;
  metadata?: Record<string, string>;
  customer?: string | null;
  subscription?: string | null;
  includeLineItems?: boolean;
} = {}): Stripe.Event {
  const {
    clientReferenceId = USER_ID,
    priceId = SOLO_MONTHLY,
    metadataPriceId,
    metadata = {},
    customer = 'cus_test_1',
    subscription = 'sub_test_1',
    includeLineItems = true,
  } = opts;

  const object: Record<string, any> = {
    id: `cs_test_${crypto.randomUUID()}`,
    object: 'checkout.session',
    client_reference_id: clientReferenceId,
    customer,
    subscription,
    metadata: metadataPriceId ? { ...metadata, price_id: metadataPriceId } : metadata,
  };
  if (includeLineItems && priceId) {
    object.line_items = { object: 'list', data: [{ id: 'li_1', price: { id: priceId } }] };
  }
  return evt('checkout.session.completed', object);
}

function subscriptionEvent(type: string, status: string, subId = 'sub_test_1', customerId = 'cus_test_1'): Stripe.Event {
  return evt(type, { id: subId, object: 'subscription', status, customer: customerId });
}

function userColumns(): string[] {
  return (getDb().prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name);
}

function userRow(): { subscription_tier: string; stripe_customer_id: string | null; stripe_subscription_id: string | null } {
  return getDb()
    .prepare('SELECT subscription_tier, stripe_customer_id, stripe_subscription_id FROM users WHERE id = ?')
    .get(USER_ID);
}

function resetUser(): void {
  getDb()
    .prepare('UPDATE users SET subscription_tier = ?, stripe_customer_id = NULL, stripe_subscription_id = NULL WHERE id = ?')
    .run('FREE', USER_ID);
}

function promoRows(): { code: string; product: string; tier: string; interval: string }[] {
  return getDb().prepare('SELECT code, product, tier, interval FROM promo_redemptions').all() as any[];
}

function clearPromos(): void {
  getDb().run('DELETE FROM promo_redemptions');
}

// --- run --------------------------------------------------------------------
await initDb();

console.log('\nMigrations');

await test('legacy users table gains stripe_customer_id + stripe_subscription_id', () => {
  const cols = userColumns();
  assert.ok(cols.includes('stripe_customer_id'), 'stripe_customer_id column missing');
  assert.ok(cols.includes('stripe_subscription_id'), 'stripe_subscription_id column missing');
});

await test('re-running initDb() is a no-op (idempotent migrations)', async () => {
  await initDb();
  const cols = userColumns();
  assert.equal(cols.filter((c) => c === 'stripe_customer_id').length, 1);
  assert.equal(cols.filter((c) => c === 'stripe_subscription_id').length, 1);
});

await test('promo_redemptions table exists', () => {
  const names = (getDb().prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((r) => r.name);
  assert.ok(names.includes('promo_redemptions'));
});

// Seed the test user AFTER the migration tests: initDb() re-reads the DB file
// from disk, so anything held only in memory would be discarded by that call.
// The insert uses only pre-Phase-4 columns, like a real legacy user.
getDb()
  .prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)')
  .run(USER_ID, 'webhook-test@example.com', 'x');

console.log('\nGrant logic (checkout.session.completed)');

const grants: [string, string, string][] = [
  ['Solo Monthly', SOLO_MONTHLY, 'SOLO'],
  ['Solo Yearly', SOLO_YEARLY, 'SOLO'],
  ['Team Monthly', TEAM_MONTHLY, 'TEAM'],
  ['Team Yearly', TEAM_YEARLY, 'TEAM'],
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

await test('PRICE_TO_TIER contains exactly the four Blueprint prices', () => {
  assert.deepEqual(
    Object.keys(PRICE_TO_TIER).sort(),
    [SOLO_MONTHLY, SOLO_YEARLY, TEAM_MONTHLY, TEAM_YEARLY].sort()
  );
});

await test('falls back to metadata.price_id when line_items are absent', () => {
  resetUser();
  const outcome = handleStripeEvent(
    checkoutCompleted({ includeLineItems: false, priceId: null, metadataPriceId: TEAM_YEARLY })
  );
  assert.equal(outcome.action, 'granted');
  assert.equal(outcome.tier, 'TEAM');
  assert.equal(userRow().subscription_tier, 'TEAM');
});

await test('tier is derived from the price paid, never from client_reference_id metadata', () => {
  resetUser();
  // Even if metadata claims TEAM, a Solo price grants SOLO only.
  const outcome = handleStripeEvent(
    checkoutCompleted({ priceId: SOLO_MONTHLY, metadata: { tier: 'AGENCY', product: 'blueprint' } })
  );
  assert.equal(outcome.tier, 'SOLO');
});

console.log('\nEdge cases');

await test('missing client_reference_id → no grant', () => {
  resetUser();
  const outcome = handleStripeEvent(checkoutCompleted({ clientReferenceId: null }));
  assert.equal(outcome.action, 'skipped');
  assert.equal(outcome.reason, 'missing_client_reference_id');
  assert.equal(userRow().subscription_tier, 'FREE');
});

await test('unknown price id → skipped, tier untouched', () => {
  resetUser();
  const outcome = handleStripeEvent(checkoutCompleted({ priceId: UNKNOWN_PRICE }));
  assert.equal(outcome.action, 'skipped');
  assert.equal(outcome.reason, 'unknown_price');
  assert.equal(userRow().subscription_tier, 'FREE');
});

await test('a Pipeline price does not unlock Blueprint', () => {
  resetUser();
  const outcome = handleStripeEvent(checkoutCompleted({ priceId: PIPELINE_SOLO_MONTHLY }));
  assert.equal(outcome.action, 'skipped');
  assert.equal(outcome.reason, 'unknown_price');
  assert.equal(userRow().subscription_tier, 'FREE');
});

await test('client_reference_id that is not a real user → skipped', () => {
  resetUser();
  const outcome = handleStripeEvent(checkoutCompleted({ clientReferenceId: 'user_does_not_exist' }));
  assert.equal(outcome.action, 'skipped');
  assert.equal(outcome.reason, 'unknown_user');
});

await test('session with no resolvable price → skipped', () => {
  resetUser();
  const outcome = handleStripeEvent(checkoutCompleted({ includeLineItems: false, priceId: null }));
  assert.equal(outcome.action, 'skipped');
  assert.equal(outcome.reason, 'missing_price');
});

await test('sessionPriceId prefers line_items over metadata', () => {
  const session = checkoutCompleted({ priceId: SOLO_MONTHLY, metadataPriceId: TEAM_YEARLY });
  assert.equal(sessionPriceId(session.data.object as any), SOLO_MONTHLY);
});

console.log('\nRevoke logic');

await test('customer.subscription.deleted → revokes to FREE', () => {
  handleStripeEvent(checkoutCompleted({ priceId: TEAM_MONTHLY }));
  assert.equal(userRow().subscription_tier, 'TEAM');

  const outcome = handleStripeEvent(subscriptionEvent('customer.subscription.deleted', 'canceled'));
  assert.equal(outcome.action, 'revoked');
  const row = userRow();
  assert.equal(row.subscription_tier, 'FREE');
  assert.equal(row.stripe_subscription_id, null);
});

await test('revocation is idempotent (repeat event is a no-op, stays FREE)', () => {
  handleStripeEvent(checkoutCompleted({ priceId: TEAM_MONTHLY }));
  handleStripeEvent(subscriptionEvent('customer.subscription.deleted', 'canceled'));
  const again = handleStripeEvent(subscriptionEvent('customer.subscription.deleted', 'canceled'));
  assert.equal(again.action, 'skipped');
  assert.equal(again.reason, 'already_revoked');
  assert.equal(userRow().subscription_tier, 'FREE');
});

await test('customer.subscription.updated (unpaid) → revokes to FREE', () => {
  handleStripeEvent(checkoutCompleted({ priceId: SOLO_YEARLY }));
  const outcome = handleStripeEvent(subscriptionEvent('customer.subscription.updated', 'unpaid'));
  assert.equal(outcome.action, 'revoked');
  assert.equal(userRow().subscription_tier, 'FREE');
});

await test('customer.subscription.updated (canceled) → revokes to FREE', () => {
  handleStripeEvent(checkoutCompleted({ priceId: SOLO_YEARLY }));
  const outcome = handleStripeEvent(subscriptionEvent('customer.subscription.updated', 'canceled'));
  assert.equal(outcome.action, 'revoked');
  assert.equal(userRow().subscription_tier, 'FREE');
});

await test('customer.subscription.updated (active) → entitlement intact', () => {
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

console.log('\nPromo codes');

await test('promo redemption recorded alongside the grant', () => {
  resetUser();
  clearPromos();
  const outcome = handleStripeEvent(
    checkoutCompleted({
      priceId: TEAM_YEARLY,
      metadata: { promo_code: 'LAUNCH20', product: 'blueprint', tier: 'TEAM', interval: 'year' },
    })
  );
  assert.equal(outcome.action, 'granted');
  assert.equal(outcome.tier, 'TEAM');
  assert.equal(outcome.promoRecorded, true);
  const rows = promoRows();
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], { code: 'LAUNCH20', product: 'blueprint', tier: 'TEAM', interval: 'year' });
});

await test('promo-only checkout (no user) still records the redemption, grants nothing', () => {
  clearPromos();
  const outcome = handleStripeEvent(
    checkoutCompleted({
      clientReferenceId: null,
      priceId: null,
      includeLineItems: false,
      metadata: { promo_code: 'FREETRIAL', product: 'blueprint', tier: 'SOLO', interval: 'month' },
    })
  );
  assert.equal(outcome.action, 'skipped');
  assert.equal(outcome.reason, 'missing_client_reference_id');
  assert.equal(promoRows().length, 1);
});

await test('invite_code metadata is not redeemed by the webhook (monolith parity)', () => {
  resetUser();
  clearPromos();
  const outcome = handleStripeEvent(checkoutCompleted({ metadata: { invite_code: 'INVITE-ABC' } }));
  // The grant still comes from the price; no promo row, no tier from the code.
  assert.equal(outcome.action, 'granted');
  assert.equal(outcome.promoRecorded, false);
  assert.equal(promoRows().length, 0);
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
