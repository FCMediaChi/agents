export interface SitemapPage {
  id: string;
  title: string;
  type: string;
  slug?: string;
  description: string;
  notes: string;
}

export interface SitemapTemplate {
  name: string;
  icon: string;
  description: string;
  pages: SitemapPage[];
}

export const SITEMAP_TEMPLATES: SitemapTemplate[] = [
  {
    name: 'E-Commerce',
    icon: '🛒',
    description: 'Online store with product catalog and checkout',
    pages: [
      { id: '1', title: 'Home', type: 'homepage', slug: 'home', description: 'Storefront with featured products, promotions, and brand trust elements', notes: 'Hero slider, bestseller grid, review carousel' },
      { id: '2', title: 'Shop', type: 'services', slug: 'shop', description: 'Product catalog with faceted search and category filters', notes: 'Keep filters on sidebar, add sort by price/rating' },
      { id: '3', title: 'Product Detail', type: 'services', slug: 'product', description: 'Product gallery, specs, reviews, and add-to-cart', notes: 'Sticky buy button on mobile, zoom gallery' },
      { id: '4', title: 'Cart', type: 'services', slug: 'cart', description: 'Order summary with quantity adjustments and promo codes', notes: 'Show free shipping threshold' },
      { id: '5', title: 'Checkout', type: 'services', slug: 'checkout', description: 'Address, payment, and order confirmation flow', notes: 'Guest checkout option, trust badges' },
      { id: '6', title: 'About Us', type: 'about', slug: 'about', description: 'Brand story, mission, sustainability commitments', notes: 'Video background header, timeline' },
      { id: '7', title: 'Contact', type: 'contact', slug: 'contact', description: 'Support form, FAQ, return policy, and store locator', notes: 'Live chat widget, order lookup' },
      { id: '8', title: 'Blog', type: 'blog', slug: 'blog', description: 'Guides, lookbooks, style tips, and new arrivals', notes: 'Featured post hero, grid layout' },
    ]
  },
  {
    name: 'SaaS',
    icon: '☁️',
    description: 'Software-as-a-Service company website',
    pages: [
      { id: '1', title: 'Home', type: 'homepage', slug: 'home', description: 'Value proposition, interactive demo preview, customer logos', notes: 'Animated product screenshot, trust bar' },
      { id: '2', title: 'Features', type: 'services', slug: 'features', description: 'Core modules, integrations, performance benefits', notes: 'Side-by-side comparison tables, icon grid' },
      { id: '3', title: 'Pricing', type: 'pricing', slug: 'pricing', description: 'Tier comparison, FAQ, enterprise custom quote CTA', notes: 'Annual/monthly toggle, free trial CTA' },
      { id: '4', title: 'Integrations', type: 'services', slug: 'integrations', description: 'Third-party integrations and API docs', notes: 'Logo grid grouped by category' },
      { id: '5', title: 'Case Studies', type: 'services', slug: 'case-studies', description: 'Customer success stories with metrics', notes: 'Filter by industry, result highlight cards' },
      { id: '6', title: 'About', type: 'about', slug: 'about', description: 'Company story, leadership team, and careers', notes: 'Founder video, timeline, culture photos' },
      { id: '7', title: 'Contact Sales', type: 'contact', slug: 'contact-sales', description: 'Enterprise inquiry form and demo booking', notes: 'HubSpot/Calendly integration' },
      { id: '8', title: 'Blog', type: 'blog', slug: 'blog', description: 'Industry insights, product updates, tutorials', notes: 'Search, categories sidebar' },
    ]
  },
  {
    name: 'Local Business',
    icon: '🏪',
    description: 'Service-area business like plumbers, electricians, dentists',
    pages: [
      { id: '1', title: 'Home', type: 'homepage', slug: 'home', description: 'Service overview, trust badges, booking CTA, phone number', notes: 'Show phone and address in header, map widget' },
      { id: '2', title: 'Services', type: 'services', slug: 'services', description: 'Detailed offerings with pricing and descriptions', notes: 'Service cards with icons, "Starting at" prices' },
      { id: '3', title: 'About Us', type: 'about', slug: 'about', description: 'Licenses, insurance, warranties, team bios', notes: 'Certification badges, team photos' },
      { id: '4', title: 'Reviews', type: 'services', slug: 'reviews', description: 'Google/Yelp reviews grid and video testimonials', notes: 'Star ratings filter, review source badges' },
      { id: '5', title: 'Gallery', type: 'gallery', slug: 'gallery', description: 'Before/after photos, project galleries', notes: 'Lightbox view, filter by service type' },
      { id: '6', title: 'FAQ', type: 'faq', slug: 'faq', description: 'Common questions about services, pricing, and process', notes: 'Accordion grouped by topic' },
      { id: '7', title: 'Book Now', type: 'contact', slug: 'book', description: 'Booking calendar and contact form', notes: 'Calendly embed, SMS reminders checkbox' },
    ]
  },
  {
    name: 'Portfolio',
    icon: '🎨',
    description: 'Creative professional or agency portfolio',
    pages: [
      { id: '1', title: 'Home', type: 'homepage', slug: 'home', description: 'Hero portfolio reel, featured work, and bio snippet', notes: 'Large hero image/video, social proof numbers' },
      { id: '2', title: 'Work', type: 'gallery', slug: 'work', description: 'Project showcase with category filters', notes: 'Masonry grid, hover previews, filter by type' },
      { id: '3', title: 'Project Detail', type: 'services', slug: 'project', description: 'Case study with problem, solution, results, and gallery', notes: 'Side-by-side before/after, testimonial from client' },
      { id: '4', title: 'Services', type: 'services', slug: 'services', description: 'Creative services menu with packages and pricing', notes: 'Package comparison cards, starting at prices' },
      { id: '5', title: 'About', type: 'about', slug: 'about', description: 'Creative journey, philosophy, tools, and awards', notes: 'Timeline, logos of past clients' },
      { id: '6', title: 'Contact', type: 'contact', slug: 'contact', description: 'Project inquiry form with project type selector', notes: 'Multi-step form: type → budget → timeline → details' },
    ]
  },
  {
    name: 'Restaurant',
    icon: '🍽️',
    description: 'Restaurant, cafe, or food service business',
    pages: [
      { id: '1', title: 'Home', type: 'homepage', slug: 'home', description: 'Ambiance photos, chef specials, reservation CTA', notes: 'Full-screen hero image, Google Maps widget' },
      { id: '2', title: 'Menu', type: 'services', slug: 'menu', description: 'Food and drink menus organized by category', notes: 'Tabbed sections, dietary labels, price display' },
      { id: '3', title: 'Reservations', type: 'contact', slug: 'reservations', description: 'Table booking widget and private dining info', notes: 'OpenTable/Resy embed' },
      { id: '4', title: 'About', type: 'about', slug: 'about', description: 'Chef story, sourcing philosophy, and restaurant history', notes: 'Chef photo, farm partner logos' },
      { id: '5', title: 'Events', type: 'services', slug: 'events', description: 'Private events, catering, and special occasions', notes: 'Package cards, gallery of past events' },
      { id: '6', title: 'Gallery', type: 'gallery', slug: 'gallery', description: 'Food photography, interior shots, and customer photos', notes: 'Instagram-style grid layout' },
      { id: '7', title: 'Contact', type: 'contact', slug: 'contact', description: 'Location, hours, phone, and email', notes: 'Map embed, parking info, public transit directions' },
    ]
  },
  {
    name: 'Blog / Magazine',
    icon: '📝',
    description: 'Content-driven publication or blog',
    pages: [
      { id: '1', title: 'Home', type: 'homepage', slug: 'home', description: 'Hero story, latest posts grid, and category highlights', notes: 'Featured post carousel, newsletter signup CTA' },
      { id: '2', title: 'Articles', type: 'blog', slug: 'articles', description: 'All posts with search, filters, and pagination', notes: 'Infinite scroll, category and tag filters' },
      { id: '3', title: 'Article Detail', type: 'blog', slug: 'article', description: 'Full article with author bio, related posts', notes: 'Table of contents, reading time, sharing buttons' },
      { id: '4', title: 'Categories', type: 'services', slug: 'categories', description: 'Topic hubs with curated post lists', notes: 'Hero card per category with follower count' },
      { id: '5', title: 'About', type: 'about', slug: 'about', description: 'Publication mission, editorial team, and contributor info', notes: 'Team grid with social links' },
      { id: '6', title: 'Write for Us', type: 'contact', slug: 'contribute', description: 'Submission guidelines and pitch form', notes: 'Topic categories, format guidelines' },
    ]
  },
  {
    name: 'Real Estate',
    icon: '🏠',
    description: 'Real estate agency or property listing site',
    pages: [
      { id: '1', title: 'Home', type: 'homepage', slug: 'home', description: 'Property search, featured listings, agent CTAs', notes: 'Search bar hero, market stats ticker' },
      { id: '2', title: 'Listings', type: 'services', slug: 'listings', description: 'Property grid with maps, filters, and sort', notes: 'Map/list toggle view, saved search functionality' },
      { id: '3', title: 'Property Detail', type: 'services', slug: 'property', description: 'Gallery, specs, features, agent info, and inquiry form', notes: 'Photo carousel, floor plans tab, mortgage calc' },
      { id: '4', title: 'Agents', type: 'team', slug: 'agents', description: 'Agent directory with bios and contact info', notes: 'Grid with profile photos, specialization badges' },
      { id: '5', title: 'About', type: 'about', slug: 'about', description: 'Agency history, market expertise, and awards', notes: 'Closed transaction stats, community involvement' },
      { id: '6', title: 'Sell', type: 'services', slug: 'sell', description: 'Home valuation tool and selling process overview', notes: 'Instant valuation embed, step-by-step timeline' },
      { id: '7', title: 'Contact', type: 'contact', slug: 'contact', description: 'Multi-purpose inquiry form and office locations', notes: 'Office selection dropdown with maps' },
    ]
  },
  {
    name: 'Non-Profit',
    icon: '💚',
    description: 'Charity, nonprofit, or community organization',
    pages: [
      { id: '1', title: 'Home', type: 'homepage', slug: 'home', description: 'Mission statement, impact numbers, and donation CTA', notes: 'Hero video, impact counter animation' },
      { id: '2', title: 'Our Work', type: 'services', slug: 'our-work', description: 'Programs, initiatives, and impact stories', notes: 'Before/after photos, progress indicators' },
      { id: '3', title: 'Get Involved', type: 'services', slug: 'involved', description: 'Volunteer opportunities, events, and campaigns', notes: 'Calendar widget, signup forms' },
      { id: '4', title: 'Donate', type: 'services', slug: 'donate', description: 'One-time and recurring donation options', notes: 'Suggested amounts, recurring/monthly toggle' },
      { id: '5', title: 'About', type: 'about', slug: 'about', description: 'Founding story, team, transparency, and financials', notes: 'Annual report PDF, donor recognition' },
      { id: '6', title: 'News', type: 'blog', slug: 'news', description: 'Press releases, annual reports, and announcements', notes: 'Archive by year, newsletter signup' },
      { id: '7', title: 'Contact', type: 'contact', slug: 'contact', description: 'General inquiry form and office info', notes: 'Partner inquiry option, media contact' },
    ]
  },
  {
    name: 'Event / Conference',
    icon: '🎪',
    description: 'Conference, meetup, or event website',
    pages: [
      { id: '1', title: 'Home', type: 'homepage', slug: 'home', description: 'Event hook, date/location, speaker highlights, CTA', notes: 'Countdown timer, hero background video' },
      { id: '2', title: 'Speakers', type: 'team', slug: 'speakers', description: 'Speaker lineup with bios and session previews', notes: 'Photo grid with hover details, social links' },
      { id: '3', title: 'Schedule', type: 'services', slug: 'schedule', description: 'Daily agenda with tracks and session details', notes: 'Tabbed by day, filter by track or venue' },
      { id: '4', title: 'Tickets', type: 'pricing', slug: 'tickets', description: 'Ticket tiers with pricing and what\'s included', notes: 'Early bird pricing, group discounts' },
      { id: '5', title: 'Venue', type: 'services', slug: 'venue', description: 'Location details, travel, and accommodation info', notes: 'Map embed, hotel discounts list' },
      { id: '6', title: 'Sponsors', type: 'services', slug: 'sponsors', description: 'Sponsor tiers and sponsor showcase grid', notes: 'Tier headers with logo grids, become sponsor CTA' },
      { id: '7', title: 'Contact', type: 'contact', slug: 'contact', description: 'General inquiry, sponsorship, and press contact', notes: 'Topic dropdown: general/press/sponsor/speaker' },
    ]
  },
  {
    name: 'Law Firm',
    icon: '⚖️',
    description: 'Law firm or legal practice website',
    pages: [
      { id: '1', title: 'Home', type: 'homepage', slug: 'home', description: 'Firm value prop, practice areas, results, and consultation CTA', notes: 'Trust badges, case results ticker, video intro' },
      { id: '2', title: 'Practice Areas', type: 'services', slug: 'practice-areas', description: 'Legal services with descriptions and sub-specialties', notes: 'Icon grid leading to detail pages' },
      { id: '3', title: 'Attorneys', type: 'team', slug: 'attorneys', description: 'Attorney profiles with credentials, bar admissions, and awards', notes: 'Photo grid, filter by practice area' },
      { id: '4', title: 'Results', type: 'services', slug: 'results', description: 'Notable case results and settlements', notes: 'Dollar amounts highlighted, disclaimer footer' },
      { id: '5', title: 'Testimonials', type: 'services', slug: 'testimonials', description: 'Client reviews and success stories', notes: 'Video testimonials, star ratings' },
      { id: '6', title: 'About', type: 'about', slug: 'about', description: 'Firm history, core values, and community involvement', notes: 'Timeline, office photos, diversity stats' },
      { id: '7', title: 'Contact', type: 'contact', slug: 'contact', description: 'Free consultation form and office locations', notes: 'Multi-location with maps, 24/7 callback option' },
    ]
  },
];

export function getTemplateByIndustry(industry: string): SitemapTemplate | undefined {
  return SITEMAP_TEMPLATES.find(t => t.name.toLowerCase() === industry.toLowerCase());
}
