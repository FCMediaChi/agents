// audit-app/src/lib/pricing.ts
// Single source of truth for Nuria Website Audit pricing.
// Values mirror the ratified business plan:
//   Audit: Free $0 · Single $29 (one-time) · Team $49/mo ($470/yr) · Agency $79/mo ($755/yr)

export interface Plan {
  name: string;
  price: string; // "$49" or "Contact for pricing"
  period: string; // "/mo", "one-time", "" ...
  features: string[];
  cta: string;
  href: string;
  featured: boolean;
  desc?: string;
  secondaryCta?: string; // Audit yearly CTA label
  secondaryHref?: string; // Audit yearly checkout URL
}

// Hosted Stripe payment links — what the monolith frontend actually uses for
// checkout. The connected Stripe account is STANDARD (full, supports
// subscriptions); links below were recreated 2026-10-01 after the owner's
// Express→Standard switch reset the catalog (see
// /home/team/shared/stripe-payment-links.md). Team/Agency monthly/yearly
// links now charge recurring.
const STRIPE = {
  auditSingle: 'https://buy.stripe.com/00w9ATbPF6oD7oe3KE9Zm04',
  auditTeamMonthly: 'https://buy.stripe.com/8x2aEX2f59AP7oe2GA9Zm05',
  auditTeamYearly: 'https://buy.stripe.com/4gM4gz9Hx3creQG3KE9Zm06',
  auditAgencyMonthly: 'https://buy.stripe.com/3cI00j3j914j4c25SM9Zm07',
  auditAgencyYearly: 'https://buy.stripe.com/5kQdR97zp6oD5g66WQ9Zm08',
};

export const PRICING = {
  audit: {
    free: {
      name: 'Free',
      price: '$0',
      period: '',
      desc: 'Homepage audit only',
      features: ['1 homepage-only audit', 'Single dimension report', 'No account required'],
      cta: 'Try Free',
      href: '#audit-form',
      featured: false,
    },
    single: {
      name: 'Single Use',
      price: '$29',
      period: 'one-time',
      desc: 'One-time full audit',
      features: ['Full 7-dimension report', '1 website', 'PDF export', 'Email delivery'],
      cta: 'Buy Now',
      href: STRIPE.auditSingle,
      featured: false,
    },
    team: {
      name: 'Team',
      price: '$49',
      period: '/mo',
      desc: 'Per month or $470/yr',
      features: ['Up to 10 websites', 'Up to 5 user seats', 'Full 7-dimension reports', 'Team dashboard', 'PDF exports & history', 'Priority support'],
      cta: 'Start Monthly',
      href: STRIPE.auditTeamMonthly,
      featured: true,
      secondaryCta: 'Pay Yearly',
      secondaryHref: STRIPE.auditTeamYearly,
    },
    agency: {
      name: 'Agency',
      price: '$79',
      period: '/mo',
      desc: 'Per month or $755/yr',
      features: ['Unlimited websites', 'White-labeling (no resell)', 'Client management', 'Full 7-dimension reports', 'Reports history', 'Branded PDF exports', 'Priority support'],
      cta: 'Start Monthly',
      href: STRIPE.auditAgencyMonthly,
      featured: false,
      secondaryCta: 'Pay Yearly',
      secondaryHref: STRIPE.auditAgencyYearly,
    },
  },
};

// Ordered array for the pricing grid (free → single → team → agency).
export const AUDIT_PLANS: Plan[] = [
  PRICING.audit.free,
  PRICING.audit.single,
  PRICING.audit.team,
  PRICING.audit.agency,
];
