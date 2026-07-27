import type { CheckerInput, CheckerResult, AuditCheck } from './types';

export function analyzeHomepage(input: CheckerInput): CheckerResult {
  const { $, url } = input;
  const checks: AuditCheck[] = [];

  // 1. Meta title
  const titleTag = $('title').first().text().trim();
  const titleLength = titleTag.length;
  if (titleTag && titleLength > 0) {
    checks.push({
      check_name: 'meta_title',
      label: 'Meta title is present and well-sized',
      passed: titleLength >= 30 && titleLength <= 65,
      severity: 'critical',
      detail: titleLength >= 30 && titleLength <= 65
        ? `Meta title found: "${titleTag.substring(0, 60)}" (${titleLength} chars)`
        : titleTag
          ? `Meta title found but length is ${titleLength} chars (recommended: 50-60)`
          : null,
      recommendation: titleLength >= 30 && titleLength <= 65
        ? null
        : 'Update your meta title to be 50-60 characters for optimal search display.'
    });
  } else {
    checks.push({
      check_name: 'meta_title',
      label: 'Meta title is present',
      passed: false,
      severity: 'critical',
      detail: 'No meta title tag found on the page.',
      recommendation: 'Add a descriptive <title> tag (50-60 characters) that includes your primary keyword.'
    });
  }

  // 2. Meta description
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  const descLength = metaDesc.trim().length;
  if (descLength > 0) {
    checks.push({
      check_name: 'meta_description',
      label: 'Meta description is present and well-sized',
      passed: descLength >= 120 && descLength <= 165,
      severity: 'critical',
      detail: descLength >= 120 && descLength <= 165
        ? `Meta description found (${descLength} chars)`
        : `Meta description found but length is ${descLength} chars (recommended: 150-160)`,
      recommendation: descLength >= 120 && descLength <= 165
        ? null
        : 'Adjust your meta description to 150-160 characters for optimal search snippets.'
    });
  } else {
    checks.push({
      check_name: 'meta_description',
      label: 'Meta description is present',
      passed: false,
      severity: 'critical',
      detail: 'No meta description tag found on the page.',
      recommendation: 'Add a meta description (150-160 characters) summarizing the page content.'
    });
  }

  // 3. OG tags
  const ogTitle = $('meta[property="og:title"]').attr('content') || '';
  const ogDesc = $('meta[property="og:description"]').attr('content') || '';
  const ogImage = $('meta[property="og:image"]').attr('content') || '';
  const ogCount = [ogTitle, ogDesc, ogImage].filter(Boolean).length;

  checks.push({
    check_name: 'og_tags',
    label: 'Open Graph tags are present',
    passed: ogCount >= 2,
    severity: 'warning',
    detail: ogCount >= 2
      ? `${ogCount}/3 essential OG tags found${ogTitle ? ' (og:title' : ''}${ogDesc ? ', og:description' : ''}${ogImage ? ', og:image' : ''}${ogTitle ? ')' : ''}`
      : `Only ${ogCount}/3 essential OG tags found. Missing: ${!ogTitle ? 'og:title ' : ''}${!ogDesc ? 'og:description ' : ''}${!ogImage ? 'og:image' : ''}`,
    recommendation: ogCount >= 2
      ? null
      : 'Add missing Open Graph tags to control how your page appears when shared on social media.'
  });

  // 4. H1 check
  const h1Tags = $('h1');
  const h1Text = h1Tags.first().text().trim();
  checks.push({
    check_name: 'h1_present',
    label: 'Page has a single, non-empty H1 heading',
    passed: h1Tags.length === 1 && h1Text.length > 0,
    severity: 'critical',
    detail: h1Tags.length === 0
      ? 'No H1 tag found on the page.'
      : h1Tags.length > 1
        ? `${h1Tags.length} H1 tags found (recommended: exactly 1)`
        : h1Text.length > 0
          ? `H1 found: "${h1Text.substring(0, 60)}"`
          : 'H1 tag exists but is empty.',
    recommendation: h1Tags.length !== 1 || !h1Text
      ? 'Use exactly one H1 heading that clearly describes the page purpose.'
      : null
  });

  // 5. CTA visibility
  const actionWords = ['get started', 'sign up', 'buy now', 'shop now', 'subscribe', 'try free', 'learn more', 'start free', 'book now', 'contact us', 'schedule', 'purchase', 'order now', 'register'];
  const links = $('a, button').map((_, el) => $(el).text().toLowerCase().trim()).get();
  const ctaFound = links.some(text => actionWords.some(word => text.includes(word)));

  checks.push({
    check_name: 'cta_visibility',
    label: 'Clear call-to-action button or link is visible',
    passed: ctaFound,
    severity: 'warning',
    detail: ctaFound
      ? 'Found action-oriented buttons/links (e.g., Get Started, Sign Up, Buy Now)'
      : 'No obvious call-to-action button or link found on the page.',
    recommendation: ctaFound
      ? null
      : 'Add a prominent call-to-action button (e.g., "Get Started", "Sign Up") above the fold.'
  });

  return {
    dimension: 'homepage',
    label: 'Homepage Analysis',
    icon: '🏠',
    checks
  };
}