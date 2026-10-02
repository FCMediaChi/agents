// src/lib/pricing.ts
// Single source of truth for ALL product pricing across Nuria AI's three tools.
// Edit a price here once and it updates everywhere — no more hardcoded values in
// individual components that get lost on branch switches or rebuilds.
//
// Values mirror the ratified business plan:
//   Blueprint:  Free $0 · Solo $59/mo ($566/yr) · Team $149/mo ($1,430/yr) · Agency "Contact for pricing"
//   Audit:      Free $0 · Single $29 · Team $49/mo ($470/yr) · Agency $79/mo ($755/yr)
//   Pipeline:   Solo $79/mo ($758/yr) · Team $199/mo ($1,910/yr) · Agency "Contact for Pricing" (7-day trial built into Solo/Team)

export interface Plan {
  name: string;
  price: string; // "$59" or "Contact for pricing"
  period: string; // "/ month", "/mo", "7 days", "" ...
  features: string[];
  cta: string;
  href: string;
  featured: boolean;
  // UI extras
  tagline?: string;
  desc?: string;
  yearly?: string; // Pipeline annual summary, e.g. "$758/yr"
  yearlyCta?: string; // optional linked label for the annual summary
  yearlyPrice?: string; // Blueprint annual checkout label, e.g. "$566"
  yearlyHref?: string; // Blueprint annual checkout URL
  secondaryCta?: string; // Audit yearly CTA label
  secondaryHref?: string; // Audit yearly checkout URL
  contactEmail?: string; // visible email address shown beneath a mailto CTA
}

const STRIPE = {
  // Audit checkout links (recreated 2026-10-01 after Express→Standard switch)
  auditSingle: 'https://buy.stripe.com/00w9ATbPF6oD7oe3KE9Zm04',
  auditTeamMonthly: 'https://buy.stripe.com/8x2aEX2f59AP7oe2GA9Zm05',
  auditTeamYearly: 'https://buy.stripe.com/4gM4gz9Hx3creQG3KE9Zm06',
  auditAgencyMonthly: 'https://buy.stripe.com/3cI00j3j914j4c25SM9Zm07',
  auditAgencyYearly: 'https://buy.stripe.com/5kQdR97zp6oD5g66WQ9Zm08',
  // Blueprint checkout links (recreated 2026-10-01 after Express→Standard switch)
  blueprintSoloMonthly: 'https://buy.stripe.com/bJefZh06XeV9dMC1Cw9Zm00',
  blueprintSoloYearly: 'https://buy.stripe.com/28E00j6vl6oDbEucha9Zm01',
  blueprintTeamMonthly: 'https://buy.stripe.com/eVq3cvdXN7sH5g6dle9Zm02',
  blueprintTeamYearly: 'https://buy.stripe.com/3cIdR9f1R7sH4c20ys9Zm03',
};

export const SUPPORT_EMAIL = 'support@nuria.firstcreationmedia.com';

export const PRICING = {
  blueprint: {
    free: {
      name: 'Free',
      price: '$0',
      period: '/ forever',
      tagline: 'For exploring the tool',
      features: ['1 project (lifetime)', '1 user seat', 'Sitemap builder', 'Page outlines', 'Basic wireframe blocks', 'Content questionnaires'],
      cta: 'Get Started',
      href: 'https://nuria.firstcreationmedia.com/#products',
      featured: false,
    },
    solo: {
      name: 'Solo',
      price: '$59',
      period: '/ month',
      tagline: 'For freelance designers',
      features: ['5 projects per month', '1 user seat', 'Advanced wireframe blocks (50+)', 'PDF proposal export', 'Custom proposal branding', 'Email support'],
      cta: 'Start Monthly',
      href: STRIPE.blueprintSoloMonthly,
      yearlyPrice: '$566',
      yearlyHref: STRIPE.blueprintSoloYearly,
      featured: false,
    },
    team: {
      name: 'Team',
      price: '$149',
      period: '/ month',
      tagline: 'For small agencies',
      features: ['10 projects per month', 'Up to 5 user seats', 'Everything in Solo, plus:', 'Invite team members & clients', 'Client-facing portal', 'Comment & approval workflow', 'Interactive HTML export', 'Google Docs / Word export', 'Sitemap template library (10 industries)', '50+ wireframe block templates', 'Industry-specific questionnaire bundles', 'Priority support'],
      cta: 'Start Monthly',
      href: STRIPE.blueprintTeamMonthly,
      yearlyPrice: '$1,430',
      yearlyHref: STRIPE.blueprintTeamYearly,
      featured: true,
    },
    agency: {
      name: 'Agency',
      price: 'Contact for pricing',
      period: '',
      tagline: 'For growing agencies',
      features: ['Unlimited projects', 'Unlimited user seats', 'Everything in Team, plus:', 'API access (REST API + keys)', 'Custom domain for client portals', 'White-labeling (remove Nuria branding)', 'Export to Webflow, WordPress & Framer', 'Priority support'],
      cta: 'Contact Us',
      href: 'mailto:sales@nuria.firstcreationmedia.com',
      contactEmail: 'sales@nuria.firstcreationmedia.com',
      featured: false,
    },
  },
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
  pipeline: {
    solo: {
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
    team: {
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
    agency: {
      name: 'Agency',
      price: 'Contact for Pricing',
      period: '',
      features: ['Everything in Team', 'White-labeling', 'API access', 'Custom pricing', 'Dedicated support'],
      cta: 'Contact Us',
      href: 'mailto:sales@nuria.firstcreationmedia.com',
      contactEmail: 'sales@nuria.firstcreationmedia.com',
      featured: false,
    },
  },
};

// Ordered arrays for components that map over plans in a fixed order.
export const BLUEPRINT_PLANS: Plan[] = [
  PRICING.blueprint.free,
  PRICING.blueprint.solo,
  PRICING.blueprint.team,
  PRICING.blueprint.agency,
];
export const AUDIT_PLANS: Plan[] = [
  PRICING.audit.free,
  PRICING.audit.single,
  PRICING.audit.team,
  PRICING.audit.agency,
];
export const PIPELINE_PLANS: Plan[] = [
  PRICING.pipeline.solo,
  PRICING.pipeline.team,
  PRICING.pipeline.agency,
];
