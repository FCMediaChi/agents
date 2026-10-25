// Pipeline pricing tiers. Single source of truth for the Pipeline product.
// Values mirror the ratified business plan:
//   Pipeline: Solo $79/mo ($758/yr) · Team $199/mo ($1,910/yr) · Agency "Contact for Pricing"
//   (7-day free trial built into Solo/Team — handled server-side at signup).
//
// NOTE: Stripe checkout links are wired in Phase 4. For now the Solo/Team CTAs
// route to the in-app free-trial registration flow; Agency uses a mailto.

export interface Plan {
  name: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  href: string;
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
