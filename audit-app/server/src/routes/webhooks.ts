// audit-app/server/src/routes/webhooks.ts
//
// Stripe webhook endpoint for the standalone Audit app (split Phase 4).
//
// Mirrors the Pipeline app (pipeline-app/server/src/routes/webhooks.ts, PR #43)
// and the Blueprint app (blueprint-app/server/src/routes/webhooks.ts, PR #49),
// plus the monolith's original audit behaviour (server/src/routes/webhooks.ts),
// but is self-contained: it imports nothing from the monolith and does NOT need
// STRIPE_SECRET_KEY. Signature verification uses the STATIC helper
// `Stripe.webhooks.constructEvent(payload, sig, secret)`, which needs only the
// webhook signing secret (STRIPE_WEBHOOK_SECRET). The managed Stripe account
// exposes no API key to this app, so no Stripe client is ever constructed here.
//
// ENTITLEMENT RULES
//  - checkout.session.completed with a RECURRING price (Team/Agency, mode
//    'subscription') → grant the tier implied by the price ACTUALLY PAID
//    (line_items[0].price.id, falling back to metadata.price_id) and record the
//    Stripe customer + subscription id so a later cancellation can revoke.
//    A tier is never read from user-controllable input; unknown prices are
//    logged and skipped.
//  - checkout.session.completed with the ONE-TIME Single Use price (mode
//    'payment') → grant exactly ONE full-audit credit
//    (`audit_usage.paid_audits += 1`), mirroring the monolith. No tier is
//    written and no stripe_customer_id / stripe_subscription_id is set: there is
//    nothing recurring to revoke, and writing the one-time customer id could
//    clobber the id of a concurrent subscription.
//  - customer.subscription.deleted, and customer.subscription.updated with
//    status canceled|unpaid → revoke back to FREE (idempotent).
//
// WHO PAID? The audit app is anonymous-first (the free tier needs no signup), so
// a hosted Payment Link often arrives without `client_reference_id`. We resolve
// the audit user in this order:
//   1. `client_reference_id` = users.id (set when a logged-in user checks out)
//   2. `customer_details.email` / `customer_email` = users.email (case-insensitive)
// If neither matches an existing account we log and return 200 (skipped) so
// Stripe does not retry a grant we can never apply.
//
// IDEMPOTENCY: every successfully-handled event id is recorded in
// `stripe_webhook_events`. Tier writes are naturally idempotent, but credit
// grants are NOT — a retried `checkout.session.completed` must never hand out a
// second $29 audit. A redelivered event id is therefore skipped.

