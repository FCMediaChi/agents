import express, { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { getDb } from '../db.js';
import { PRICE_TO_TIER, AUDIT_SINGLE_PRICE_ID } from '../stripePricing.js';

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
    _stripe = new Stripe(key);
  }
  return _stripe;
}

// Helpers to safely coerce Stripe expandable IDs (string | object) to a string.
function customerIdOf(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined): string | null {
  if (!customer) return null;
  if (typeof customer === 'string') return customer;
  return customer.id ?? null;
}

function subscriptionIdOf(sub: string | Stripe.Subscription | null | undefined): string | null {
  if (!sub) return null;
  if (typeof sub === 'string') return sub;
  return sub.id ?? null;
}

/** The price id carried by a session's `line_items` (payload or retrieved). */
function lineItemPriceId(session: Stripe.Checkout.Session): string | null {
  const lineItems: any = (session as any).line_items;
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
 * `checkout.session.completed` does NOT include `line_items` — the payload only
 * carries them if the endpoint was explicitly configured to expand them, and
 * hosted Payment Links attach no `metadata.price_id` either. So the inline
 * payload alone is normally empty and every real purchase would be skipped.
 *
 * Resolution order:
 *   1. `line_items` in the event payload (already expanded — free)
 *   2. `metadata.price_id` (set server-side, never user-controlled)
 *   3. re-retrieve the session with `expand: ['line_items']`
 *   4. the subscription's first item price (payment-link subscriptions)
 *
 * We deliberately do NOT read the tier from metadata or client_reference_id —
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

  const subscriptionId = subscriptionIdOf(session.subscription);

  if (!lookup) {
    console.warn(
      '[Stripe Webhook] Session',
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
      console.error('[Stripe Webhook] Failed to retrieve session', session.id, 'with line_items:', err.message);
    }
  }

  if (subscriptionId) {
    try {
      const subscription = await lookup.retrieveSubscription(subscriptionId);
      const fromSubscription = subscriptionPriceId(subscription);
      if (fromSubscription) return { priceId: fromSubscription, source: 'subscription' };
    } catch (err: any) {
      console.error('[Stripe Webhook] Failed to retrieve subscription', subscriptionId + ':', err.message);
    }
  }

  return { priceId: null, source: 'none' };
}

/** Outcome of handling one webhook event — returned for logging and unit tests. */
export interface WebhookOutcome {
  action: 'granted' | 'credited' | 'revoked' | 'skipped' | 'ignored';
  reason?: string;
  userId?: string | null;
  tier?: string;
  priceId?: string | null;
  priceSource?: PriceSource;
  /** Credits granted by a Single Use purchase (normally 1). */
  credits?: number;
}

