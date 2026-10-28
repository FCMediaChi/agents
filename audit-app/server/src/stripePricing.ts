// audit-app/server/src/stripePricing.ts
//
// Server-side, hardcoded mapping from Stripe price IDs to Audit tiers.
//
// SECURITY: entitlement is derived from the price the customer ACTUALLY PAID,
// never from anything the user can supply. `client_reference_id` only carries
// the user id — never a tier. The webhook reads `line_items[0].price.id` off the
// `checkout.session.completed` event and looks it up here.
//
// This is the Audit product's own catalog slice of the Standard Stripe account
// (see /home/team/shared/stripe-payment-links.md). It is deliberately a
// separate file from the Pipeline/Blueprint slices: a Blueprint or Pipeline
// price must never grant Audit access, and vice versa.
//
// Price IDs (Nuria Website Audit product):
//   price_1UMFmGDHbZkO7vsGyuNy7vVD  → ONE-TIME  (Single Use, $29 — mode 'payment')
//   price_1UMFmHDHbZkO7vsGpaVQn8ya  → TEAM      (Team Monthly, $49/mo)
//   price_1UMFmHDHbZkO7vsGXU6dF8gO  → TEAM      (Team Yearly, $470/yr)
//   price_1UMFmHDHbZkO7vsGhoLAc7JP  → AGENCY    (Agency Monthly, $79/mo)
//   price_1UMFmHDHbZkO7vsGc3QI8wsV  → AGENCY    (Agency Yearly, $755/yr)

/** Recurring tiers a paying Audit customer can be granted. FREE is the default. */
export type AuditTier = 'TEAM' | 'AGENCY';

/**
 * Recurring subscription prices → persistent subscription_tier value.
 * Audit's gating is binary (`subscription_tier !== 'FREE'` ⇒ premium: full
 * 7-dimension audit, unlimited runs), so TEAM and AGENCY differ only in
 * branding/limits elsewhere, not in what the audit engine produces.
 */
export const PRICE_TO_TIER: Record<string, AuditTier> = {
  // Team
  price_1UMFmHDHbZkO7vsGpaVQn8ya: 'TEAM', // Team Monthly — $49/mo
  price_1UMFmHDHbZkO7vsGXU6dF8gO: 'TEAM', // Team Yearly — $470/yr
  // Agency
  price_1UMFmHDHbZkO7vsGhoLAc7JP: 'AGENCY', // Agency Monthly — $79/mo
  price_1UMFmHDHbZkO7vsGc3QI8wsV: 'AGENCY', // Agency Yearly — $755/yr
};

/**
 * One-time "Single Use" audit ($29, Checkout mode 'payment').
 *
 * This is NOT a tier: it buys a single full audit, so the webhook grants one
 * `audit_usage.paid_audits` credit instead of writing `subscription_tier`.
 * See routes/webhooks.ts and the credit consumption in routes/audit.ts.
 */
export const SINGLE_USE_PRICE_ID = 'price_1UMFmGDHbZkO7vsGyuNy7vVD';

/** Every price id this app recognises (used by tests + startup logging). */
export const KNOWN_PRICE_IDS: string[] = [...Object.keys(PRICE_TO_TIER), SINGLE_USE_PRICE_ID];
