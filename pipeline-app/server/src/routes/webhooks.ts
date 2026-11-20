// pipeline-app/server/src/routes/webhooks.ts
//
// Stripe webhook endpoint for the standalone Pipeline app.
//
// Mirrors the monolith's implementation (server/src/routes/webhooks.ts, PR #39)
// but is self-contained: it imports nothing from the monolith and does NOT need
// STRIPE_SECRET_KEY. Signature verification uses the STATIC helper
// `Stripe.webhooks.constructEvent(payload, sig, secret)`, which only needs the
// webhook signing secret (STRIPE_WEBHOOK_SECRET). The managed Stripe account has
// no API key available to this app, so no Stripe client is constructed here.
//
// ENTITLEMENT RULES
//  - checkout.session.completed → grant the tier implied by the price ACTUALLY
//    PAID (line_items[0].price.id, falling back to metadata.price_id), to the
//    user in `client_reference_id`. A tier is never read from user-controllable
//    input; unknown prices are logged and skipped.
//  - customer.subscription.deleted, and customer.subscription.updated with
//    status canceled|unpaid → revoke back to FREE.

import express, { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { getDb } from '../db.js';
import { PRICE_TO_TIER } from '../stripePricing.js';

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
      '[Pipeline Stripe Webhook] Session',
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
      console.error('[Pipeline Stripe Webhook] Failed to retrieve session', session.id, 'with line_items:', err.message);
    }
  }

  if (subscriptionId) {
    try {
      const subscription = await lookup.retrieveSubscription(subscriptionId);
      const fromSubscription = subscriptionPriceId(subscription);
      if (fromSubscription) return { priceId: fromSubscription, source: 'subscription' };
    } catch (err: any) {
      console.error('[Pipeline Stripe Webhook] Failed to retrieve subscription', subscriptionId + ':', err.message);
    }
  }

  return { priceId: null, source: 'none' };
}

/** Outcome of handling one webhook event — returned for logging and unit tests. */
export interface WebhookOutcome {
  action: 'granted' | 'revoked' | 'skipped' | 'ignored';
  reason?: string;
  userId?: string | null;
  tier?: string;
}

/**
 * Apply one verified Stripe event to the Pipeline database.
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
    const userId = session.client_reference_id || null;

    if (!userId) {
      console.log('[Pipeline Stripe Webhook] checkout.session.completed without client_reference_id; skipping entitlement grant');
      return { action: 'skipped', reason: 'missing_client_reference_id' };
    }

    // The price is normally NOT in the payload (see resolveSessionPriceId), so
    // this may make one Stripe API call before the grant can be decided.
    const { priceId, source } = await resolveSessionPriceId(session, lookup);
    if (!priceId) {
      console.log('[Pipeline Stripe Webhook] checkout.session.completed with no resolvable price; skipping grant for user', userId);
      return { action: 'skipped', reason: 'missing_price', userId };
    }

    const tier = PRICE_TO_TIER[priceId];
    if (!tier) {
      console.log('[Pipeline Stripe Webhook] Unknown price id', priceId, 'for user', userId, '; skipping grant');
      return { action: 'skipped', reason: 'unknown_price', userId };
    }

    const customerId = idOf(session.customer);
    const subscriptionId = idOf(session.subscription);

    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as { id: string } | undefined;
    if (!existing) {
      console.log('[Pipeline Stripe Webhook] client_reference_id', userId, 'does not match any user; skipping grant');
      return { action: 'skipped', reason: 'unknown_user', userId };
    }

    db.prepare(
      "UPDATE users SET subscription_tier = ?, stripe_customer_id = ?, stripe_subscription_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(tier, customerId, subscriptionId, userId);
    console.log('[Pipeline Stripe Webhook] Granted', tier, 'to user', userId, '(price', priceId + ' via', source + ', sub', subscriptionId + ')');
    return { action: 'granted', userId, tier };
  }

  // --- Subscription canceled / unpaid: revoke entitlement --------------------
  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    const shouldRevoke =
      event.type === 'customer.subscription.deleted' ||
      ['canceled', 'unpaid'].includes(subscription.status);

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
      console.log('[Pipeline Stripe Webhook] No user found for subscription', subscriptionId, '/ customer', customerId);
      return { action: 'skipped', reason: 'no_matching_user' };
    }

    // Idempotency: a repeated cancellation for an already-revoked user is a no-op.
    if (user.subscription_tier === 'FREE' && !user.stripe_subscription_id) {
      return { action: 'skipped', reason: 'already_revoked', userId: user.id };
    }

    db.prepare(
      "UPDATE users SET subscription_tier = 'FREE', stripe_subscription_id = NULL, updated_at = datetime('now') WHERE id = ?"
    ).run(user.id);
    console.log('[Pipeline Stripe Webhook] Revoked entitlement for user', user.id, '(subscription', subscriptionId, 'status', subscription.status + ')');
    return { action: 'revoked', userId: user.id, tier: 'FREE' };
  }

  return { action: 'ignored', reason: `unhandled_event:${event.type}` };
}

let _stripe: Stripe | null = null;

/**
 * A real Stripe-backed price lookup, or null when no API key is configured.
 *
 * Signature verification needs no API key, but resolving the price a hosted
 * Payment Link actually paid DOES require reading the session back from Stripe.
 * Set STRIPE_SECRET_KEY to enable the grant fallback; without it the webhook can
 * only trust what the event payload carries (for payment links: no price).
 */
function priceLookup(): PriceLookup | null {
  const key = process.env.STRIPE_SECRET_KEY;
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
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string | undefined;
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

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
        console.warn('[Pipeline Stripe Webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification (dev/test only)');
        const raw = Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body ?? {});
        event = JSON.parse(raw) as Stripe.Event;
      }
    } catch (err: any) {
      console.error('[Pipeline Stripe Webhook] Verification failed:', err.message);
      res.status(400).json({ error: 'Webhook error' });
      return;
    }

    try {
      const outcome = await handleStripeEvent(event, priceLookup());
      res.json({ received: true, ...outcome });
    } catch (err: any) {
      // Stripe retries non-2xx responses; a DB failure here is worth retrying.
      console.error('[Pipeline Stripe Webhook] Handler failed:', err.message);
      res.status(500).json({ error: 'Webhook handler failed' });
    }
  }
);

export default router;
