// blueprint-app/server/src/stripePricing.ts
//
// Server-side, hardcoded mapping from Stripe price IDs to Blueprint tiers.
//
// SECURITY: entitlement is derived from the price the customer ACTUALLY PAID,
// never from anything the user can supply. `client_reference_id` only carries
// the user id — never a tier. The webhook reads `line_items[0].price.id` off the
// `checkout.session.completed` event and looks it up here.
//
// This is the Blueprint product's own catalog slice of the Standard Stripe
// account (see /home/team/shared/stripe-payment-links.md). Blueprint has NO
// self-serve Agency price — Agency is "Contact for pricing" — so only the four
// Solo/Team prices below are recognised. Any other price id is ignored (a
// Pipeline or Audit price must never grant Blueprint access).
//
// Price IDs (Blueprint product):
//   price_1UMFmGDHbZkO7vsGWsgShwYP  → SOLO  (Solo Monthly, $59/mo)
//   price_1UMFmGDHbZkO7vsGhvtmzYng  → SOLO  (Solo Yearly, $566/yr)
//   price_1UMFmGDHbZkO7vsG4raaQeAb  → TEAM  (Team Monthly, $149/mo)
//   price_1UMFmIDHbZkO7vsGoNN5rw7Q  → TEAM  (Team Yearly, $1,430/yr)

export type BlueprintTier = 'SOLO' | 'TEAM';

export const PRICE_TO_TIER: Record<string, BlueprintTier> = {
  // Solo
  price_1UMFmGDHbZkO7vsGWsgShwYP: 'SOLO', // Solo Monthly — $59/mo
  price_1UMFmGDHbZkO7vsGhvtmzYng: 'SOLO', // Solo Yearly — $566/yr
  // Team
  price_1UMFmGDHbZkO7vsG4raaQeAb: 'TEAM', // Team Monthly — $149/mo
  price_1UMFmIDHbZkO7vsGoNN5rw7Q: 'TEAM', // Team Yearly — $1,430/yr
};

/** The tiers a paying customer can be granted. FREE is the default/no-plan state. */
export type EntitledTier = BlueprintTier | 'FREE';
