// Pipeline pricing tiers. Single source of truth for the Pipeline product.
// Values mirror the ratified business plan:
//   Pipeline: Solo $79/mo ($758/yr) · Team $199/mo ($1,910/yr) · Agency "Contact for Pricing"
//   (7-day free trial built into Solo/Team — handled server-side at signup).
//
// Checkout is handled by hosted Stripe Payment Links. When a visitor is signed
// in we append `?client_reference_id=<userId>` (see checkoutHref) so the Stripe
// webhook knows WHO paid; the entitlement tier is always derived server-side
// from the price actually paid (server/src/stripePricing.ts), never from this
// URL. There is no Stripe link for Agency — Pipeline has no Agency self-serve
// price, so that tier stays a sales conversation.

/** Hosted Stripe Payment Links for the Pipeline product. */
export const STRIPE_PAYMENT_LINKS = {
  soloMonthly: 'https://buy.stripe.com/bJe6oH1b19APaAqa929Zm09',
  soloYearly: 'https://buy.stripe.com/cNi7sL2f55kz23U4OI9Zm0a',
  teamMonthly: 'https://buy.stripe.com/aFacN59Hx9APcIygxq9Zm0b',
  teamYearly: 'https://buy.stripe.com/14A14ng5VeV94c2epi9Zm0c',
} as const;

export interface Plan {
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  /** Primary CTA href. In-app free-trial signup (`/pipeline/register`) or `mailto:`. */
  href: string;
  /** Hosted Stripe Payment Link — monthly price (paid tiers only). */
  monthlyHref?: string;
  /** Hosted Stripe Payment Link — annual price (paid tiers only). */
  yearlyHref?: string;
  featured: boolean;
  tagline?: string;
  yearly?: string;
  contactEmail?: string;
}

export const PIPELINE_PLANS: Plan[] = [
  {
    name: 'Solo',
    price: '$79',
    period: '/mo',
    yearly: '$758/yr',
    tagline: '7-day free trial included',
    features: ['Case study generator', 'Cold pitch builder', '10 case studies/month', '20 pitches/month', 'Email support'],
    cta: 'Get Started',
    href: '/pipeline/register',
    monthlyHref: STRIPE_PAYMENT_LINKS.soloMonthly,
    yearlyHref: STRIPE_PAYMENT_LINKS.soloYearly,
    featured: false,
  },
  {
    name: 'Team',
    price: '$199',
    period: '/mo',
    yearly: '$1,910/yr',
    tagline: '7-day free trial included',
    features: ['Everything in Solo', 'Unlimited case studies', 'Unlimited pitches', 'Team collaboration', 'Priority support'],
    cta: 'Get Started',
    href: '/pipeline/register',
    monthlyHref: STRIPE_PAYMENT_LINKS.teamMonthly,
    yearlyHref: STRIPE_PAYMENT_LINKS.teamYearly,
    featured: true,
  },
  {
    name: 'Agency',
    price: 'Contact for Pricing',
    period: '',
    features: ['Everything in Team', 'White-labeling', 'API access', 'Custom pricing', 'Dedicated support'],
    cta: 'Contact Us',
    href: 'mailto:sales@nuria.firstcreationmedia.com',
    contactEmail: 'sales@nuria.firstcreationmedia.com',
    featured: false,
  },
];

/**
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
