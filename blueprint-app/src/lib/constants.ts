export const APP_NAME = 'Nuria Website Blueprint';
export const APP_TAGLINE = 'Turn a rough website idea into a deliverable-ready plan.';

export interface Tier {
  name: string;
  price: string;
  cadence?: string;
  description: string;
  features: string[];
  cta: { label: string; to: string };
  highlighted?: boolean;
}

/** Blueprint pricing — mirrors the business plan (Free / Solo / Team / Agency). */
export const TIERS: Tier[] = [
  {
    name: 'Free',
    price: '$0',
    description: 'Try the planner on a single project, for as long as you like.',
    features: ['1 project (lifetime)', 'Sitemap builder', 'Page outlines', 'Content questionnaires'],
    cta: { label: 'Start free', to: '/signup' },
  },
  {
    name: 'Solo',
    price: '$59',
    cadence: '/mo',
    description: 'For freelance designers planning sites for clients.',
    features: ['5 projects per month', 'Wireframes', 'Proposal export', 'Everything in Free'],
    cta: { label: 'Choose Solo', to: '/signup' },
    highlighted: true,
  },
  {
    name: 'Team',
    price: '$149',
    cadence: '/mo',
    description: 'For small agencies planning several client sites at once.',
    features: [
      '10 projects per month',
      'Premium features',
      'Custom branding',
      'Advanced wireframes',
      'PDF + HTML export',
    ],
    cta: { label: 'Choose Team', to: '/signup' },
  },
  {
    name: 'Agency',
    price: 'Contact us',
    description: 'Unlimited projects with white-labeling for busy agencies.',
    features: ['Unlimited projects', 'White-labeling', 'Custom domains', 'API access', 'Premium features'],
    cta: { label: 'Talk to us', to: '/signup' },
  },
];

/** The five deliverables a Blueprint project produces (used by the dashboard shell). */
export const DELIVERABLES = [
  { key: 'sitemap', title: 'Sitemap builder', text: 'Lay out every page, nested in the hierarchy that matches how visitors will move through the site.' },
  { key: 'outline', title: 'Page outlines', text: 'Give each page a job — its goal, audience, sections, and the notes the copy needs.' },
  { key: 'questionnaire', title: 'Content questionnaire', text: 'Generate the questions a client must answer per page type, so nothing is missing when copy begins.' },
  { key: 'wireframe', title: 'Wireframes', text: 'Block out each page layout in a simple canvas, and collect comments on the blocks.' },
  { key: 'proposal', title: 'Project proposal', text: 'Compile the whole plan into a client-facing proposal you can export as PDF or HTML.' },
];
