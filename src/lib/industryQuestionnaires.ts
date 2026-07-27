export interface QuestionnaireBundle {
  industry: string;
  icon: string;
  pages: Record<string, string[]>;
}

export const INDUSTRY_QUESTIONNAIRES: QuestionnaireBundle[] = [
  {
    industry: 'E-Commerce',
    icon: '🛒',
    pages: {
      homepage: [
        'What is your store\'s unique value proposition?',
        'What top 3 product categories should be featured?',
        'What trust signals do you display (returns, shipping, reviews)?',
      ],
      shop: [
        'How many product categories and subcategories do you have?',
        'What filter options should be available (size, color, price, rating)?',
        'What sort options do you need (popular, newest, price, rating)?',
      ],
      product: [
        'What product info is required (size chart, materials, care)?',
        'How many product images per item?',
        'Do you need variant selectors (color, size, style)?',
      ],
      cart: [
        'What promo/discount code support is needed?',
        'Do you show shipping estimates in cart?',
        'Do you cross-sell related products?',
      ],
      checkout: [
        'What payment methods are accepted?',
        'Do you offer guest checkout?',
        'What fields are required (email, phone, address)?',
      ],
    }
  },
  {
    industry: 'SaaS',
    icon: '☁️',
    pages: {
      homepage: [
        'What is the core value proposition in one sentence?',
        'What key metric or social proof can you showcase?',
        'Who are your top 3 customer logos to feature?',
      ],
      features: [
        'List your top 5-8 product features with one-line descriptions.',
        'What integrations do you support?',
        'What performance guarantees can you make (uptime, speed)?',
      ],
      pricing: [
        'How many pricing tiers do you offer?',
        'What are the key differentiators between tiers?',
        'Do you offer a free trial or freemium tier?',
      ],
      'case-studies': [
        'Select 3 success stories with measurable results.',
        'What industries are your best case studies from?',
        'What\'s the typical ROI timeframe for customers?',
      ],
    }
  },
  {
    industry: 'Local Business',
    icon: '🏪',
    pages: {
      homepage: [
        'What are your 3 core services?',
        'What service area (cities or zip codes) do you cover?',
        'What\'s your primary phone number and should it be prominent?',
      ],
      services: [
        'List each service with a starting price range.',
        'What differentiates you from local competitors?',
        'Do you offer free estimates or consultations?',
      ],
      about: [
        'What licenses and certifications do you hold?',
        'How long have you been in business?',
        'Do you have team photos or bios to include?',
      ],
      reviews: [
        'How many Google or Yelp reviews do you have?',
        'Do you have video testimonials available?',
        'What\'s your average rating?',
      ],
      book: [
        'What booking tool do you use (Calendly, Acuity, etc.)?',
        'What services are bookable online?',
        'What information do you need from customers before booking?',
      ],
    }
  },
  {
    industry: 'Portfolio',
    icon: '🎨',
    pages: {
      homepage: [
        'What type of creative work do you showcase?',
        'What\'s your personal brand statement?',
        'What are the primary actions visitors should take?',
      ],
      work: [
        'How many projects do you want to feature?',
        'What categories do your projects fall into?',
        'Do you have before/after or process images?',
      ],
      project: [
        'What was the client\'s original challenge?',
        'What was your solution and the measurable outcome?',
        'Can you include a client testimonial per project?',
      ],
      services: [
        'List your service offerings with package options.',
        'What\'s included in each service tier?',
        'What is your typical project timeline?',
      ],
    }
  },
  {
    industry: 'Restaurant',
    icon: '🍽️',
    pages: {
      homepage: [
        'What type of cuisine do you serve?',
        'What\'s the atmosphere/vibe in one phrase?',
        'What\'s your most popular dish?',
      ],
      menu: [
        'What menu categories do you have (appetizers, mains, desserts)?',
        'Do you have dietary labels (GF, V, VG)?',
        'Do prices need to be displayed?',
      ],
      reservations: [
        'What booking platform do you use?',
        'What\'s your typical party size range?',
        'Do you offer private dining or event packages?',
      ],
      events: [
        'What types of events do you host?',
        'What\'s the capacity for private events?',
        'Do you offer catering services?',
      ],
    }
  },
  {
    industry: 'Real Estate',
    icon: '🏠',
    pages: {
      homepage: [
        'What geographic markets do you serve?',
        'What property types do you specialize in?',
        'What are your top 3 key differentiators as an agency?',
      ],
      listings: [
        'What listing data points are most important (price, beds, baths, sqft)?',
        'What filter options do buyers need?',
        'Do you need a map view alongside the list?',
      ],
      property: [
        'How many photos are typical per listing?',
        'Do you include floor plans and virtual tours?',
        'What additional details (schools, walk score, HOA)?',
      ],
      agents: [
        'How many agents are on your team?',
        'What credentials and specializations should be highlighted?',
        'Do you want direct contact links per agent?',
      ],
    }
  },
  {
    industry: 'Non-Profit',
    icon: '💚',
    pages: {
      homepage: [
        'What is your mission statement in one sentence?',
        'What impact numbers can you showcase?',
        'What is the primary action you want visitors to take?',
      ],
      'our-work': [
        'What are your core programs or initiatives?',
        'What measurable outcomes can you share?',
        'Do you have before/after or impact photos?',
      ],
      donate: [
        'What suggested donation amounts do you offer?',
        'Do you support recurring monthly donations?',
        'Are donations tax-deductible and do you provide receipts?',
      ],
      involved: [
        'What volunteer opportunities are available?',
        'Do you host events or campaigns?',
        'What skills are most needed from volunteers?',
      ],
    }
  },
  {
    industry: 'Law Firm',
    icon: '⚖️',
    pages: {
      homepage: [
        'What practice areas do you specialize in?',
        'What\'s your firm\'s unique approach or philosophy?',
        'What notable results or stats can you highlight?',
      ],
      'practice-areas': [
        'List each practice area with a short description.',
        'What sub-specialties exist within each?',
        'What types of cases do you handle in each area?',
      ],
      attorneys: [
        'How many attorneys are at the firm?',
        'What credentials matter most (bar admissions, awards, education)?',
        'What practice areas does each attorney cover?',
      ],
      results: [
        'What are your most impressive case results?',
        'Can you publicly share settlement amounts?',
        'Do you have client success stories?',
      ],
    }
  },
];

export function getQuestionnaireBundle(industry: string): QuestionnaireBundle | undefined {
  return INDUSTRY_QUESTIONNAIRES.find(b => b.industry.toLowerCase() === industry.toLowerCase());
}

export function getQuestionsForIndustryPage(industry: string, pageType: string): string[] {
  const bundle = getQuestionnaireBundle(industry);
  if (!bundle) return [];
  return bundle.pages[pageType] || [];
}
