// server/src/stripePricing.ts
//
// Server-side, hardcoded mapping from Stripe price IDs to Pipeline subscription tiers.
//
// SECURITY: entitlement is derived from the price the customer ACTUALLY PAID,
// never from anything the user can supply. The webhook reads
// `line_items[0].price.id` off the `checkout.session.completed` event (falling
// back to `metadata.price_id`) and looks it up here. `client_reference_id` only
// ever carries the user id — never a tier.
//
// Price IDs are the `default_price` values from the Standard Stripe account's
// recreated catalog (see /home/team/shared/stripe-payment-links.md, 2026-10-01).

export type EntitledTier = 'SOLO' | 'TEAM';

export const PRICE_TO_TIER: Record<string, EntitledTier> = {
  // Pipeline — Solo
  'price_1UMFmHDHbZkO7vsGLYd7xr1g': 'SOLO', // Solo Monthly
  'price_1UMFmHDHbZkO7vsGcNy4UDba': 'SOLO', // Solo Yearly
  // Pipeline — Team
  'price_1UMFmHDHbZkO7vsG7QXxGfGj': 'TEAM', // Team Monthly
  'price_1UMFmIDHbZkO7vsGeUWSMXxO': 'TEAM', // Team Yearly
};
