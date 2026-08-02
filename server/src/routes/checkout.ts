import { Router, Request, Response } from 'express';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

const PRICE_MAP: Record<string, Record<string, string>> = {
  solo: {
    monthly: 'price_1Twn0UEKJMIE5u4ySFdTMiwh',
    yearly: 'price_1Twn0yEKJMIE5u4yZ28OffkX',
  },
  team: {
    monthly: 'price_1Twn1vEKJMIE5u4ytedb1Li5',
    yearly: 'price_1Twn2ZEKJMIE5u4y3WpxChvK',
  },
};

const router = Router();

// POST /api/create-checkout-session
router.post('/create-checkout-session', async (req: Request, res: Response) => {
  try {
    const { tier, interval } = req.body as { tier: string; interval: string };

    if (!tier || !interval) {
      return res.status(400).json({ error: 'tier and interval are required' });
    }

    if (!['solo', 'team'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier. Must be "solo" or "team".' });
    }

    if (!['monthly', 'yearly'].includes(interval)) {
      return res.status(400).json({ error: 'Invalid interval. Must be "monthly" or "yearly".' });
    }

    const priceId = PRICE_MAP[tier]?.[interval];
    if (!priceId) {
      return res.status(400).json({ error: 'No price configured for this tier/interval.' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 7,
      },
      success_url: 'https://nuriaai.ctonew.app/app?checkout=success',
      cancel_url: 'https://nuriaai.ctonew.app?checkout=canceled',
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[Checkout] Error:', err);
    const message = err instanceof Error ? err.message : 'Failed to create checkout session';
    res.status(500).json({ error: message });
  }
});

export default router;
