import express, { Router, type Request, type Response } from 'express';
import Stripe from 'stripe';
import { getDb } from '../db.js';
import { PRICE_TO_TIER } from '../stripePricing.js';

// NOTE: we deliberately do NOT construct a Stripe client — the managed account
// exposes no API key. Signature verification uses the STATIC
// `Stripe.webhooks.constructEvent`, which the package wires to Node platform
// functions (including the Node crypto provider) at import time, so it needs no
// key and no instance. In dev (STRIPE_WEBHOOK_SECRET unset) we fall back to a
// raw-body parse, mirroring the monolith.

// Helpers to safely coerce Stripe expandable IDs (string | object) to a string.
function customerIdOf(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null {
  if (!customer) return null;
  if (typeof customer === 'string') return customer;
  return customer.id ?? null;
}

function subscriptionIdOf(
  sub: string | Stripe.Subscription | null | undefined,
): string | null {
  if (!sub) return null;
  if (typeof sub === 'string') return sub;
  return sub.id ?? null;
}

/**
 * Resolve the price actually paid for a Checkout Session.
 *
 * `checkout.session.completed` normally includes `line_items` automatically;
 * we fall back to `metadata.price_id` (set server-side, never user-controlled)
 * if line_items are absent. We deliberately do NOT read the tier from metadata
 * or client_reference_id — the tier must come from the price that was paid.
 */
function sessionPriceId(session: Stripe.Checkout.Session): string | null {
  const lineItems: any = (session as any).line_items;
  const items: any[] = Array.isArray(lineItems) ? lineItems : lineItems?.data;
  if (items && items.length) {
    const priceId = items[0]?.price?.id;
    if (priceId) return priceId;
  }
  const meta = (session.metadata || {}) as Record<string, string>;
  return meta.price_id || null;
}

const router = Router();

router.post('/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers['stripe-signature'] as string | undefined;
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;
  try {
    if (secret) {
      if (!sig) {
        res.status(400).json({ error: 'Missing stripe-signature header' });
        return;
      }
      // Static verification — no Stripe instance required.
      event = Stripe.webhooks.constructEvent(req.body, sig, secret);
    } else {
      // Dev fallback: no webhook secret configured — trust the raw body.
      event = JSON.parse(req.body.toString()) as Stripe.Event;
    }
  } catch (err: any) {
    console.error('[Pipeline Stripe Webhook] Error:', err.message);
    res.status(400).json({ error: 'Webhook error' });
    return;
  }

  // --- checkout.session.completed: grant entitlement ------------------------
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.client_reference_id || null;
    const priceId = sessionPriceId(session);
    const customerId = customerIdOf(session.customer);
    const subscriptionId = subscriptionIdOf(session.subscription);

    if (!userId) {
      console.log('[Pipeline Stripe Webhook] checkout.session.completed without client_reference_id; skipping entitlement grant');
    } else if (!priceId) {
      console.log('[Pipeline Stripe Webhook] checkout.session.completed with no resolvable price; skipping grant for user', userId);
    } else {
      const tier = PRICE_TO_TIER[priceId];
      if (!tier) {
        console.log('[Pipeline Stripe Webhook] Unknown price id', priceId, 'for user', userId, '; skipping grant');
      } else {
        try {
          getDb().prepare(
            "UPDATE users SET subscription_tier = ?, stripe_customer_id = ?, stripe_subscription_id = ?, updated_at = datetime('now') WHERE id = ?",
          ).run(tier, customerId, subscriptionId, userId);
          console.log('[Pipeline Stripe Webhook] Granted', tier, 'to user', userId, '(price', priceId + ', sub', subscriptionId + ')');
        } catch (e: any) {
          console.error('[Pipeline Stripe Webhook] Failed to grant tier:', e.message);
        }
      }
    }
  }

  // --- subscription canceled / unpaid: revoke entitlement --------------------
  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    const revoke =
      event.type === 'customer.subscription.deleted' ||
      ['canceled', 'unpaid'].includes(subscription.status);

    if (revoke) {
      const subscriptionId = subscription.id;
      const customerId = customerIdOf(subscription.customer);
      try {
        const db = getDb();
        const user = db.prepare(
          'SELECT id FROM users WHERE stripe_subscription_id = ? OR stripe_customer_id = ? LIMIT 1',
        ).get(subscriptionId, customerId) as { id: string } | undefined;

        if (user) {
          db.prepare(
            "UPDATE users SET subscription_tier = 'FREE', stripe_subscription_id = NULL, updated_at = datetime('now') WHERE id = ?",
          ).run(user.id);
          console.log('[Pipeline Stripe Webhook] Revoked entitlement for user', user.id, '(subscription', subscriptionId, 'status', subscription.status + ')');
        } else {
          console.log('[Pipeline Stripe Webhook] No user found for subscription', subscriptionId, '/ customer', customerId);
        }
      } catch (e: any) {
        console.error('[Pipeline Stripe Webhook] Failed to revoke entitlement:', e.message);
      }
    }
  }

  res.json({ received: true });
});

export default router;