import express, { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { getDb, persistDb } from '../db.js';
import { config } from '../config.js';
import { PRICE_TO_TIER, SINGLE_USE_PRICE_ID } from '../stripePricing.js';

/** Coerce a Stripe expandable id (string | object) to a plain string id. */
function idOf(value: string | { id?: string } | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value.id ?? null;
}

/** The price id carried by a session's `line_items` (payload or retrieved). */
function lineItemPriceId(session: Stripe.Checkout.Session): string | null {
  const lineItems = (session as any).line_items;
  const items: any[] = Array.isArray(lineItems) ? lineItems : lineItems?.data;
  if (items && items.length) {
    const priceId = items[0]?.price?.id;
    if (priceId) return priceId;
  }
  return null;
}

/** The price id of a subscription's first item. */
export function subscriptionPriceId(subscription: Stripe.Subscription): string | null {
  const items: any[] = (subscription as any)?.items?.data;
  if (Array.isArray(items) && items.length) {
    const priceId = items[0]?.price?.id;
    if (priceId) return priceId;
  }
  return null;
}

/**
 * Resolve the price actually paid for a Checkout Session.
 *
 * `checkout.session.completed` does NOT include `line_items` unless the endpoint
 * was configured to expand them, and hosted Payment Links attach no
 * `metadata.price_id` either — so the payload alone is normally empty and every
 * real purchase would be skipped as "no resolvable price". See
 * resolveSessionPriceId() for the API fallback.
 *
 * We deliberately do NOT read a tier from metadata or client_reference_id —
 * the tier must come from the price that was paid.
 */
export function sessionPriceId(session: Stripe.Checkout.Session): string | null {
  const inline = lineItemPriceId(session);
  if (inline) return inline;
  const meta = (session.metadata || {}) as Record<string, string>;
  return meta.price_id || null;
}

/** Where a resolved price id came from — logged so a real grant is traceable. */
export type PriceSource = 'line_items' | 'metadata' | 'retrieved_session' | 'subscription' | 'none';

export interface ResolvedPrice {
  priceId: string | null;
  source: PriceSource;
}

/**
 * The slice of the Stripe client used to look up a price. Kept as an interface
 * so the grant path can be unit-tested without a network call or an API key.
 */
export interface PriceLookup {
  retrieveSession(sessionId: string): Promise<Stripe.Checkout.Session>;
  retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription>;
}

/** Wrap a Stripe client in the narrow lookup surface the grant path needs. */
export function createPriceLookup(stripe: Stripe): PriceLookup {
  return {
    retrieveSession: (sessionId: string) =>
      stripe.checkout.sessions.retrieve(sessionId, { expand: ['line_items'] }),
    retrieveSubscription: (subscriptionId: string) =>
      stripe.subscriptions.retrieve(subscriptionId),
  };
}

/**
 * Resolve the paid price, falling back to the Stripe API when the event payload
 * does not carry one. Never throws: a lookup failure is logged and reported as
 * `none`, which the caller treats as "skipped" rather than a webhook error.
 */
export async function resolveSessionPriceId(
  session: Stripe.Checkout.Session,
  lookup: PriceLookup | null = null
): Promise<ResolvedPrice> {
  const inline = lineItemPriceId(session);
  if (inline) return { priceId: inline, source: 'line_items' };

  const meta = (session.metadata || {}) as Record<string, string>;
  if (meta.price_id) return { priceId: meta.price_id, source: 'metadata' };

  const subscriptionId = idOf(session.subscription);

  if (!lookup) {
    console.warn(
      '[Audit Stripe Webhook] Session',
      session.id,
      'carries no price in its payload and STRIPE_SECRET_KEY is not configured, so the session cannot be retrieved; skipping grant'
    );
    return { priceId: null, source: 'none' };
  }

  if (session.id) {
    try {
      const full = await lookup.retrieveSession(session.id);
      const fromSession = lineItemPriceId(full);
      if (fromSession) return { priceId: fromSession, source: 'retrieved_session' };
    } catch (err: any) {
      console.error('[Audit Stripe Webhook] Failed to retrieve session', session.id, 'with line_items:', err.message);
    }
  }

  if (subscriptionId) {
    try {
      const subscription = await lookup.retrieveSubscription(subscriptionId);
      const fromSubscription = subscriptionPriceId(subscription);
      if (fromSubscription) return { priceId: fromSubscription, source: 'subscription' };
    } catch (err: any) {
      console.error('[Audit Stripe Webhook] Failed to retrieve subscription', subscriptionId + ':', err.message);
    }
  }

  return { priceId: null, source: 'none' };
}

/** The email the buyer typed into Stripe Checkout, if the event carries one. */
export function sessionEmail(session: Stripe.Checkout.Session): string | null {
  const details = (session as any).customer_details || {};
  const email = details.email || (session as any).customer_email || null;
  return typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
}

/** Outcome of handling one webhook event — returned for logging and unit tests. */
export interface WebhookOutcome {
  /** 'credited' = one-time Single Use audit credit granted. */
  action: 'granted' | 'revoked' | 'credited' | 'skipped' | 'ignored';
  reason?: string;
  userId?: string | null;
  tier?: string;
  /** How the paying customer was matched to an audit account. */
  matchedBy?: 'client_reference_id' | 'email';
  /** Credits granted by a Single Use purchase (normally 1). */
  credits?: number;
}

/**
 * Match the paying Stripe customer to an audit-app user.
 *
 * Order matters: an explicit `client_reference_id` (only ever set by our own
 * logged-in checkout flow) beats the email Stripe collected. The email path is
 * what actually fires for the hosted Payment Links in src/lib/pricing.ts, which
 * carry no reference id — the audit app has no login wall to stamp one.
 */
function resolveUser(
  db: ReturnType<typeof getDb>,
  session: Stripe.Checkout.Session
): { id: string; matchedBy: 'client_reference_id' | 'email' } | null {
  const refId = session.client_reference_id || null;
  if (refId) {
    const row = db.prepare('SELECT id FROM users WHERE id = ?').get(refId) as { id: string } | undefined;
    if (row) return { id: row.id, matchedBy: 'client_reference_id' };
  }

  const email = sessionEmail(session);
  if (email) {
    // users.email is UNIQUE but not necessarily stored lowercased, so compare
    // case-insensitively rather than trusting the stored casing.
    const row = db
      .prepare('SELECT id FROM users WHERE lower(email) = ? LIMIT 1')
      .get(email) as { id: string } | undefined;
    if (row) return { id: row.id, matchedBy: 'email' };
  }

  return null;
}

/** True when this event id was already processed (Stripe redelivery). */
function isDuplicateEvent(db: ReturnType<typeof getDb>, eventId: string): boolean {
  const row = db.prepare('SELECT event_id FROM stripe_webhook_events WHERE event_id = ?').get(eventId) as
    | { event_id: string }
    | undefined;
  return !!row;
}

/** Record a processed event id so a Stripe retry cannot double-apply it. */
function recordEvent(db: ReturnType<typeof getDb>, event: Stripe.Event, outcome: WebhookOutcome): void {
  try {
    db.prepare('INSERT OR IGNORE INTO stripe_webhook_events (event_id, type, action) VALUES (?, ?, ?)').run(
      event.id,
      event.type,
      outcome.action
    );
  } catch (err: any) {
    // Never fail a grant because the audit-log row failed to write.
    console.error('[Audit Stripe Webhook] Failed to record event', event.id + ':', err.message);
  }
}

/**
 * Apply one verified Stripe event to the Audit database.
 *
 * Exported separately from the HTTP route so the grant/revoke logic can be
 * unit-tested with synthetic events (see server/src/tests/stripeWebhook.test.ts).
 */
export async function handleStripeEvent(
  event: Stripe.Event,
  lookup: PriceLookup | null = null
): Promise<WebhookOutcome> {
  const db = getDb();

  // --- Checkout completed: grant entitlement (if we know who paid) ----------
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    // The price is normally NOT in the payload (see resolveSessionPriceId), so
    // this may make one Stripe API call before the grant can be decided.
    const { priceId, source } = await resolveSessionPriceId(session, lookup);
    if (!priceId) {
      console.log('[Audit Stripe Webhook] checkout.session.completed with no resolvable price; skipping grant');
      return { action: 'skipped', reason: 'missing_price' };
    }

    const user = resolveUser(db, session);
    if (!user) {
      // Graceful: the buyer has no audit-app account (or checked out with a
      // different email). Nothing to grant — log enough to resolve by hand.
      console.log(
        '[Audit Stripe Webhook] checkout.session.completed for price',
        priceId,
        'matched no audit account (client_reference_id:',
        session.client_reference_id || 'none',
        ', email:',
        sessionEmail(session) || 'none',
        '); skipping grant'
      );
      return {
        action: 'skipped',
        reason: session.client_reference_id ? 'unknown_user' : 'no_matching_user',
      };
    }
    const userId = user.id;

    // --- One-time "Single Use" ($29, mode 'payment'): one full-audit credit --
    if (priceId === SINGLE_USE_PRICE_ID) {
      if (isDuplicateEvent(db, event.id)) {
        return { action: 'skipped', reason: 'duplicate_event', userId, matchedBy: user.matchedBy };
      }
      const existing = db.prepare('SELECT paid_audits FROM audit_usage WHERE user_id = ?').get(userId) as
        | { paid_audits: number }
        | undefined;
      if (existing) {
        db.prepare('UPDATE audit_usage SET paid_audits = paid_audits + 1 WHERE user_id = ?').run(userId);
      } else {
        db.prepare(
          'INSERT INTO audit_usage (user_id, audits_run, paid_audits, last_audit_at) VALUES (?, 0, 1, NULL)'
        ).run(userId);
      }
      persistDb();
      console.log('[Audit Stripe Webhook] Granted 1 paid audit credit to user', userId, '(matched by', user.matchedBy + ', price source', source + ')');
      return { action: 'credited', userId, matchedBy: user.matchedBy, credits: 1 };
    }

    // --- Recurring subscription: grant the tier the price implies -----------
    const tier = PRICE_TO_TIER[priceId];
    if (!tier) {
      console.log('[Audit Stripe Webhook] Unknown price id', priceId, 'for user', userId, '; skipping grant');
      return { action: 'skipped', reason: 'unknown_price', userId, matchedBy: user.matchedBy };
    }

    const customerId = idOf(session.customer);
    const subscriptionId = idOf(session.subscription);
    db.prepare(
      "UPDATE users SET subscription_tier = ?, stripe_customer_id = ?, stripe_subscription_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(tier, customerId, subscriptionId, userId);
    persistDb();
    console.log(
      '[Audit Stripe Webhook] Granted',
      tier,
      'to user',
      userId,
      '(price',
      priceId + ', sub',
      subscriptionId + ', matched by',
      user.matchedBy + ', price source',
      source + ')'
    );
    return { action: 'granted', userId, tier, matchedBy: user.matchedBy };
  }

  // --- Subscription canceled / unpaid: revoke entitlement --------------------
  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    const shouldRevoke =
      event.type === 'customer.subscription.deleted' || ['canceled', 'unpaid'].includes(subscription.status);

    if (!shouldRevoke) {
      return { action: 'ignored', reason: 'subscription_not_canceled' };
    }

    const subscriptionId = subscription.id ?? null;
    const customerId = idOf(subscription.customer);
    const user = db
      .prepare(
        'SELECT id, subscription_tier, stripe_subscription_id FROM users WHERE stripe_subscription_id = ? OR stripe_customer_id = ? LIMIT 1'
      )
      .get(subscriptionId, customerId) as
      | { id: string; subscription_tier: string; stripe_subscription_id: string | null }
      | undefined;

    if (!user) {
      console.log('[Audit Stripe Webhook] No user found for subscription', subscriptionId, '/ customer', customerId);
      return { action: 'skipped', reason: 'no_matching_user' };
    }

    // Idempotency: a repeated cancellation for an already-revoked user is a no-op.
    if (user.subscription_tier === 'FREE' && !user.stripe_subscription_id) {
      return { action: 'skipped', reason: 'already_revoked', userId: user.id };
    }

    db.prepare(
      "UPDATE users SET subscription_tier = 'FREE', stripe_subscription_id = NULL, updated_at = datetime('now') WHERE id = ?"
    ).run(user.id);
    persistDb();
    console.log(
      '[Audit Stripe Webhook] Revoked entitlement for user',
      user.id,
      '(subscription',
      subscriptionId,
      'status',
      subscription.status + ')'
    );
    return { action: 'revoked', userId: user.id, tier: 'FREE' };
  }

  return { action: 'ignored', reason: `unhandled_event:${event.type}` };
}

