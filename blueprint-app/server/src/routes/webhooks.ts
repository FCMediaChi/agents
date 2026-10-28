// blueprint-app/server/src/routes/webhooks.ts
//
// Stripe webhook endpoint for the standalone Blueprint app (split Phase 4).
//
// Mirrors the Pipeline app's implementation (pipeline-app/server/src/routes/
// webhooks.ts) and the monolith's original (server/src/routes/webhooks.ts), but
// is self-contained: it imports nothing from the monolith and does NOT need
// STRIPE_SECRET_KEY. Signature verification uses the STATIC helper
// `Stripe.webhooks.constructEvent(payload, sig, secret)`, which only needs the
// webhook signing secret (STRIPE_WEBHOOK_SECRET). The managed Stripe account
// exposes no API key to this app, so no Stripe client is ever constructed here.
//
// ENTITLEMENT RULES
//  - checkout.session.completed → grant the tier implied by the price ACTUALLY
//    PAID (line_items[0].price.id, falling back to metadata.price_id), to the
//    user in `client_reference_id`; record the Stripe customer + subscription id
//    so a later cancellation can revoke. A tier is never read from
//    user-controllable input; unknown prices are logged and skipped.
//  - customer.subscription.deleted, and customer.subscription.updated with
//    status canceled|unpaid → revoke back to FREE (idempotent).
//  - promo code redemptions (metadata.promo_code/product/tier/interval) are
//    recorded in `promo_redemptions`, exactly like the monolith.
//
// INVITE CODES: the monolith has no invite-code redemption path — `invite_codes`
// is an admin-only table (create/list) whose `uses` counter is never incremented
// by Stripe and whose tier is granted by hand. There is therefore nothing to
// mirror here; the webhook only notes an invite code in metadata (if one is ever
// attached) and logs it, without granting anything from it.

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

/**
 * Resolve the price actually paid for a Checkout Session.
 *
 * `checkout.session.completed` normally includes `line_items` automatically
 * when the endpoint is configured to expand them; we fall back to
 * `metadata.price_id` (set server-side, never user-controlled) when line_items
 * are absent. We deliberately do NOT read a tier from metadata or
 * client_reference_id — the tier must come from the price that was paid.
 */
export function sessionPriceId(session: Stripe.Checkout.Session): string | null {
  const lineItems = (session as any).line_items;
  const items: any[] = Array.isArray(lineItems) ? lineItems : lineItems?.data;
  if (items && items.length) {
    const priceId = items[0]?.price?.id;
    if (priceId) return priceId;
  }
  const meta = (session.metadata || {}) as Record<string, string>;
  return meta.price_id || null;
}

/** Outcome of handling one webhook event — returned for logging and unit tests. */
export interface WebhookOutcome {
  action: 'granted' | 'revoked' | 'skipped' | 'ignored';
  reason?: string;
  userId?: string | null;
  tier?: string;
  /** True when a promo code redemption row was recorded for this event. */
  promoRecorded?: boolean;
}

/**
 * Record a promo-code redemption, if the session carries promo metadata.
 *
 * Hosted Payment Links carry no metadata, so in production this is normally a
 * no-op (same behaviour as the monolith). It is kept because SDK-created
 * sessions and promo-scoped links do attach it, and because redemptions must be
 * counted even on a promo-only checkout with no logged-in user.
 */
function recordPromoRedemption(session: Stripe.Checkout.Session): boolean {
  const meta = (session.metadata || {}) as Record<string, string>;
  const code = meta.promo_code;
  const product = meta.product;
  const tier = meta.tier;
  const interval = meta.interval;
  if (!code || !product || !tier || !interval) {
    if (meta.invite_code) {
      // Monolith parity: invite codes are granted by hand, never by webhook.
      console.log('[Blueprint Stripe Webhook] Session carries invite_code', meta.invite_code, '- invite codes are not redeemed by webhook; skipping');
    }
    return false;
  }
  try {
    getDb()
      .prepare('INSERT INTO promo_redemptions (code, product, tier, interval) VALUES (?, ?, ?, ?)')
      .run(code, product, tier, interval);
    console.log('[Blueprint Stripe Webhook] Recorded promo redemption:', code, product, tier, interval);
    return true;
  } catch (err: any) {
    // Never fail the grant because auditing the promo failed.
    console.error('[Blueprint Stripe Webhook] Failed to record promo redemption:', err.message);
    return false;
  }
}

