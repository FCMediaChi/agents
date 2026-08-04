import express, { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { getDb } from '../db.js';

// Lazy Stripe init (same pattern as checkout.ts)
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
    _stripe = new Stripe(key);
  }
  return _stripe;
}

const router = Router();

// Stripe webhook handler — raw body required for signature verification.
// Must be mounted BEFORE express.json() in index.ts so the body stream
// is still intact. The route itself handles raw body parsing.
router.post('/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string | undefined;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig) {
    res.status(400).json({ error: 'Missing stripe-signature header' });
    return;
  }

  if (!webhookSecret) {
    res.status(500).json({ error: 'Webhook secret not configured' });
    return;
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(
      req.body, // express.raw() gives us the raw Buffer
      sig,
      webhookSecret
    );
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err instanceof Error ? err.message : err);
    res.status(400).json({ error: 'Webhook signature verification failed' });
    return;
  }

  // Handle checkout.session.completed — record promo code redemption
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata || {};
    const promoCode = metadata.promo_code;
    const product = metadata.product;
    const tier = metadata.tier;
    const interval = metadata.interval;

    if (promoCode && product && tier && interval) {
      try {
        const db = getDb();
        db.prepare(
          'INSERT INTO promo_redemptions (code, product, tier, interval) VALUES (?, ?, ?, ?)'
        ).run(promoCode, product, tier, interval);
        console.log(`[Stripe Webhook] Recorded promo redemption: ${promoCode} for ${product}/${tier}/${interval}`);
      } catch (err) {
        console.error('[Stripe Webhook] Failed to record promo redemption:', err instanceof Error ? err.message : err);
      }
    }
  }

  res.json({ received: true });
});

export default router;
