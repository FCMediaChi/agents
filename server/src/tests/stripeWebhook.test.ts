// server/src/tests/stripeWebhook.test.ts
//
// Unit tests for the monolith Stripe webhook grant logic, focused on the bug
// that made every real purchase a no-op: `checkout.session.completed` carries
// no `line_items`, and hosted Payment Links carry no `metadata.price_id`, so
// the price was always null and the grant was skipped ("no resolvable price").
//
// The fix re-retrieves the session with `expand: ['line_items']` (and falls
// back to the subscription's first item price) before deciding the grant. These
// tests drive the real handler against a temporary SQLite database and a fake
// Stripe lookup — no network, no Stripe account, no API key.
//
// Run with: npm run test:webhook

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import type Stripe from 'stripe';

const tmpDbPath = path.join(os.tmpdir(), `monolith-webhook-test-${crypto.randomUUID()}.db`);
process.env.DB_PATH = tmpDbPath;

const { initDb, getDb, closeDb } = await import('../db.js');
const { handleStripeEvent, createPriceLookup, resolveSessionPriceId, sessionPriceId } = await import(
  '../routes/webhooks.js'
);
const { PRICE_TO_TIER, AUDIT_SINGLE_PRICE_ID } = await import('../stripePricing.js');

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
const TEAM_YEARLY = 'price_1UMFmIDHbZkO7vsGoNN5rw7Q';
const UNKNOWN_PRICE = 'price_NOT_A_REAL_PRICE';
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

/**
 * A checkout session shaped like a real hosted Payment Link one: no
 * `line_items` in the payload and no `metadata.price_id`.
 */
function checkoutCompleted(opts: {
  clientReferenceId?: string | null;
  metadata?: Record<string, string>;
  customer?: string | null;
  subscription?: string | null;
  inlineLineItemsPriceId?: string | null;
} = {}): Stripe.Event {
  const {
    clientReferenceId = USER_ID,
    metadata = {},
    customer = 'cus_test_1',
    subscription = 'sub_test_1',
    inlineLineItemsPriceId = null,
  } = opts;

  const object: Record<string, any> = {
    id: `cs_test_${crypto.randomUUID()}`,
    object: 'checkout.session',
    client_reference_id: clientReferenceId,
    customer,
    subscription,
    metadata,
  };
  if (inlineLineItemsPriceId) {
    object.line_items = { object: 'list', data: [{ id: 'li_1', price: { id: inlineLineItemsPriceId } }] };
  }
  return evt('checkout.session.completed', object);
}

