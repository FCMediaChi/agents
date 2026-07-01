import type { CheckerInput, CheckerResult, AuditCheck } from './types';

export function analyzeNavigation(input: CheckerInput): CheckerResult {
  const { $ } = input;
  const checks: AuditCheck[] = [];

  // 1. Navigation/menu elements exist
  const navElements = $('nav, [role="navigation"], [class*="nav"], [class*="menu"], [id*="nav"], [id*="menu"]');
  const hasNav = navElements.length > 0;
  const navLinks = $('nav a, [role="navigation"] a, [class*="nav"] a, [class*="menu"] a').length;

  checks.push({
    check_name: 'nav_exists',
    label: 'Main navigation menu is present',
    passed: hasNav && navLinks >= 2,
    severity: 'critical',
    detail: hasNav
      ? `Navigation found with ${navLinks} link${navLinks !== 1 ? 's' : ''}.`
      : 'No clear navigation menu detected on the page.',
    recommendation: hasNav && navLinks >= 2
      ? null
      : 'Add a clear navigation menu with links to your main pages.'
  });

  // 2. Key pages check
  const allLinks = $('a[href]').map((_, el) => ({
    href: $(el).attr('href') || '',
    text: $(el).text().toLowerCase().trim()
  })).get();

  const uniqueLinkTexts = [...new Set(allLinks.map(l => l.text))];
  const allHrefs = allLinks.map(l => l.href.toLowerCase());

  const hasAbout = uniqueLinkTexts.some(t => /about|who we are|our story/.test(t)) || allHrefs.some(h => /about/.test(h));
  const hasContact = uniqueLinkTexts.some(t => /contact|get in touch|reach us/.test(t)) || allHrefs.some(h => /contact/.test(h));
  const hasPrivacy = uniqueLinkTexts.some(t => /privacy|privacy policy/.test(t)) || allHrefs.some(h => /privacy/.test(h));

  const keyPagesFound = [hasAbout, hasContact, hasPrivacy].filter(Boolean).length;

  checks.push({
    check_name: 'key_pages',
    label: 'Key pages (About, Contact, Privacy) are linked',
    passed: keyPagesFound >= 2,
    severity: 'warning',
    detail: keyPagesFound >= 2
      ? `Found ${keyPagesFound}/3 key pages:${hasAbout ? ' About' : ''}${hasContact ? ' Contact' : ''}${hasPrivacy ? ' Privacy' : ''}`
      : `Only ${keyPagesFound}/3 key pages found. Missing:${!hasAbout ? ' About' : ''}${!hasContact ? ' Contact' : ''}${!hasPrivacy ? ' Privacy' : ''}`,
    recommendation: keyPagesFound >= 2
      ? null
      : 'Add links to About, Contact, and Privacy pages in your navigation or footer.'
  });

  // 3. Navigation depth / page count
  const internalLinks = allLinks.filter(l => {
    const href = l.href;
    return href && !href.startsWith('http') && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:') && href !== '/';
  });
  const uniqueInternalPaths = [...new Set(internalLinks.map(l => l.href))];

  checks.push({
    check_name: 'page_depth',
    label: 'Site has multiple internal pages',
    passed: uniqueInternalPaths.length >= 3,
    severity: 'info',
    detail: `Found ${uniqueInternalPaths.length} unique internal page link${uniqueInternalPaths.length !== 1 ? 's' : ''}.`,
    recommendation: uniqueInternalPaths.length >= 3
      ? null
      : 'Add more internal content pages to improve site structure and SEO.'
  });

  // 4. Broken link indicators
  const brokenIndicators = $('a[href=""], a[href="#"], a[href="javascript:void(0)"], a:not([href])');
  const brokenCount = brokenIndicators.length;

  checks.push({
    check_name: 'broken_links',
    label: 'No broken or empty link indicators',
    passed: brokenCount === 0,
    severity: 'warning',
    detail: brokenCount === 0
      ? 'No empty or placeholder links detected.'
      : `Found ${brokenCount} link${brokenCount !== 1 ? 's' : ''} with empty or placeholder href values.`,
    recommendation: brokenCount === 0
      ? null
      : `Replace the ${brokenCount} placeholder link${brokenCount !== 1 ? 's' : ''} with proper URLs.`
  });

  return {
    dimension: 'navigation',
    label: 'Navigation Structure',
    icon: '🧭',
    checks
  };
}