import express, { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { getDb } from '../db.js';

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

router.post('/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string | undefined;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: Stripe.Event;
  try {
    if (webhookSecret) {
      if (!sig) {
        res.status(400).json({ error: 'Missing stripe-signature header' });
        return;
      }
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } else {
      event = JSON.parse(req.body.toString()) as Stripe.Event;
    }
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err instanceof Error ? err.message : err);
    res.status(400).json({ error: 'Webhook signature verification failed' });
    return;
  }

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
        console.log('[Stripe Webhook] Recorded promo redemption: ' + promoCode + ' for ' + product + '/' + tier + '/' + interval);
      } catch (err) {
        console.error('[Stripe Webhook] Failed to record promo redemption:', err instanceof Error ? err.message : err);
      }
    }
  }

  res.json({ received: true });
});

export default router;