/** Records what the handler asked Stripe for, and answers from the fixtures. */
function fakeLookup(config: {
  sessionPriceId?: string | null;
  subscriptionPriceId?: string | null;
  throwOnSession?: boolean;
  throwOnSubscription?: boolean;
} = {}) {
  const calls = { sessions: [] as string[], subscriptions: [] as string[] };
  return {
    calls,
    lookup: {
      retrieveSession: async (sessionId: string) => {
        calls.sessions.push(sessionId);
        if (config.throwOnSession) throw new Error('stripe down');
        return {
          id: sessionId,
          object: 'checkout.session',
          ...(config.sessionPriceId
            ? { line_items: { object: 'list', data: [{ id: 'li_1', price: { id: config.sessionPriceId } }] } }
            : {}),
        } as unknown as Stripe.Checkout.Session;
      },
      retrieveSubscription: async (subscriptionId: string) => {
        calls.subscriptions.push(subscriptionId);
        if (config.throwOnSubscription) throw new Error('stripe down');
        return {
          id: subscriptionId,
          object: 'subscription',
          items: {
            object: 'list',
            data: [{ id: 'si_1', price: { id: config.subscriptionPriceId ?? UNKNOWN_PRICE } }],
          },
        } as unknown as Stripe.Subscription;
      },
    },
  };
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

function paidAudits(): number {
  const row = getDb().prepare('SELECT paid_audits FROM audit_usage WHERE user_id = ?').get(USER_ID) as
    | { paid_audits: number }
    | undefined;
  return row?.paid_audits ?? 0;
}

// --- run --------------------------------------------------------------------
await initDb();

getDb().prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(USER_ID, 'webhook-test@example.com', 'x');

console.log('\nThe bug: a payment-link session with no line_items in the payload');

await test('price is null from the payload alone (the original failure)', () => {
  const session = checkoutCompleted().data.object as Stripe.Checkout.Session;
  assert.equal(sessionPriceId(session), null);
});

await test('no API key configured → still skipped, but never crashes', async () => {
  resetUser();
  const outcome = await handleStripeEvent(checkoutCompleted(), null);
  assert.equal(outcome.action, 'skipped');
  assert.equal(outcome.reason, 'missing_price');
  assert.equal(userRow().subscription_tier, 'FREE');
});

await test('session retrieved with expand:["line_items"] → grants the paid tier', async () => {
  resetUser();
  const { calls, lookup } = fakeLookup({ sessionPriceId: SOLO_MONTHLY });
  const event = checkoutCompleted();

  const outcome = await handleStripeEvent(event, lookup);

  assert.equal(outcome.action, 'granted');
  assert.equal(outcome.tier, 'SOLO');
  assert.equal(outcome.priceSource, 'retrieved_session');
  assert.deepEqual(calls.sessions, [(event.data.object as any).id], 'should retrieve the completed session');
  const row = userRow();
  assert.equal(row.subscription_tier, 'SOLO');
  assert.equal(row.stripe_customer_id, 'cus_test_1');
  assert.equal(row.stripe_subscription_id, 'sub_test_1');
});

await test('createPriceLookup asks Stripe to expand line_items', async () => {
  let sessionArgs: any[] = [];
  const lookup = createPriceLookup({
    checkout: {
      sessions: {
        retrieve: async (...args: any[]) => {
          sessionArgs = args;
          return { id: args[0], line_items: { data: [] } };
        },
      },
    },
    subscriptions: { retrieve: async () => ({ id: 'sub_x' }) },
  } as unknown as Stripe);

  await lookup.retrieveSession('cs_test_expand');
  assert.equal(sessionArgs[0], 'cs_test_expand');
  assert.deepEqual(sessionArgs[1], { expand: ['line_items'] });
});

await test('retrieved session has no line_items → subscription item price is used', async () => {
  resetUser();
  const { calls, lookup } = fakeLookup({ sessionPriceId: null, subscriptionPriceId: TEAM_YEARLY });
  const outcome = await handleStripeEvent(checkoutCompleted(), lookup);

  assert.equal(outcome.action, 'granted');
  assert.equal(outcome.tier, 'TEAM');
  assert.equal(outcome.priceSource, 'subscription');
  assert.equal(calls.subscriptions.length, 1);
  assert.equal(userRow().subscription_tier, 'TEAM');
});

await test('retrieval failure → skipped, not a 500, tier untouched', async () => {
  resetUser();
  const { calls, lookup } = fakeLookup({ throwOnSession: true, throwOnSubscription: true });
  const outcome = await handleStripeEvent(checkoutCompleted(), lookup);
  assert.equal(outcome.action, 'skipped');
  assert.equal(outcome.reason, 'missing_price');
  assert.equal(calls.subscriptions.length, 1, 'subscription fallback is still attempted');
  assert.equal(userRow().subscription_tier, 'FREE');
});

console.log('\nGrant paths that already worked (must not regress)');

await test('line_items already in the payload → granted without an API call', async () => {
  resetUser();
  const { calls, lookup } = fakeLookup({ sessionPriceId: UNKNOWN_PRICE });
  const outcome = await handleStripeEvent(checkoutCompleted({ inlineLineItemsPriceId: SOLO_MONTHLY }), lookup);
  assert.equal(outcome.action, 'granted');
  assert.equal(outcome.tier, 'SOLO');
  assert.equal(outcome.priceSource, 'line_items');
  assert.deepEqual(calls.sessions, []);
});

await test('metadata.price_id is used before any API call', async () => {
  resetUser();
  const { calls, lookup } = fakeLookup({ sessionPriceId: SOLO_MONTHLY });
  const outcome = await handleStripeEvent(
    checkoutCompleted({ metadata: { price_id: TEAM_YEARLY } }),
    lookup
  );
  assert.equal(outcome.tier, 'TEAM');
  assert.equal(outcome.priceSource, 'metadata');
  assert.deepEqual(calls.sessions, []);
});

await test('retrieved Single Use audit price → one audit credit, no tier', async () => {
  resetUser();
  const before = paidAudits();
  const { lookup } = fakeLookup({ sessionPriceId: AUDIT_SINGLE_PRICE_ID });
  const outcome = await handleStripeEvent(checkoutCompleted(), lookup);
  assert.equal(outcome.action, 'credited');
  assert.equal(outcome.credits, 1);
  assert.equal(paidAudits(), before + 1);
  assert.equal(userRow().subscription_tier, 'FREE');
});

await test('retrieved unknown price → skipped, tier untouched', async () => {
  resetUser();
  const { lookup } = fakeLookup({ sessionPriceId: UNKNOWN_PRICE });
  const outcome = await handleStripeEvent(checkoutCompleted(), lookup);
  assert.equal(outcome.action, 'skipped');
  assert.equal(outcome.reason, 'unknown_price');
  assert.equal(userRow().subscription_tier, 'FREE');
});

await test('no client_reference_id → skipped before any Stripe call', async () => {
  const { calls, lookup } = fakeLookup({ sessionPriceId: SOLO_MONTHLY });
  const outcome = await handleStripeEvent(checkoutCompleted({ clientReferenceId: null }), lookup);
  assert.equal(outcome.action, 'skipped');
  assert.equal(outcome.reason, 'missing_client_reference_id');
  assert.deepEqual(calls.sessions, []);
});

await test('every PRICE_TO_TIER entry still grants its tier', async () => {
  for (const [priceId, tier] of Object.entries(PRICE_TO_TIER)) {
    resetUser();
    const { lookup } = fakeLookup({ sessionPriceId: priceId });
    const outcome = await handleStripeEvent(checkoutCompleted(), lookup);
    assert.equal(outcome.tier, tier, `price ${priceId} should grant ${tier}`);
    assert.equal(userRow().subscription_tier, tier);
  }
});

console.log('\nRevocation');

await test('customer.subscription.deleted → revokes to FREE', async () => {
  resetUser();
  const { lookup } = fakeLookup({ sessionPriceId: TEAM_YEARLY });
  await handleStripeEvent(checkoutCompleted(), lookup);
  assert.equal(userRow().subscription_tier, 'TEAM');

  const outcome = await handleStripeEvent(
    evt('customer.subscription.deleted', { id: 'sub_test_1', object: 'subscription', status: 'canceled', customer: 'cus_test_1' })
  );
  assert.equal(outcome.action, 'revoked');
  assert.equal(userRow().subscription_tier, 'FREE');
});

await test('resolveSessionPriceId reports source "none" when nothing resolves', async () => {
  const { lookup } = fakeLookup({ sessionPriceId: null, subscriptionPriceId: null });
  const resolved = await resolveSessionPriceId(checkoutCompleted().data.object as any, {
    ...lookup,
    retrieveSubscription: async () => ({ id: 'sub_x', items: { data: [] } } as any),
  });
  assert.equal(resolved.priceId, null);
  assert.equal(resolved.source, 'none');
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