/**
 * Apply one verified event, with redelivery protection around it.
 *
 * Kept separate from `handleStripeEvent` so unit tests can drive the raw
 * grant/revoke logic while the route still gets duplicate suppression.
 */
export async function processStripeEvent(
  event: Stripe.Event,
  lookup: PriceLookup | null = null
): Promise<WebhookOutcome> {
  const db = getDb();

  if (isDuplicateEvent(db, event.id)) {
    console.log('[Audit Stripe Webhook] Event', event.id, 'already processed; skipping (Stripe redelivery)');
    return { action: 'skipped', reason: 'duplicate_event' };
  }

  const outcome = await handleStripeEvent(event, lookup);
  // Only remember events we actually acted on; 'ignored' events carry no state.
  if (outcome.action !== 'ignored') recordEvent(db, event, outcome);
  return outcome;
}

/** The signing secret, from runtime env (preferred) or the loaded config. */
function webhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET || config.stripeWebhookSecret;
}

let _stripe: Stripe | null = null;

/**
 * A real Stripe-backed price lookup, or null when no API key is configured.
 *
 * This app verifies signatures statically and needs no key for that, but
 * resolving the price a hosted Payment Link actually paid DOES require reading
 * the session back from Stripe. Set STRIPE_SECRET_KEY to enable the grant
 * fallback; without it the webhook can only trust what the event payload
 * carries (which, for payment links, is no price at all).
 */
