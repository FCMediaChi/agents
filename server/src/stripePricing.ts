// server/src/stripePricing.ts
//
// Server-side, hardcoded mapping from Stripe price IDs to subscription tiers.
//
// SECURITY: entitlement is derived from the price the customer ACTUALLY PAID,
// never from anything the user can supply (e.g. client_reference_id only carries
// the user id, never a tier). The webhook reads `line_items[0].price.id` off the
// `checkout.session.completed` event and looks it up here.
//
// Price IDs are the `default_price` values from the Standard Stripe account's
// recreated catalog (see /home/team/shared/stripe-payment-links.md, 2026-10-01).
// Blueprint and Audit only (Pipeline prices were removed when Pipeline moved to
// its own standalone app): 8 recurring subscription prices + 1 one-time
// "Audit Single Use" (handled specially — see AUDIT_SINGLE_PRICE_ID).

export type EntitledTier = 'SOLO' | 'TEAM' | 'AGENCY';

export const PRICE_TO_TIER: Record<string, EntitledTier> = {
  // Blueprint — Solo
  'price_1UMFmGDHbZkO7vsGWsgShwYP': 'SOLO', // Solo Monthly
  'price_1UMFmGDHbZkO7vsGhvtmzYng': 'SOLO', // Solo Yearly
  // Blueprint — Team
  'price_1UMFmGDHbZkO7vsG4raaQeAb': 'TEAM', // Team Monthly
  'price_1UMFmIDHbZkO7vsGoNN5rw7Q': 'TEAM', // Team Yearly
  // Audit — Team
  'price_1UMFmHDHbZkO7vsGpaVQn8ya': 'TEAM', // Team Monthly
  'price_1UMFmHDHbZkO7vsGXU6dF8gO': 'TEAM', // Team Yearly
  // Audit — Agency
  'price_1UMFmHDHbZkO7vsGhoLAc7JP': 'AGENCY', // Agency Monthly
  'price_1UMFmHDHbZkO7vsGc3QI8wsV': 'AGENCY', // Agency Yearly
};

// Audit "Single Use" ($29) is a ONE-TIME unlock, not a recurring tier. It must
// NOT set subscription_tier to a permanent premium value. Instead the webhook
// grants exactly one full-audit credit (see audit_usage.paid_audits).
export const AUDIT_SINGLE_PRICE_ID = 'price_1UMFmGDHbZkO7vsGyuNy7vVD';
