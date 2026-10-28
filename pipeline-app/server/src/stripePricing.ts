// pipeline-app/server/src/stripePricing.ts
//
// Server-side, hardcoded mapping from Stripe price IDs to Pipeline tiers.
//
// SECURITY: entitlement is derived from the price the customer ACTUALLY PAID,
// never from anything the user can supply. `client_reference_id` only carries
// the user id — never a tier. The webhook reads `line_items[0].price.id` off the
// `checkout.session.completed` event and looks it up here.
//
// This is the Pipeline product's own catalog slice of the Standard Stripe
// account (see /home/team/shared/stripe-payment-links.md). Pipeline has NO
// Agency self-serve price — Agency is "Contact for Pricing" — so only the four
// Solo/Team prices below are recognised. Any other price id is ignored.
//
// Price IDs (Pipeline product):
//   price_1UMFmHDHbZkO7vsGLYd7xr1g  → SOLO  (Solo Monthly, $79/mo)
//   price_1UMFmHDHbZkO7vsGcNy4UDba  → SOLO  (Solo Yearly, $758/yr)
//   price_1UMFmHDHbZkO7vsG7QXxGfGj  → TEAM  (Team Monthly, $199/mo)
//   price_1UMFmIDHbZkO7vsGeUWSMXxO  → TEAM  (Team Yearly, $1,910/yr)

export type PipelineTier = 'SOLO' | 'TEAM';

export const PRICE_TO_TIER: Record<string, PipelineTier> = {
  // Solo
  price_1UMFmHDHbZkO7vsGLYd7xr1g: 'SOLO', // Solo Monthly
  price_1UMFmHDHbZkO7vsGcNy4UDba: 'SOLO', // Solo Yearly
  // Team
  price_1UMFmHDHbZkO7vsG7QXxGfGj: 'TEAM', // Team Monthly
  price_1UMFmIDHbZkO7vsGeUWSMXxO: 'TEAM', // Team Yearly
};
