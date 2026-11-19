/**
 * Checklist catalog — the definition of what a pre-launch website QA review covers.
 *
 * This is the single source of truth. It is upserted into `checklist_categories` and
 * `checklist_items` on server boot (see seed.ts), so editing an item here updates every
 * project on the next restart while keeping the ids stable for existing answers.
 *
 * Phase 2 scope: deterministic checklist content only. No AI prompts — the
 * `ai_prompt_context` column is reserved for Phase 5 and is intentionally left empty.
 */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface CatalogItem {
  /** Stable slug — used as the database primary key. Never rename an existing id. */
  id: string;
  title: string;
  description: string;
  severity: Severity;
  /** Plain-language "how to fix it" hint shown under the item. */
  remediation: string;
  /**
   * Website types this item applies to. Empty/omitted = applies to every project.
   * Matches the WEBSITE_TYPES list used by projects.
   */
  applicableSiteTypes?: string[];
}

export interface CatalogCategory {
  /** Stable slug — used as the database primary key. */
  id: string;
  name: string;
  description: string;
  items: CatalogItem[];
}

export const CATALOG: CatalogCategory[] = [
  {
    id: 'content',
    name: 'Content',
    description: 'Copy, media and forms are finished, accurate and ready for the public.',
    items: [
      {
        id: 'content-placeholder-text',
        title: 'No placeholder text remains',
        description: 'No lorem ipsum, "Coming soon", "Sample text", TBD or template filler is visible anywhere on the site.',
        severity: 'critical',
        remediation: 'Search the site for lorem, ipsum, sample, placeholder, TBD and Coming soon. Replace each one with final copy or remove the block.',
      },
      {
        id: 'content-broken-links',
        title: 'Every link and navigation item resolves',
        description: 'Clicking through the menu, footer and in-page links never lands on a 404, a dead anchor or a page still in draft.',
        severity: 'high',
        remediation: 'Crawl the site or click every link once. Fix or remove any link that does not land on a live, published page.',
      },
      {
        id: 'content-images-load',
        title: 'All images and media load correctly',
        description: 'No broken image icons, no missing hero images, no media that fails to play on a normal connection.',
        severity: 'high',
        remediation: 'Reload every page with the cache cleared and check each image. Re-upload anything that fails to render.',
      },
      {
        id: 'content-contact-details',
        title: 'Contact details are current',
        description: 'Email address, phone number, address and opening hours (where shown) are correct and reach a real inbox or person.',
        severity: 'high',
        remediation: 'Send a test message to the published email and confirm it arrives. Check the phone number and address against the client\u2019s own details.',
      },
      {
        id: 'content-form-delivery',
        title: 'Forms actually deliver submissions',
        description: 'Every contact, newsletter, booking or quote form sends to a monitored address and shows a confirmation to the visitor.',
        severity: 'critical',
        remediation: 'Submit each form once with a real address you can read, confirm the notification arrives, then confirm the visitor sees a success message.',
      },
      {
        id: 'content-cta-clarity',
        title: 'Each page has one clear call to action',
        description: 'Visitors can tell what the page wants them to do next, and competing buttons do not cancel each other out.',
        severity: 'medium',
        remediation: 'Give each page a single primary action with a specific label ("Book a call", not "Learn more"). Demote the rest.',
      },
      {
        id: 'content-proofread',
        title: 'Copy is proofread',
        description: 'Spelling, grammar, punctuation and capitalisation are consistent across every page, including buttons and form labels.',
        severity: 'medium',
        remediation: 'Read the copy aloud or run it through a spell-checker. Check the client\u2019s own product and business names for exact spelling.',
      },
      {
        id: 'content-tone-consistency',
        title: 'Tone and naming are consistent',
        description: 'One voice throughout, one spelling convention, and product or service names written the same way everywhere.',
        severity: 'low',
        remediation: 'Pick one convention (for example "email" not "e-mail", US or UK spelling) and apply it site-wide.',
      },
    ],
  },

  {
    id: 'seo',
    name: 'SEO',
    description: 'Search engines can find, index and correctly describe the site.',
    items: [
      {
        id: 'seo-noindex-removed',
        title: 'No accidental noindex or "discourage search engines" setting',
        description: 'The site is not telling search engines to stay away, and any staging noindex has been removed before launch.',
        severity: 'critical',
        remediation: 'Check for a noindex meta tag or X-Robots-Tag header on the live domain, and turn off any "discourage search engines from indexing this site" setting in the platform.',
      },
      {
        id: 'seo-unique-titles',
        title: 'Every page has a unique, descriptive title',
        description: 'Page titles are unique, describe the page and keep the primary phrase in roughly the first 60 characters.',
        severity: 'high',
        remediation: 'Write one title per page in the form "Page name | Business name". Avoid the platform default or an empty title.',
      },
      {
        id: 'seo-sitemap',
        title: 'XML sitemap exists and is submitted',
        description: 'A sitemap is published at /sitemap.xml, contains only live pages, and is submitted to Search Console.',
        severity: 'high',
        remediation: 'Generate the sitemap in the platform settings, open it in a browser to confirm it lists the right URLs, then submit it in Google Search Console.',
      },
      {
        id: 'seo-robots-txt',
        title: 'robots.txt does not block the site',
        description: 'robots.txt exists, points at the sitemap, and does not disallow the pages that should rank.',
        severity: 'high',
        remediation: 'Open /robots.txt on the live domain. Remove any Disallow: / line and add a Sitemap: line with the full URL.',
      },
      {
        id: 'seo-single-h1',
        title: 'Each page has one H1 that describes it',
        description: 'One H1 per page, matching the page topic — not the logo, not a decorative slogan.',
        severity: 'medium',
        remediation: 'Keep one H1 per page and demote the rest of the headings to H2/H3. Do not use heading tags purely to change text size.',
      },
      {
        id: 'seo-meta-descriptions',
        title: 'Every page has a meta description',
        description: 'Unique, human-written descriptions around 150 characters that read as a reason to click.',
        severity: 'medium',
        remediation: 'Write a one-sentence description per page. If the platform auto-generates one, override it on the important pages.',
      },
      {
        id: 'seo-canonical-urls',
        title: 'Canonical URLs point to one preferred domain',
        description: 'Canonicals resolve to the final https URL with a single www (or non-www) form, and there is no duplicate content between the variants.',
        severity: 'medium',
        remediation: 'Choose www or non-www, redirect the other form, and make sure the canonical tag on each page uses the chosen form with https.',
      },
      {
        id: 'seo-redirects',
        title: 'Old and variant URLs redirect cleanly',
        description: 'Previous URLs, trailing-slash variants and www/non-www all reach the final page in a single hop.',
        severity: 'medium',
        remediation: 'Add 301 redirects from every known old URL to its replacement. Test that each one lands directly, not through a chain.',
      },
      {
        id: 'seo-social-preview',
        title: 'Social share previews look right',
        description: 'Open Graph title, description and image render correctly when a page is shared to LinkedIn, X or Facebook.',
        severity: 'medium',
        remediation: 'Set og:title, og:description and a 1200\u00d7630 og:image per page, then test the URL in a share-preview debugger.',
      },
    ],
  },

  {
    id: 'accessibility',
    name: 'Accessibility',
    description: 'People using keyboards, screen readers or low vision can use the whole site.',
    items: [
      {
        id: 'a11y-keyboard',
        title: 'The whole site works with a keyboard',
        description: 'Menus, dropdowns, modals, carousels and forms can all be reached and operated with Tab, Enter, Space and Escape.',
        severity: 'critical',
        remediation: 'Put the mouse away and tab through each page. Anything you cannot reach or open with the keyboard needs a fix.',
      },
      {
        id: 'a11y-image-alt',
        title: 'Images have appropriate alt text',
        description: 'Meaningful images have descriptive alt text; purely decorative images are marked with an empty alt so they are skipped.',
        severity: 'high',
        remediation: 'Describe what the image shows in context. Mark decorative images alt="" rather than repeating the caption.',
      },
      {
        id: 'a11y-color-contrast',
        title: 'Text meets WCAG AA contrast',
        description: 'Body text reaches at least 4.5:1 against its background and large text at least 3:1, including text over images.',
        severity: 'high',
        remediation: 'Check each text/background pair with a contrast checker. Darken the text or lighten the background until it passes.',
      },
      {
        id: 'a11y-focus-visible',
        title: 'Focus states are visible',
        description: 'The keyboard focus ring is visible on links, buttons, form fields and cards, and has not been removed by the design.',
        severity: 'high',
        remediation: 'Tab through the page. If the focus ring is invisible, restore an outline on :focus-visible rather than removing it.',
      },
      {
        id: 'a11y-form-labels',
        title: 'Form fields have real labels',
        description: 'Every input has a programmatically associated label or accessible name, and errors are announced, not just coloured red.',
        severity: 'high',
        remediation: 'Use a real <label for> for each field. Add aria-describedby for hint and error text, and put the error message in the page text.',
      },
      {
        id: 'a11y-heading-order',
        title: 'Heading levels are logical',
        description: 'Headings run in order (H1 → H2 → H3) and are used for structure, not for visual size.',
        severity: 'medium',
        remediation: 'Restructure headings so levels are not skipped, and use CSS classes to control size instead of jumping to a bigger tag.',
      },
      {
        id: 'a11y-lang-attribute',
        title: 'Page language is declared',
        description: 'The html element declares the page language so screen readers use the right pronunciation.',
        severity: 'medium',
        remediation: 'Set lang="en" (or the correct language) on the html element of every page.',
      },
      {
        id: 'a11y-video-captions',
        title: 'Video and audio are accessible',
        description: 'Any video with speech has captions, and audio content has a transcript.',
        severity: 'medium',
        remediation: 'Upload a caption track for each video and link a transcript for audio-only content.',
      },
      {
        id: 'a11y-link-text',
        title: 'Link text describes its destination',
        description: 'Links read meaningfully out of context — "View pricing" rather than "click here" or a bare URL.',
        severity: 'low',
        remediation: 'Rewrite vague link text so it names the destination. Avoid "Read more" unless the accessible name is expanded.',
      },
    ],
  },

  {
    id: 'performance',
    name: 'Performance',
    description: 'Pages load quickly enough on a normal phone and connection.',
    items: [
      {
        id: 'perf-page-weight',
        title: 'Main pages load in under 3 seconds on mobile',
        description: 'The key pages (home, a service page, a product or contact page) render in under three seconds on a throttled phone connection.',
        severity: 'high',
        remediation: 'Run the live URL through PageSpeed Insights on mobile. Fix the heaviest images and the largest blocking scripts first.',
      },
      {
        id: 'perf-image-compression',
        title: 'Images are compressed and sized correctly',
        description: 'Images are served in a modern format at roughly the size they display — no 4000px photos scaled down to 400px.',
        severity: 'high',
        remediation: 'Export images as WebP or JPEG at about twice the display width, and re-upload the oversized ones.',
      },
      {
        id: 'perf-unused-scripts',
        title: 'Unneeded scripts, plugins and fonts are removed',
        description: 'No leftover platform plugins, chat widgets, A/B tools or font families that nothing on the site uses.',
        severity: 'high',
        remediation: 'Disable unused plugins and third-party embeds one at a time, reloading the page after each to confirm nothing breaks.',
      },
      {
        id: 'perf-lazy-loading',
        title: 'Below-the-fold media is lazy loaded',
        description: 'Images and video further down the page load only when scrolled to, so the first screen arrives fast.',
        severity: 'medium',
        remediation: 'Enable native lazy loading (loading="lazy") or the platform\u2019s lazy-load setting for images below the first screen.',
      },
      {
        id: 'perf-layout-shift',
        title: 'Content does not jump while loading',
        description: 'Images, embeds and ads have reserved space, so text does not shift as the page loads.',
        severity: 'medium',
        remediation: 'Set explicit width and height (or aspect-ratio) on images and embeds, and reserve space for anything injected by a script.',
      },
      {
        id: 'perf-caching',
        title: 'CSS and JavaScript are minified and cached',
        description: 'Assets are compressed, fingerprinted and served with caching headers; the platform\u2019s optimisation settings are on.',
        severity: 'medium',
        remediation: 'Turn on the platform\u2019s minify/compress and browser-cache settings, or serve built assets with long-lived cache headers.',
      },
      {
        id: 'perf-font-loading',
        title: 'Web fonts do not block text',
        description: 'Text is readable while fonts load — no invisible text flash, and only the weights actually used are loaded.',
        severity: 'low',
        remediation: 'Use font-display: swap, preload the primary font file, and drop font weights the design never uses.',
      },
    ],
  },

  {
    id: 'security',
    name: 'Security',
    description: 'The site is served securely and nothing private is exposed.',
    items: [
      {
        id: 'sec-https',
        title: 'The whole site loads over HTTPS',
        description: 'Every page loads over https with no mixed-content warnings, and http URLs redirect to https.',
        severity: 'critical',
        remediation: 'Force HTTPS in the platform settings, then reload each page and clear any http:// references in content or embeds.',
      },
      {
        id: 'sec-no-secrets-exposed',
        title: 'No credentials or keys exposed',
        description: 'No API keys, passwords, admin logins or internal notes appear in page source, public repos or downloadable files.',
        severity: 'critical',
        remediation: 'Search the page source and any public repo for key, secret, password and token. Move anything found into the platform\u2019s secret store and rotate it.',
      },
      {
        id: 'sec-ssl-valid',
        title: 'The SSL certificate is valid for every hostname',
        description: 'The certificate is current, issued for the domain, and covers both the www and non-www hostnames.',
        severity: 'critical',
        remediation: 'Open the site on https:// and https://www. and confirm there is no certificate warning. Reissue the certificate for both hostnames if either fails.',
      },
      {
        id: 'sec-forms-protected',
        title: 'Public forms are protected against spam',
        description: 'Contact, signup and checkout forms have spam protection (honeypot, captcha or rate limiting) and are not open relays.',
        severity: 'high',
        remediation: 'Enable the platform\u2019s spam protection or add a honeypot field plus a server-side rate limit.',
      },
      {
        id: 'sec-admin-protected',
        title: 'Admin areas require authentication',
        description: 'Any admin, dashboard or CMS path is behind a login and is not linked from the public site.',
        severity: 'high',
        remediation: 'Move the admin path behind the platform login, add a strong password and two-factor where available, and remove public links to it.',
      },
      {
        id: 'sec-security-headers',
        title: 'Basic security headers are set',
        description: 'HSTS, X-Content-Type-Options and a Content-Security-Policy where the platform allows them.',
        severity: 'medium',
        remediation: 'Add the headers at the host or platform level and re-check the response headers on the live domain.',
      },
      {
        id: 'sec-backups',
        title: 'A recent backup exists and restores',
        description: 'The site and its content are backed up, the backup is recent, and a restore has been tested at least once.',
        severity: 'medium',
        remediation: 'Take a backup before launch, store a copy off the platform, and confirm you can restore it.',
      },
    ],
  },

  {
    id: 'analytics',
    name: 'Analytics',
    description: 'Traffic and conversions are measured, and the numbers can be trusted.',
    items: [
      {
        id: 'analytics-installed',
        title: 'Analytics is recording page views',
        description: 'The analytics tag is installed on the live domain and the real-time report shows your own visit.',
        severity: 'high',
        remediation: 'Install the tag, open the site in a private window, and confirm your visit appears in the real-time report.',
      },
      {
        id: 'analytics-conversions',
        title: 'Key conversions are tracked',
        description: 'Form submissions, purchases, calls and signups are recorded as events or goals, not just page views.',
        severity: 'high',
        remediation: 'Define one event per conversion, trigger it on the confirmation state (not the button click), and verify it fires once.',
      },
      {
        id: 'analytics-consent',
        title: 'Analytics respects the consent choice',
        description: 'Where consent is required, analytics and marketing tags only fire after the visitor agrees.',
        severity: 'high',
        remediation: 'Gate the tag behind the consent manager and test with consent denied — nothing should load except strictly necessary scripts.',
      },
      {
        id: 'analytics-search-console',
        title: 'Search Console is verified',
        description: 'The site is verified in Google Search Console (or the equivalent) and data is arriving.',
        severity: 'medium',
        remediation: 'Verify the property by DNS or meta tag and submit the sitemap.',
      },
      {
        id: 'analytics-no-duplicates',
        title: 'No duplicate tracking tags',
        description: 'One instance of each tag fires per page — no double counting from a plugin plus a pasted snippet.',
        severity: 'medium',
        remediation: 'Check the page source and a tag inspector for repeated container or tracking IDs and remove the duplicate.',
      },
      {
        id: 'analytics-test-filtering',
        title: 'Internal and test traffic is filtered',
        description: 'Your own visits and test orders are excluded so the first month of reporting is clean.',
        severity: 'low',
        remediation: 'Exclude the office IP or use a browser extension to opt out on every device used for testing.',
      },
    ],
  },

  {
    id: 'legal',
    name: 'Legal',
    description: 'Required policies and business information are published and accurate.',
    items: [
      {
        id: 'legal-privacy-policy',
        title: 'A privacy policy is published and linked',
        description: 'A privacy policy describing what data the site collects and why is published and reachable from every page footer.',
        severity: 'critical',
        remediation: 'Publish the policy at a stable URL and link it in the footer of every page, including landing pages.',
      },
      {
        id: 'legal-contact-identity',
        title: 'Business identity and contact details are published',
        description: 'The legal business name and a working contact method are shown, as required in most jurisdictions.',
        severity: 'high',
        remediation: 'Add the legal entity name, a monitored email address and, where required, the registered address to the footer or contact page.',
      },
      {
        id: 'legal-cookie-notice',
        title: 'Cookie notice matches what the site sets',
        description: 'The cookie banner or notice accurately lists the categories of cookies the site actually sets, and blocking them works.',
        severity: 'high',
        remediation: 'Audit the cookies the site sets, update the notice to match, and confirm that rejecting non-essential cookies actually stops them.',
      },
      {
        id: 'legal-terms',
        title: 'Terms of use exist where required',
        description: 'Terms are published where the site sells, takes bookings, runs memberships or collects user content.',
        severity: 'medium',
        remediation: 'Publish terms covering payment, cancellation, returns and acceptable use, and link them at checkout or signup.',
      },
      {
        id: 'legal-third-party-licences',
        title: 'Third-party assets are licensed',
        description: 'Images, icons, fonts and stock media are licensed for commercial use and any required attribution is present.',
        severity: 'medium',
        remediation: 'Replace anything with an unclear licence and add attribution where the licence requires it.',
      },
      {
        id: 'legal-copyright',
        title: 'Copyright notice is current',
        description: 'The copyright line shows the current year and the correct rights holder.',
        severity: 'low',
        remediation: 'Update the footer copyright line, or make the year dynamic.',
      },
    ],
  },

  {
    id: 'commerce',
    name: 'Commerce',
    description: 'Only shown for Ecommerce and Membership sites: buying works and the numbers are right.',
    items: [
      {
        id: 'commerce-test-order',
        title: 'A complete test order goes through',
        description: 'A real order can be placed end to end: cart, checkout, payment, confirmation page and confirmation email.',
        severity: 'critical',
        remediation: 'Place a real order with a live payment method (or the platform\u2019s test mode), then refund it. Confirm the confirmation email arrives.',
        applicableSiteTypes: ['Ecommerce', 'Membership'],
      },
      {
        id: 'commerce-pricing',
        title: 'Prices, tax and shipping are correct',
        description: 'Prices, taxes, shipping costs and currency display correctly and are shown before the customer commits.',
        severity: 'high',
        remediation: 'Check a product with a discount, one with tax and one with shipping. Compare the totals against the expected figures.',
        applicableSiteTypes: ['Ecommerce', 'Membership'],
      },
      {
        id: 'commerce-product-pages',
        title: 'Product pages are complete',
        description: 'Each product shows correct images, variants, stock status, description and delivery information.',
        severity: 'medium',
        remediation: 'Review every live product for images, variants and stock. Hide anything that is not ready to sell.',
        applicableSiteTypes: ['Ecommerce', 'Membership'],
      },
    ],
  },
];