/**
 * Apply one verified Stripe event to the Blueprint database.
 *
 * Exported separately from the HTTP route so the grant/revoke logic can be
 * unit-tested with synthetic events (see server/src/tests/stripeWebhook.test.ts).
 */
export function handleStripeEvent(event: Stripe.Event): WebhookOutcome {
  const db = getDb();

  // --- Checkout completed: grant entitlement (if we know who paid) ----------
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const promoRecorded = recordPromoRedemption(session);
    const userId = session.client_reference_id || null;

    if (!userId) {
      console.log('[Blueprint Stripe Webhook] checkout.session.completed without client_reference_id; skipping entitlement grant (promo-only checkout)');
      return { action: 'skipped', reason: 'missing_client_reference_id', promoRecorded };
    }

    const priceId = sessionPriceId(session);
    if (!priceId) {
      console.log('[Blueprint Stripe Webhook] checkout.session.completed with no resolvable price; skipping grant for user', userId);
      return { action: 'skipped', reason: 'missing_price', userId, promoRecorded };
    }

    const tier = PRICE_TO_TIER[priceId];
    if (!tier) {
      console.log('[Blueprint Stripe Webhook] Unknown price id', priceId, 'for user', userId, '; skipping grant');
      return { action: 'skipped', reason: 'unknown_price', userId, promoRecorded };
    }

    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as { id: string } | undefined;
    if (!existing) {
      console.log('[Blueprint Stripe Webhook] client_reference_id', userId, 'does not match any user; skipping grant');
      return { action: 'skipped', reason: 'unknown_user', userId, promoRecorded };
    }

    const customerId = idOf(session.customer);
    const subscriptionId = idOf(session.subscription);
    db.prepare(
      "UPDATE users SET subscription_tier = ?, stripe_customer_id = ?, stripe_subscription_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(tier, customerId, subscriptionId, userId);
    console.log('[Blueprint Stripe Webhook] Granted', tier, 'to user', userId, '(price', priceId + ', sub', subscriptionId + ')');
    return { action: 'granted', userId, tier, promoRecorded };
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
      console.log('[Blueprint Stripe Webhook] No user found for subscription', subscriptionId, '/ customer', customerId);
      return { action: 'skipped', reason: 'no_matching_user' };
    }

    // Idempotency: a repeated cancellation for an already-revoked user is a no-op.
    if (user.subscription_tier === 'FREE' && !user.stripe_subscription_id) {
      return { action: 'skipped', reason: 'already_revoked', userId: user.id };
    }

    db.prepare(
      "UPDATE users SET subscription_tier = 'FREE', stripe_subscription_id = NULL, updated_at = datetime('now') WHERE id = ?"
    ).run(user.id);
    console.log('[Blueprint Stripe Webhook] Revoked entitlement for user', user.id, '(subscription', subscriptionId, 'status', subscription.status + ')');
    return { action: 'revoked', userId: user.id, tier: 'FREE' };
  }

  return { action: 'ignored', reason: `unhandled_event:${event.type}` };
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
  (req: Request, res: Response) => {
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
        console.warn('[Blueprint Stripe Webhook] STRIPE_WEBHOOK_SECRET not set — skipping signature verification (dev/test only)');
        const raw = Buffer.isBuffer(req.body) ? req.body.toString() : JSON.stringify(req.body ?? {});
        event = JSON.parse(raw) as Stripe.Event;
      }
    } catch (err: any) {
      console.error('[Blueprint Stripe Webhook] Verification failed:', err.message);
      res.status(400).json({ error: 'Webhook error' });
      return;
    }

    try {
      const outcome = handleStripeEvent(event);
      res.json({ received: true, ...outcome });
    } catch (err: any) {
      // Stripe retries non-2xx responses; a DB failure here is worth retrying.
      console.error('[Blueprint Stripe Webhook] Handler failed:', err.message);
      res.status(500).json({ error: 'Webhook handler failed' });
    }
  }
);

export default router;
