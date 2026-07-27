export interface WireframeBlock {
  title: string;
  subtitle: string;
  type: string;
}

export const WIREFRAME_LIBRARY: Record<string, WireframeBlock[]> = {
  homepage: [
    { title: 'Header / Navigation', subtitle: 'Logo, nav links, primary CTA button', type: 'header' },
    { title: 'Centered Hero', subtitle: 'Headline, subheadline, two CTAs with background image', type: 'hero' },
    { title: 'Split Hero', subtitle: 'Left: headline + CTA, Right: product image/screenshot', type: 'hero' },
    { title: 'Video Hero', subtitle: 'Full-width background video with overlay text', type: 'hero' },
    { title: 'Trust Bar', subtitle: 'Customer logos, ratings, or awards strip', type: 'trust' },
    { title: '3-Column Features', subtitle: 'Benefits grid with icons and descriptions', type: 'features' },
    { title: 'Alternating Features', subtitle: 'Left/right alternating image + text rows', type: 'features' },
    { title: 'Stats Counter', subtitle: 'Animated numbers: customers, revenue, uptime', type: 'stats' },
    { title: 'Centered Testimonial', subtitle: 'Single quote with photo, name, title, company logo', type: 'testimonials' },
    { title: 'Testimonial Cards', subtitle: 'Grid of review cards with star ratings', type: 'testimonials' },
    { title: 'Testimonial Carousel', subtitle: 'Horizontal scrolling testimonials', type: 'testimonials' },
    { title: 'Logo Cloud', subtitle: 'Grid of partner/client logos', type: 'trust' },
    { title: 'CTA Banner', subtitle: 'Full-width colored strip with headline, subtext, and button', type: 'cta' },
    { title: 'Footer', subtitle: 'Logo, links, social icons, copyright, newsletter', type: 'footer' },
  ],
  services: [
    { title: 'Header / Navigation', subtitle: 'Logo, nav links, CTA', type: 'header' },
    { title: 'Service Hero', subtitle: 'Headline, overview paragraph, key stat badges', type: 'hero' },
    { title: 'Service Cards Grid', subtitle: '3-column service cards with icons, titles, descriptions', type: 'features' },
    { title: 'Service Detail Rows', subtitle: 'Alternating L/R blocks with image, title, description, CTA link', type: 'features' },
    { title: 'Pricing Table (3-tier)', subtitle: 'Three-column comparison: basic, pro, enterprise', type: 'pricing' },
    { title: 'Pricing Table (4-tier)', subtitle: 'Four-column comparison with feature checkmarks', type: 'pricing' },
    { title: 'Comparison Table', subtitle: 'Feature-by-feature comparison vs. competitors', type: 'features' },
    { title: 'Process Flow', subtitle: 'Step-by-step: discovery → design → build → launch', type: 'process' },
    { title: 'Work Gallery', subtitle: 'Grid of project screenshots with category filters', type: 'gallery' },
    { title: 'FAQ Accordion', subtitle: 'Grouped accordion with 8-10 common questions', type: 'faq' },
    { title: 'CTA Section', subtitle: 'Split CTA: left booking, right contact form', type: 'cta' },
    { title: 'Footer', subtitle: 'Links, socials, copyright, back-to-top', type: 'footer' },
  ],
  about: [
    { title: 'Header / Navigation', subtitle: 'Logo and nav links', type: 'header' },
    { title: 'Mission Hero', subtitle: 'Large photo background with mission statement overlay', type: 'hero' },
    { title: 'Company Story', subtitle: 'Founding narrative with timeline milestones', type: 'timeline' },
    { title: 'Values Grid', subtitle: '3x2 grid of core values with icons and descriptions', type: 'features' },
    { title: 'Team Grid', subtitle: 'Team member photos, names, titles, social links', type: 'team' },
    { title: 'Leadership Bios', subtitle: 'Detailed profiles with headshot, bio, LinkedIn link', type: 'team' },
    { title: 'Milestones Timeline', subtitle: 'Vertical timeline of company milestones and achievements', type: 'timeline' },
    { title: 'Awards & Recognition', subtitle: 'Badge grid of awards and certifications', type: 'trust' },
    { title: 'Careers CTA', subtitle: '"Join Our Team" section with open roles link', type: 'cta' },
    { title: 'Office Gallery', subtitle: 'Photo carousel of office space and culture', type: 'gallery' },
    { title: 'Footer', subtitle: 'Contact info, links, copyright', type: 'footer' },
  ],
  contact: [
    { title: 'Header / Navigation', subtitle: 'Logo and nav links', type: 'header' },
    { title: 'Contact Hero', subtitle: 'Headline: "Get in Touch" with subtext', type: 'hero' },
    { title: 'Contact Form', subtitle: 'Name, email, subject, message textarea, submit button', type: 'form' },
    { title: 'Multi-Select Form', subtitle: 'Dropdown-based inquiry form with conditional fields', type: 'form' },
    { title: 'Contact Info Cards', subtitle: 'Phone, email, address in icon cards', type: 'info' },
    { title: 'Office Locations', subtitle: 'Multiple location cards with hours and maps', type: 'info' },
    { title: 'Google Map Embed', subtitle: 'Full-width Google Maps embed', type: 'map' },
    { title: 'Booking Calendar', subtitle: 'Embedded Calendly or scheduling widget', type: 'form' },
    { title: 'FAQ Accordion', subtitle: 'Common support questions before the form', type: 'faq' },
    { title: 'Footer', subtitle: 'Contact info, links, copyright', type: 'footer' },
  ],
  pricing: [
    { title: 'Header / Navigation', subtitle: 'Logo and nav links', type: 'header' },
    { title: 'Pricing Hero', subtitle: 'Headline: "Simple, Transparent Pricing"', type: 'hero' },
    { title: 'Plan Cards (3-tier)', subtitle: 'Three plan cards with features and CTAs', type: 'pricing' },
    { title: 'Plan Cards (4-tier)', subtitle: 'Four plan cards with yearly/monthly toggle', type: 'pricing' },
    { title: 'Feature Comparison', subtitle: 'Full comparison table across all tiers', type: 'pricing' },
    { title: 'Enterprise CTA', subtitle: '"Need something custom? Contact our sales team"', type: 'cta' },
    { title: 'FAQ Accordion', subtitle: 'Pricing-related questions: billing, cancellation, upgrades', type: 'faq' },
    { title: 'Footer', subtitle: 'Contact info, links, copyright', type: 'footer' },
  ],
  gallery: [
    { title: 'Header / Navigation', subtitle: 'Logo and nav links', type: 'header' },
    { title: 'Gallery Hero', subtitle: 'Headline and short description', type: 'hero' },
    { title: 'Masonry Grid', subtitle: 'Images in a staggered masonry layout', type: 'gallery' },
    { title: 'Carousel Gallery', subtitle: 'Horizontal slider with thumbnails', type: 'gallery' },
    { title: 'Filterable Grid', subtitle: 'Grid with category filter buttons', type: 'gallery' },
    { title: 'Lightbox Modal', subtitle: 'Click-to-expand full-size image viewer', type: 'gallery' },
    { title: 'Footer', subtitle: 'Contact info, links, copyright', type: 'footer' },
  ],
  blog: [
    { title: 'Header / Navigation', subtitle: 'Logo and nav links', type: 'header' },
    { title: 'Blog Hero', subtitle: 'Featured post with large image and excerpt', type: 'hero' },
    { title: 'Post Grid', subtitle: '3-column grid of recent posts with images and dates', type: 'features' },
    { title: 'Search Bar', subtitle: 'Search input with category/tag filters', type: 'form' },
    { title: 'Category Sidebar', subtitle: 'Categories, tags, recent posts, newsletter signup', type: 'info' },
    { title: 'Single Post', subtitle: 'Post content with TOC, author bio, related posts', type: 'features' },
    { title: 'Newsletter CTA', subtitle: 'Email signup inline form', type: 'cta' },
    { title: 'Footer', subtitle: 'Contact info, links, copyright', type: 'footer' },
  ],
  team: [
    { title: 'Header / Navigation', subtitle: 'Logo and nav links', type: 'header' },
    { title: 'Team Hero', subtitle: 'Headline: "Meet Our Team"', type: 'hero' },
    { title: 'Team Grid', subtitle: 'Photo grid with names, titles, social icons', type: 'team' },
    { title: 'Leadership Section', subtitle: 'Featured leadership row with larger photos and bios', type: 'team' },
    { title: 'Department Sections', subtitle: 'Grouped by department with section headers', type: 'team' },
    { title: 'Join Us CTA', subtitle: '"We\'re Hiring" with open roles link', type: 'cta' },
    { title: 'Footer', subtitle: 'Contact info, links, copyright', type: 'footer' },
  ],
  faq: [
    { title: 'Header / Navigation', subtitle: 'Logo and nav links', type: 'header' },
    { title: 'FAQ Hero', subtitle: 'Headline: "Frequently Asked Questions" with search', type: 'hero' },
    { title: 'Category Accordions', subtitle: 'Grouped FAQ accordion sections by topic', type: 'faq' },
    { title: 'Still Have Questions CTA', subtitle: '"Still have questions? Contact us" section', type: 'cta' },
    { title: 'Footer', subtitle: 'Contact info, links, copyright', type: 'footer' },
  ],
};

export function getBlocksForPageType(pageType: string): WireframeBlock[] {
  return WIREFRAME_LIBRARY[pageType] || WIREFRAME_LIBRARY.homepage;
}

export const ALL_BLOCK_TYPES = Object.values(WIREFRAME_LIBRARY).flat();
export const UNIQUE_BLOCK_COUNT = new Set(ALL_BLOCK_TYPES.map(b => b.type)).size;
