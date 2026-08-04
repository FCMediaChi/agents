import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { getDb } from '../db.js';

// Stripe client — initialized lazily so the server can start without STRIPE_SECRET_KEY
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
    _stripe = new Stripe(key);
  }
  return _stripe;
}

// Cache: map "product:tier:interval" → price_id, refreshed lazily
let priceCache: Record<string, string> | null = null;
let priceCacheExpiresAt = 0;

/**
 * Discover Stripe price IDs at runtime by listing prices + products,
 * then matching by product name keywords.
 *
 * Product names must contain a product-line keyword ("Blueprint" or "Pipeline"),
 * a tier keyword ("Solo" / "Team"), and an interval keyword ("Monthly" / "Yearly").
 *
 * Results are cached for 5 minutes to avoid hitting Stripe on every request.
 */
async function discoverPrices(): Promise<Record<string, string>> {
  const now = Date.now();
  if (priceCache && now < priceCacheExpiresAt) {
    return priceCache;
  }

  const stripe = getStripe();

  // Pull all active recurring prices and expand product data
  const prices = await stripe.prices.list({
    limit: 50,
    active: true,
    expand: ['data.product'],
  });

  const tierKeywords = ['Solo', 'Team', 'Single', 'Agency'];
  const intervalKeywords = ['Monthly', 'Yearly', 'One-Time', 'One-time', 'one-time'];
  const productLineKeywords = [
    { keyword: 'Blueprint', prefix: 'blueprint' },
    { keyword: 'Pipeline', prefix: 'pipeline' },
    { keyword: 'Audit', prefix: 'audit' },
  ];

  const map: Record<string, string> = {};

  for (const price of prices.data) {
    const product = price.product as Stripe.Product;
    const name = product?.name ?? '';

    // Determine which product line this belongs to
    const productLine = productLineKeywords.find((pl) =>
      name.toLowerCase().includes(pl.keyword.toLowerCase())
    );
    if (!productLine) continue;

    const tier = tierKeywords.find((k) =>
      name.toLowerCase().includes(k.toLowerCase())
    );
    const interval = intervalKeywords.find((k) =>
      name.toLowerCase().includes(k.toLowerCase())
    );

    if (tier && interval) {
      const tierKey = tier.toLowerCase() === 'single' ? 'single' : tier.toLowerCase();
      let intervalKey: string;
      if (['one-time', 'one_time'].includes(interval.toLowerCase().replace('-', '_'))) {
        intervalKey = 'one-time';
      } else {
        intervalKey = interval.toLowerCase();
      }
      const key = `${productLine.prefix}:${tierKey}:${intervalKey}`;
      if (!map[key]) {
        map[key] = price.id;
      }
    }
  }

  priceCache = map;
  priceCacheExpiresAt = now + 5 * 60 * 1000; // 5-minute cache
  return map;
}

const router = Router();

// POST /api/create-checkout-session
router.post('/create-checkout-session', async (req: Request, res: Response) => {
  try {
    const { product = 'blueprint', tier, interval, promo_code } = req.body as {
      product?: string;
      tier: string;
      interval: string;
      promo_code?: string;
    };

    // Map user-facing promo codes to Stripe coupon IDs
    const PROMO_CODE_MAP: Record<string, string> = {
      'NURIABETA50': 'bjDsBixa',
    };
    const stripeCouponId = promo_code ? (PROMO_CODE_MAP[promo_code] || promo_code) : undefined;

    if (!tier || !interval) {
      return res.status(400).json({ error: 'tier and interval are required' });
    }

    if (!['blueprint', 'pipeline', 'audit'].includes(product)) {
      return res.status(400).json({ error: 'Invalid product. Must be "blueprint", "pipeline", or "audit".' });
    }

    const validTiers = product === 'audit' ? ['single', 'team', 'agency'] : ['solo', 'team'];
    if (!validTiers.includes(tier)) {
      return res.status(400).json({ error: `Invalid tier for ${product}. Must be one of: ${validTiers.join(', ')}.` });
    }

    const validIntervals = product === 'audit' ? ['one-time', 'monthly', 'yearly'] : ['monthly', 'yearly'];
    if (!validIntervals.includes(interval)) {
      return res.status(400).json({ error: `Invalid interval for ${product}. Must be one of: ${validIntervals.join(', ')}.` });
    }

    // Check promo code redemption cap (max 3 per code+product+tier+interval)
    // Must happen BEFORE discoverPrices() so it works without Stripe configured
    if (promo_code) {
      const db = getDb();
      const redemptions = db.prepare(
        'SELECT COUNT(*) as count FROM promo_redemptions WHERE code = ? AND product = ? AND tier = ? AND interval = ?'
      ).get(promo_code, product, tier, interval) as any;
      if (redemptions && redemptions.count >= 3) {
        return res.status(400).json({
          error: 'Beta spots for this tier have been filled.',
        });
      }
    }

    const prices = await discoverPrices();
    const priceId = prices[`${product}:${tier}:${interval}`];

      // Fallback: Audit Single Use uses a hosted payment link
      if (product === 'audit' && tier === 'single' && interval === 'one-time') {
        return res.json({ url: 'https://buy.stripe.com/6oU28r9UEenG8YIda6fAc02' });
      }

    if (!priceId) {
      console.error('[Checkout] No price found for', product, tier, interval, 'available keys:', Object.keys(prices));
      return res.status(400).json({
        error: `No Stripe price found for ${product} ${tier} ${interval}. Ensure products exist in Stripe with the correct names.`,
      });
    }

    // Determine mode: one-time payment for Audit single, subscription for everything else
    const mode: 'payment' | 'subscription' =
      (product === 'audit' && interval === 'one-time') ? 'payment' : 'subscription';

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: 'https://nuriaai.ctonew.app/app?checkout=success',
      cancel_url: 'https://nuriaai.ctonew.app?checkout=canceled',
    };

    // Add promo code / discount if provided
    if (stripeCouponId) {
      sessionParams.discounts = [{ coupon: stripeCouponId }];
    }

    // Attach metadata for webhook redemption tracking
    sessionParams.metadata = {
      promo_code: promo_code || '',
      product,
      tier,
      interval,
    };

    // Subscription-specific fields
    if (mode === 'subscription') {
      sessionParams.subscription_data = {
        trial_period_days: 7,
      };
    }

    try {
      const session = await getStripe().checkout.sessions.create(sessionParams);
      res.json({ url: session.url });
    } catch (stripeError) {
      // Check if this was a coupon/promo code error
      const errMsg = stripeError instanceof Error ? stripeError.message : String(stripeError);
      if (promo_code && (errMsg.includes('coupon') || errMsg.includes('promo') || errMsg.includes('discount') || errMsg.includes('No such coupon'))) {
        return res.status(400).json({ error: 'Invalid or expired promo code' });
      }
      throw stripeError; // re-throw for the outer catch
    }
  } catch (err) {
    console.error('[Checkout] Error:', err);
    const message = err instanceof Error ? err.message : 'Failed to create checkout session';
    res.status(500).json({ error: message });
  }
});

export default router;