function priceLookup(): PriceLookup | null {
  const key = process.env.STRIPE_SECRET_KEY || config.stripeSecretKey;
  if (!key) return null;
  if (!_stripe) _stripe = new Stripe(key);
  return createPriceLookup(_stripe);
}

const router = Router();

/**
 * POST /api/webhooks/stripe
 *
 * NOTE: mounted BEFORE express.json() in index.ts so the raw body survives for
 * signature verification.
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string | undefined;
  const secret = webhookSecret();

  let event: Stripe.Event;
  try {
    if (secret) {
      if (!sig) {
        res.status(400).json({ error: 'Missing stripe-signature header' });
        return;
      }
      if (!Buffer.isBuffer(req.body)) {
        res.status(400).json({ error: 'Webhook payload must be raw JSON' });
        return;
      }
      // Static verification — needs only the signing secret, no API key.
      event = Stripe.webhooks.constructEvent(req.body, sig, secret);
    } else {
      // Dev/test fallback: no signing secret configured, parse the raw body.
      console.warn(
        '[Audit Stripe Webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification (dev/test only)'
      );
      const raw = Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body ?? {});
      event = JSON.parse(raw) as Stripe.Event;
    }
  } catch (err: any) {
    console.error('[Audit Stripe Webhook] Verification failed:', err.message);
    res.status(400).json({ error: 'Webhook error' });
    return;
  }

  try {
    const outcome = await processStripeEvent(event, priceLookup());
    res.json({ received: true, ...outcome });
  } catch (err: any) {
    // Stripe retries non-2xx responses; a DB failure here is worth retrying.
    console.error('[Audit Stripe Webhook] Handler failed:', err.message);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

export default router;
