// Pipeline pricing tiers. Single source of truth for the Pipeline product.
// Values mirror the ratified business plan:
//   Pipeline: Solo $79/mo ($758/yr) · Team $199/mo ($1,910/yr) · Agency "Contact for Pricing"
//   (7-day free trial built into Solo/Team — handled server-side at signup).
//
// Checkout uses hosted Stripe Payment Links (the managed account exposes no API
// key, so there is no SDK checkout session). Links below are from
// /home/team/shared/stripe-payment-links.md (2026-10-01).

export interface Plan {
  name: string;
  price: string;
  period: string;
  yearly: string; // display string, e.g. '$758/yr' ('' for Agency)
  features: string[];
  cta: string;
  featured: boolean;
  tagline?: string;
  // Hosted Stripe Payment Link for the monthly tier (or mailto for Agency).
  monthlyHref: string;
  // Hosted Stripe Payment Link for the yearly tier (Solo/Team only).
  yearlyHref?: string;
  // Visible sales email beneath the CTA (Agency only).
  contactEmail?: string;
}

const SOLO_MONTHLY = 'https://buy.stripe.com/bJe6oH1b19APaAqa929Zm09';
const SOLO_YEARLY = 'https://buy.stripe.com/cNi7sL2f55kz23U4OI9Zm0a';
const TEAM_MONTHLY = 'https://buy.stripe.com/aFacN59Hx9APcIygxq9Zm0b';
const TEAM_YEARLY = 'https://buy.stripe.com/14A14ng5VeV94c2epi9Zm0c';

/**
 * Stamp the authenticated user id onto a hosted Stripe payment link so the
 * webhook can resolve who paid (`client_reference_id`). When the user is not
 * authenticated the link is returned unchanged — the checkout still works, it
 * just cannot be attributed server-side.
 */
export function checkoutHref(href: string, userId?: string | null): string {
  if (userId && href.startsWith('https://buy.stripe.com/')) {
    const sep = href.includes('?') ? '&' : '?';
    return `${href}${sep}client_reference_id=${encodeURIComponent(userId)}`;
  }
  return href;
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
    monthlyHref: SOLO_MONTHLY,
    yearlyHref: SOLO_YEARLY,
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
    monthlyHref: TEAM_MONTHLY,
    yearlyHref: TEAM_YEARLY,
    featured: true,
  },
  {
    name: 'Agency',
    price: 'Contact for Pricing',
    period: '',
    yearly: '',
    features: ['Everything in Team', 'White-labeling', 'API access', 'Custom pricing', 'Dedicated support'],
    cta: 'Contact Us',
    monthlyHref: 'mailto:sales@nuria.firstcreationmedia.com',
    contactEmail: 'sales@nuria.firstcreationmedia.com',
    featured: false,
  },
];
