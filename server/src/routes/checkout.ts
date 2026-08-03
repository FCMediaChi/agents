import { Router, Request, Response } from 'express';
import Stripe from 'stripe';

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

  const tierKeywords = ['Solo', 'Team'];
  const intervalKeywords = ['Monthly', 'Yearly'];
  const productLineKeywords = [
    { keyword: 'Blueprint', prefix: 'blueprint' },
    { keyword: 'Pipeline', prefix: 'pipeline' },
  ];

  const map: Record<string, string> = {};

  for (const price of prices.data) {
    if (!price.recurring) continue; // must be a subscription price

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
      const key = `${productLine.prefix}:${tier.toLowerCase()}:${interval.toLowerCase()}`;
      // Prefer the first matched price per key (deterministic from API order)
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
    const { product = 'blueprint', tier, interval } = req.body as {
      product?: string;
      tier: string;
      interval: string;
    };

    if (!tier || !interval) {
      return res.status(400).json({ error: 'tier and interval are required' });
    }

    if (!['blueprint', 'pipeline'].includes(product)) {
      return res.status(400).json({ error: 'Invalid product. Must be "blueprint" or "pipeline".' });
    }

    if (!['solo', 'team'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier. Must be "solo" or "team".' });
    }

    if (!['monthly', 'yearly'].includes(interval)) {
      return res.status(400).json({ error: 'Invalid interval. Must be "monthly" or "yearly".' });
    }

    const prices = await discoverPrices();
    const priceId = prices[`${product}:${tier}:${interval}`];

    if (!priceId) {
      console.error('[Checkout] No price found for', product, tier, interval, 'available keys:', Object.keys(prices));
      return res.status(400).json({
        error: `No Stripe price found for ${product} ${tier} ${interval}. Ensure products exist in Stripe with "${product === 'pipeline' ? 'Pipeline' : 'Blueprint'}" in the name and "Solo"/"Team" + "Monthly"/"Yearly" keywords.`,
      });
    }

    const session = await getStripe().checkout.sessions.create({
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
