// Blueprint pricing — the single source of truth for this app.
// Values mirror the ratified business plan:
//   Free $0 (1 project, lifetime)
//   Solo $59/mo or $566/yr (5 projects per month)
//   Team $149/mo or $1,430/yr (10 projects per month + premium features)
//   Agency "Contact for pricing" (unlimited projects + white-labeling + premium features)
//
// Checkout wiring (Stripe Payment Links + webhook entitlement) lands in Phase 4;
// the hrefs here are the same hosted links the monolith used, so no price is
// hardcoded in a component.

export interface Plan {
  name: string;
  price: string; // "$59" or "Contact for pricing"
  period: string; // "/ month", "/ forever", ""
  features: string[];
  cta: string;
  href: string;
  featured: boolean;
  // UI extras
  tagline?: string;
  desc?: string;
  yearlyCta?: string; // optional linked label for the annual summary
  yearlyPrice?: string; // Blueprint annual checkout label, e.g. "$566"
  yearlyHref?: string; // Blueprint annual checkout URL
  contactEmail?: string; // visible email address shown beneath a mailto CTA
}

const STRIPE = {
  // Blueprint checkout links (recreated 2026-10-01 after the Express→Standard Stripe switch)
  soloMonthly: 'https://buy.stripe.com/bJefZh06XeV9dMC1Cw9Zm00',
  soloYearly: 'https://buy.stripe.com/28E00j6vl6oDbEucha9Zm01',
  teamMonthly: 'https://buy.stripe.com/eVq3cvdXN7sH5g6dle9Zm02',
  teamYearly: 'https://buy.stripe.com/3cIdR9f1R7sH4c20ys9Zm03',
};

export const SUPPORT_EMAIL = 'support@nuria.firstcreationmedia.com';

/**
 * Build a checkout href for a plan CTA.
 *
 * When the user is authenticated, append `?client_reference_id=<userId>` to a
 * hosted Stripe Payment Link so Stripe stamps the user id onto the Checkout
 * Session. The webhook then reads `client_reference_id` to know WHO paid and
 * derives the tier from the PRICE actually paid (server-side) — the tier is
 * never placed in this URL (user-controllable). Anonymous visitors and
 * non-Stripe hrefs (anchors, mailto:, internal paths) are returned unchanged.
 */
export function checkoutHref(href: string | undefined, userId?: string | null): string | undefined {
  if (!href || !userId) return href;
  if (!href.startsWith('https://buy.stripe.com/')) return href;
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}client_reference_id=${encodeURIComponent(userId)}`;
}

export const PRICING = {
  blueprint: {
    free: {
      name: 'Free',
      price: '$0',
      period: '/ forever',
      tagline: 'For exploring the tool',
      features: [
        '1 project (lifetime)',
        '1 user seat',
        'Sitemap builder',
        'Page outlines',
        'Basic wireframe blocks',
        'Content questionnaires',
      ],
      cta: 'Get Started',
      href: '/signup',
      featured: false,
    },
    solo: {
      name: 'Solo',
      price: '$59',
      period: '/ month',
      tagline: 'For freelance designers',
      features: [
        '5 projects per month',
        '1 user seat',
        'Advanced wireframe blocks (50+)',
        'PDF proposal export',
        'Custom proposal branding',
        'Email support',
      ],
      cta: 'Start Monthly',
      href: STRIPE.soloMonthly,
      yearlyPrice: '$566',
      yearlyHref: STRIPE.soloYearly,
      featured: false,
    },
    team: {
      name: 'Team',
      price: '$149',
      period: '/ month',
      tagline: 'For small agencies',
      features: [
        '10 projects per month',
        'Up to 5 user seats',
        'Everything in Solo, plus:',
        'Invite team members & clients',
        'Client-facing portal',
        'Comment & approval workflow',
        'Interactive HTML export',
        'Google Docs / Word export',
        'Sitemap template library (10 industries)',
        '50+ wireframe block templates',
        'Industry-specific questionnaire bundles',
        'Priority support',
      ],
      cta: 'Start Monthly',
      href: STRIPE.teamMonthly,
      yearlyPrice: '$1,430',
      yearlyHref: STRIPE.teamYearly,
      featured: true,
    },
    agency: {
      name: 'Agency',
      price: 'Contact for pricing',
      period: '',
      tagline: 'For growing agencies',
      features: [
        'Unlimited projects',
        'Unlimited user seats',
        'Everything in Team, plus:',
        'API access (REST API + keys)',
        'Custom domain for client portals',
        'White-labeling (remove Nuria branding)',
        'Export to Webflow, WordPress & Framer',
        'Priority support',
      ],
      cta: 'Contact Us',
      href: 'mailto:sales@nuria.firstcreationmedia.com',
      contactEmail: 'sales@nuria.firstcreationmedia.com',
      featured: false,
    },
  },
};

export const BLUEPRINT_PLANS: Plan[] = [
  PRICING.blueprint.free,
  PRICING.blueprint.solo,
  PRICING.blueprint.team,
  PRICING.blueprint.agency,
];
