import { BLUEPRINT_PLANS } from './pricing';

export const APP_NAME = 'Nuria Website Blueprint';
export const APP_TAGLINE = 'Turn a rough website idea into a deliverable-ready plan.';

export interface Tier {
  name: string;
  price: string;
  cadence?: string;
  /** Annual price label, e.g. "$566" (shown as "or $566/year"). */
  yearly?: string;
  description: string;
  features: string[];
  cta: { label: string; to: string };
  highlighted?: boolean;
}

/**
 * Landing-page cards, derived from the single source of truth in `lib/pricing.ts`
 * (Free / Solo $59 · $566/yr / Team $149 · $1,430/yr / Agency contact).
 * Checkout wiring is Phase 4, so CTAs stay on the in-app signup for now.
 */
export const TIERS: Tier[] = BLUEPRINT_PLANS.map((plan) => ({
  name: plan.name,
  price: plan.price,
  cadence: plan.period === '/ month' ? '/mo' : undefined,
  yearly: plan.yearlyPrice,
  description: plan.tagline ?? plan.desc ?? '',
  features: plan.features.slice(0, 5),
  cta: {
    label: plan.name === 'Free' ? 'Start free' : plan.name === 'Agency' ? 'Talk to us' : `Choose ${plan.name}`,
    to: '/signup',
  },
  highlighted: plan.featured,
}));

/** The five deliverables a Blueprint project produces (used by the dashboard shell). */
export const DELIVERABLES = [
  { key: 'sitemap', title: 'Sitemap builder', text: 'Lay out every page, nested in the hierarchy that matches how visitors will move through the site.' },
  { key: 'outline', title: 'Page outlines', text: 'Give each page a job — its goal, audience, sections, and the notes the copy needs.' },
  { key: 'questionnaire', title: 'Content questionnaire', text: 'Generate the questions a client must answer per page type, so nothing is missing when copy begins.' },
  { key: 'wireframe', title: 'Wireframes', text: 'Block out each page layout in a simple canvas, and collect comments on the blocks.' },
  { key: 'proposal', title: 'Project proposal', text: 'Compile the whole plan into a client-facing proposal you can export as PDF or HTML.' },
];
