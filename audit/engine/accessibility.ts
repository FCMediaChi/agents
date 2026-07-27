import type { CheckerInput, CheckerResult, AuditCheck } from './types';

export function analyzeAccessibility(input: CheckerInput): CheckerResult {
  const { $ } = input;
  const checks: AuditCheck[] = [];

  // 1. Alt text on images
  const images = $('img');
  const totalImages = images.length;
  const imagesWithAlt = images.filter((_, el) => {
    const alt = $(el).attr('alt');
    return alt !== undefined && alt !== null;
  }).length;
  const imagesWithEmptyAlt = images.filter((_, el) => {
    const alt = $(el).attr('alt');
    return alt === '';
  }).length;
  const imagesWithMeaningfulAlt = imagesWithAlt - imagesWithEmptyAlt;

  checks.push({
    check_name: 'alt_text',
    label: 'Images have descriptive alt text',
    passed: totalImages === 0 || imagesWithMeaningfulAlt >= totalImages * 0.8,
    severity: 'critical',
    detail: totalImages === 0
      ? 'No images found on the page.'
      : `${imagesWithMeaningfulAlt}/${totalImages} images have descriptive alt text${imagesWithEmptyAlt > 0 ? ` (${imagesWithEmptyAlt} decorative with empty alt).` : '.'}`,
    recommendation: totalImages > 0 && imagesWithMeaningfulAlt < totalImages * 0.8
      ? 'Add descriptive alt text to all images. Use empty alt (alt="") for decorative images.'
      : null
  });

  // 2. Heading hierarchy
  const h1Count = $('h1').length;
  const h2Count = $('h2').length;
  const h3Count = $('h3').length;
  const hasH4BeforeH3 = $('h4').length > 0 && $('h3').length === 0;
  const hasH5BeforeH4 = $('h5').length > 0 && $('h4').length === 0;
  const hasH6BeforeH5 = $('h6').length > 0 && $('h5').length === 0;
  const hierarchyBroken = hasH4BeforeH3 || hasH5BeforeH4 || hasH6BeforeH5;
  const hasHeadings = h1Count + h2Count + h3Count > 0;

  checks.push({
    check_name: 'heading_hierarchy',
    label: 'Heading hierarchy is logical (h1 → h2 → h3)',
    passed: !hierarchyBroken && hasHeadings,
    severity: 'warning',
    detail: !hasHeadings
      ? 'No heading tags (h1-h3) found on the page.'
      : hierarchyBroken
        ? 'Heading hierarchy is broken — skipping levels (e.g., h4 without h3).'
        : `Heading structure: ${h1Count} h1, ${h2Count} h2, ${h3Count} h3${h1Count > 1 ? ' (multiple h1s detected)' : ''}.`,
    recommendation: !hasHeadings
      ? 'Add heading tags (h1, h2, h3) to structure your content hierarchically.'
      : hierarchyBroken
        ? 'Maintain a logical heading hierarchy: h1 → h2 → h3 without skipping levels.'
        : null
  });

  // 3. Skip navigation
  const hasSkipLink = $('a[href*="#main"], a[href*="#content"], a[href*="#skip"], [class*="skip"], [id*="skip"]').length > 0;

  checks.push({
    check_name: 'skip_navigation',
    label: 'Skip navigation link is present',
    passed: hasSkipLink,
    severity: 'info',
    detail: hasSkipLink
      ? 'Skip navigation link detected — keyboard users can bypass repetitive navigation.'
      : 'No skip navigation link found.',
    recommendation: hasSkipLink
      ? null
      : 'Add a "Skip to content" link as the first focusable element for keyboard users.'
  });

  // 4. Descriptive link text
  const allLinks = $('a[href]').map((_, el) => ({
    text: $(el).text().trim(),
    href: $(el).attr('href') || ''
  })).get();

  const vagueLinkText = ['click here', 'read more', 'learn more', 'here', 'this', 'more', 'go', 'link', 'details'];
  const vagueLinks = allLinks.filter(l => {
    const t = l.text.toLowerCase().trim();
    return vagueLinkText.includes(t) || t.length === 0;
  });

  checks.push({
    check_name: 'descriptive_links',
    label: 'Links have descriptive, meaningful text',
    passed: vagueLinks.length === 0,
    severity: 'warning',
    detail: vagueLinks.length === 0
      ? 'All links have descriptive text.'
      : `Found ${vagueLinks.length} link${vagueLinks.length !== 1 ? 's' : ''} with vague or empty text like "click here" or "read more".`,
    recommendation: vagueLinks.length === 0
      ? null
      : 'Replace vague link text with descriptive phrases that indicate where the link goes.'
  });

  // 5. Form label association
  const formInputs = $('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select');
  const inputsWithLabels = formInputs.filter((_, el) => {
    const id = $(el).attr('id');
    return id && $(`label[for="${id}"]`).length > 0;
  }).length;
  const inputsWithAriaLabel = formInputs.filter((_, el) => {
    return $(el).attr('aria-label') || $(el).attr('aria-labelledby');
  }).length;
  const totalFormInputs = formInputs.length;
  const totalLabeled = inputsWithLabels + inputsWithAriaLabel;

  checks.push({
    check_name: 'form_labels',
    label: 'Form inputs have associated labels',
    passed: totalFormInputs === 0 || totalLabeled >= totalFormInputs,
    severity: 'warning',
    detail: totalFormInputs === 0
      ? 'No form inputs found on the page.'
      : `${totalLabeled}/${totalFormInputs} form inputs have associated labels or aria-labels.`,
    recommendation: totalFormInputs > 0 && totalLabeled < totalFormInputs
      ? 'Ensure every form input has an associated <label> element or aria-label attribute.'
      : null
  });

  return {
    dimension: 'accessibility',
    label: 'Accessibility',
    icon: '♿',
    checks
  };
}