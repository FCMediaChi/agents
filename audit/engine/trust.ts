import type { CheckerInput, CheckerResult, AuditCheck } from './types';

export function analyzeTrust(input: CheckerInput): CheckerResult {
  const { $, url } = input;
  const checks: AuditCheck[] = [];

  // 1. SSL/HTTPS
  const isHttps = url.startsWith('https://');

  checks.push({
    check_name: 'ssl_https',
    label: 'Site uses HTTPS/SSL',
    passed: isHttps,
    severity: 'critical',
    detail: isHttps
      ? 'Site is served over HTTPS — connection is secure.'
      : 'Site is served over HTTP — data is not encrypted.',
    recommendation: isHttps
      ? null
      : 'Install an SSL certificate and redirect all HTTP traffic to HTTPS.'
  });

  // 2. Privacy policy link
  const allLinkText = $('a').map((_, el) => $(el).text().toLowerCase().trim()).get();
  const allHrefs = $('a[href]').map((_, el) => $(el).attr('href') || '').get();

  const hasPrivacyLink = allLinkText.some(t => /privacy|privacy policy/.test(t)) ||
    allHrefs.some(h => /privacy/.test(h));

  checks.push({
    check_name: 'privacy_policy',
    label: 'Privacy policy page is linked',
    passed: hasPrivacyLink,
    severity: 'warning',
    detail: hasPrivacyLink
      ? 'Privacy policy link found on the page.'
      : 'No privacy policy link detected.',
    recommendation: hasPrivacyLink
      ? null
      : 'Add a privacy policy page and link to it in your footer (often legally required).'
  });

  // 3. Contact info
  const bodyText = $('body').text();
  const hasEmail = /[\w.-]+@[\w.-]+\.\w{2,}/.test(bodyText);
  const hasPhone = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(bodyText);
  const footerText = $('footer, [class*="footer"], [id*="footer"]').text().toLowerCase();
  const hasAddress = /address|street|suite|road|avenue|boulevard|drive| lane|p\.?\s*o\.?\s*box/i.test(bodyText);

  checks.push({
    check_name: 'contact_visibility',
    label: 'Contact information is visible on the site',
    passed: hasEmail || hasPhone || hasAddress,
    severity: 'warning',
    detail: [hasEmail ? 'email' : null, hasPhone ? 'phone' : null, hasAddress ? 'address' : null]
      .filter(Boolean)
      .join(', ')
      ? `Contact info found: ${[hasEmail ? 'email' : null, hasPhone ? 'phone' : null, hasAddress ? 'address' : null].filter(Boolean).join(', ')}`
      : 'No email, phone, or address detected on the page.',
    recommendation: hasEmail || hasPhone || hasAddress
      ? null
      : 'Display your contact information (email, phone, or physical address) prominently on the site.'
  });

  // 4. Social media links
  const socialPatterns = ['facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com', 'youtube.com', 'tiktok.com', 'github.com'];
  const hasSocialLinks = allHrefs.some(h => socialPatterns.some(p => h.includes(p)));

  checks.push({
    check_name: 'social_media',
    label: 'Social media profiles are linked',
    passed: hasSocialLinks,
    severity: 'info',
    detail: hasSocialLinks
      ? 'Social media links detected on the page.'
      : 'No social media profile links found.',
    recommendation: hasSocialLinks
      ? null
      : 'Add links to your social media profiles to build credibility and engagement.'
  });

  // 5. Testimonials / reviews
  const testimonialIndicators = /testimonial|review|rating|star|trustpilot|google reviews|what our clients say/i;
  const hasTestimonials = testimonialIndicators.test(bodyText);

  checks.push({
    check_name: 'testimonials',
    label: 'Testimonials or reviews are present',
    passed: hasTestimonials,
    severity: 'info',
    detail: hasTestimonials
      ? 'Testimonial or review content detected on the page.'
      : 'No testimonials, reviews, or ratings found.',
    recommendation: hasTestimonials
      ? null
      : 'Add customer testimonials or reviews to build social proof and trust.'
  });

  // 6. Security badges / trust seals
  const trustSeals = ['norton', 'mcafee', 'truste', 'bbb', 'ssl', 'secure', 'trusted site', 'verified', 'payment icons'];
  const footerHtml = $('footer').html()?.toLowerCase() || '';
  const pageHtml = $.html().toLowerCase();
  const hasTrustSeals = trustSeals.some(seal => pageHtml.includes(seal));

  checks.push({
    check_name: 'trust_seals',
    label: 'Trust badges or security seals are displayed',
    passed: hasTrustSeals,
    severity: 'info',
    detail: hasTrustSeals
      ? 'Trust badges, security seals, or certification indicators detected.'
      : 'No trust badges or security seals found.',
    recommendation: hasTrustSeals
      ? null
      : 'Consider adding trust badges (SSL, payment icons, BBB) to reassure visitors.'
  });

  return {
    dimension: 'trust',
    label: 'Trust Signals',
    icon: '🛡️',
    checks
  };
}