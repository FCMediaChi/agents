import express, { Router, Request, Response } from 'express';
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
        getDb().prepare(
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
    const priceId = sessionPriceId(session);
    const customerId = customerIdOf(session.customer);
    const subscriptionId = subscriptionIdOf(session.subscription);

    if (!userId) {
      console.log('[Stripe Webhook] checkout.session.completed without client_reference_id; skipping entitlement grant (promo-only checkout)');
    } else if (!priceId) {
      console.log('[Stripe Webhook] checkout.session.completed with no resolvable price; skipping grant for user', userId);
    } else if (priceId === AUDIT_SINGLE_PRICE_ID) {
      // One-time "Single Use" audit — grant exactly one full-audit credit
      // instead of a permanent tier. See audit/routes/audit.ts + audit_usage.
      // We deliberately do NOT set stripe_customer_id / stripe_subscription_id
      // here: there is no recurring subscription to revoke, and writing the
      // one-time customer id could clobber the id of a concurrent subscription.
      try {
        const db = getDb();
        const existing = db.prepare('SELECT paid_audits FROM audit_usage WHERE user_id = ?').get(userId) as any;
        if (existing) {
          db.prepare('UPDATE audit_usage SET paid_audits = paid_audits + 1 WHERE user_id = ?').run(userId);
        } else {
          db.prepare("INSERT INTO audit_usage (user_id, audits_run, paid_audits, last_audit_at) VALUES (?, 0, 1, NULL)").run(userId);
        }
        console.log('[Stripe Webhook] Granted 1 paid audit credit to user', userId);
      } catch (e: any) {
        console.error('[Stripe Webhook] Failed to grant audit credit:', e.message);
      }
    } else {
      const entitledTier = PRICE_TO_TIER[priceId];
      if (!entitledTier) {
        console.log('[Stripe Webhook] Unknown price id', priceId, 'for user', userId, '; skipping grant');
      } else {
        try {
          getDb().prepare(
            "UPDATE users SET subscription_tier = ?, stripe_customer_id = ?, stripe_subscription_id = ?, updated_at = datetime('now') WHERE id = ?"
          ).run(entitledTier, customerId, subscriptionId, userId);
          console.log('[Stripe Webhook] Granted', entitledTier, 'to user', userId, '(price', priceId + ', sub', subscriptionId + ')');
        } catch (e: any) {
          console.error('[Stripe Webhook] Failed to grant tier:', e.message);
        }
      }
    }
  }

  // --- Subscription canceled / unpaid: revoke entitlement --------------------
  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    const revoke = event.type === 'customer.subscription.deleted' ||
      ['canceled', 'unpaid'].includes(subscription.status);

    if (revoke) {
      const subscriptionId = subscription.id;
      const customerId = customerIdOf(subscription.customer);
      try {
        const db = getDb();
        const user = db.prepare(
          'SELECT id FROM users WHERE stripe_subscription_id = ? OR stripe_customer_id = ? LIMIT 1'
        ).get(subscriptionId, customerId) as { id: string } | undefined;

        if (user) {
          db.prepare(
            "UPDATE users SET subscription_tier = 'FREE', stripe_subscription_id = NULL, updated_at = datetime('now') WHERE id = ?"
          ).run(user.id);
          console.log('[Stripe Webhook] Revoked entitlement for user', user.id, '(subscription', subscriptionId, 'status', subscription.status + ')');
        } else {
          console.log('[Stripe Webhook] No user found for subscription', subscriptionId, '/ customer', customerId);
        }
      } catch (e: any) {
        console.error('[Stripe Webhook] Failed to revoke entitlement:', e.message);
      }
    }
  }

  res.json({ received: true });
});

export default router;