/**
 * Apply one verified Stripe event to the database.
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
    const meta = session.metadata || {};
    const code = meta.promo_code;
    const product = meta.product;
    const tier = meta.tier;
    const interval = meta.interval;

    // Keep existing promo-redemption tracking (works for SDK sessions that
    // attach metadata; hosted payment links carry none, so this is a no-op).
    if (code && product && tier && interval) {
      try {
        db.prepare(
          'INSERT INTO promo_redemptions (code, product, tier, interval) VALUES (?, ?, ?, ?)'
        ).run(code, product, tier, interval);
        console.log('[Stripe Webhook] Recorded:', code, product, tier, interval);
      } catch (e: any) {
        console.error('[Stripe Webhook] DB error:', e.message);
      }
    }

    // Grant entitlement. The user id comes from client_reference_id (stamped
    // onto the session from the hosted payment link URL by the frontend), and
    // the tier comes from the price actually paid — never from user input.
    const userId = session.client_reference_id || null;
    if (!userId) {
      console.log('[Stripe Webhook] checkout.session.completed without client_reference_id; skipping entitlement grant (promo-only checkout)');
      return { action: 'skipped', reason: 'missing_client_reference_id' };
    }

    // The price is normally NOT in the payload (see resolveSessionPriceId), so
    // this may make one Stripe API call before the grant can be decided.
    const { priceId, source } = await resolveSessionPriceId(session, lookup);

    if (!priceId) {
      console.log('[Stripe Webhook] checkout.session.completed with no resolvable price; skipping grant for user', userId);
      return { action: 'skipped', reason: 'missing_price', userId };
    }

    const customerId = customerIdOf(session.customer);
    const subscriptionId = subscriptionIdOf(session.subscription);

    if (priceId === AUDIT_SINGLE_PRICE_ID) {
      // One-time "Single Use" audit — grant exactly one full-audit credit
      // instead of a permanent tier. See audit/routes/audit.ts + audit_usage.
      // We deliberately do NOT set stripe_customer_id / stripe_subscription_id
      // here: there is no recurring subscription to revoke, and writing the
      // one-time customer id could clobber the id of a concurrent subscription.
      try {
        const existing = db.prepare('SELECT paid_audits FROM audit_usage WHERE user_id = ?').get(userId) as any;
        if (existing) {
          db.prepare('UPDATE audit_usage SET paid_audits = paid_audits + 1 WHERE user_id = ?').run(userId);
        } else {
          db.prepare("INSERT INTO audit_usage (user_id, audits_run, paid_audits, last_audit_at) VALUES (?, 0, 1, NULL)").run(userId);
        }
        console.log('[Stripe Webhook] Granted 1 paid audit credit to user', userId, '(price source', source + ')');
        return { action: 'credited', userId, priceId, priceSource: source, credits: 1 };
      } catch (e: any) {
        console.error('[Stripe Webhook] Failed to grant audit credit:', e.message);
        return { action: 'skipped', reason: 'db_error', userId };
      }
    }

    const entitledTier = PRICE_TO_TIER[priceId];
    if (!entitledTier) {
      console.log('[Stripe Webhook] Unknown price id', priceId, 'for user', userId, '; skipping grant');
      return { action: 'skipped', reason: 'unknown_price', userId, priceId, priceSource: source };
    }

    try {
      db.prepare(
        "UPDATE users SET subscription_tier = ?, stripe_customer_id = ?, stripe_subscription_id = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(entitledTier, customerId, subscriptionId, userId);
      console.log(
        '[Stripe Webhook] Granted',
        entitledTier,
        'to user',
        userId,
        '(price',
        priceId + ' via',
        source + ', sub',
        subscriptionId + ')'
      );
      return { action: 'granted', userId, tier: entitledTier, priceId, priceSource: source };
    } catch (e: any) {
      console.error('[Stripe Webhook] Failed to grant tier:', e.message);
      return { action: 'skipped', reason: 'db_error', userId };
    }
  }

  // --- Subscription canceled / unpaid: revoke entitlement --------------------
  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    const revoke = event.type === 'customer.subscription.deleted' ||
      ['canceled', 'unpaid'].includes(subscription.status);

    if (!revoke) {
      return { action: 'ignored', reason: 'subscription_not_canceled' };
    }

    const subscriptionId = subscription.id;
    const customerId = customerIdOf(subscription.customer);
    try {
      const user = db.prepare(
        'SELECT id FROM users WHERE stripe_subscription_id = ? OR stripe_customer_id = ? LIMIT 1'
      ).get(subscriptionId, customerId) as { id: string } | undefined;

      if (!user) {
        console.log('[Stripe Webhook] No user found for subscription', subscriptionId, '/ customer', customerId);
        return { action: 'skipped', reason: 'no_matching_user' };
      }

      db.prepare(
        "UPDATE users SET subscription_tier = 'FREE', stripe_subscription_id = NULL, updated_at = datetime('now') WHERE id = ?"
      ).run(user.id);
      console.log('[Stripe Webhook] Revoked entitlement for user', user.id, '(subscription', subscriptionId, 'status', subscription.status + ')');
      return { action: 'revoked', userId: user.id, tier: 'FREE' };
    } catch (e: any) {
      console.error('[Stripe Webhook] Failed to revoke entitlement:', e.message);
      return { action: 'skipped', reason: 'db_error' };
    }
  }

  return { action: 'ignored', reason: `unhandled_event:${event.type}` };
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
 * A real Stripe-backed lookup, or null when no API key is configured (in which
 * case the webhook can only trust what the event payload already carries).
 */
function stripeLookup(): PriceLookup | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  try {
    return createPriceLookup(getStripe());
  } catch (err: any) {
    console.error('[Stripe Webhook] Stripe client unavailable:', err.message);
    return null;
  }
}

const router = Router();

router.post('/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string | undefined;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;
  try {
    if (secret) {
      if (!sig) {
        res.status(400).json({ error: 'Missing stripe-signature header' });
        return;
      }
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } else {
      event = JSON.parse(req.body.toString()) as Stripe.Event;
    }
  } catch (err: any) {
    console.error('[Stripe Webhook] Error:', err.message);
    res.status(400).json({ error: 'Webhook error' });
    return;
  }

  try {
    const outcome = await handleStripeEvent(event, stripeLookup());
    res.json({ received: true, ...outcome });
  } catch (err: any) {
    // Stripe retries non-2xx responses; a DB failure here is worth retrying.
    console.error('[Stripe Webhook] Handler failed:', err.message);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

export default router;
