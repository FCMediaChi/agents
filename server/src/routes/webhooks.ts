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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata || {};
    const code = meta.promo_code;
    const product = meta.product;
    const tier = meta.tier;
    const interval = meta.interval;
    
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
  }

  res.json({ received: true });
});

export default router;
