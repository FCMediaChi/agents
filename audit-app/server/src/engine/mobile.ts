import type { CheckerInput, CheckerResult, AuditCheck } from './types';

export function analyzeMobile(input: CheckerInput): CheckerResult {
  const { $ } = input;
  const checks: AuditCheck[] = [];

  // 1. Viewport meta tag
  const viewport = $('meta[name="viewport"]').attr('content') || '';
  const hasWidthDeviceWidth = viewport.includes('width=device-width');
  const hasInitialScale = viewport.includes('initial-scale=1') || viewport.includes('initial-scale=1.0');

  checks.push({
    check_name: 'viewport_meta',
    label: 'Viewport meta tag is properly configured',
    passed: hasWidthDeviceWidth && hasInitialScale,
    severity: 'critical',
    detail: viewport
      ? hasWidthDeviceWidth && hasInitialScale
        ? 'Viewport meta tag correctly configured with width=device-width and initial-scale=1'
        : `Viewport meta found but may be misconfigured: "${viewport}"`
      : 'No viewport meta tag found — page may not render properly on mobile.',
    recommendation: viewport && hasWidthDeviceWidth && hasInitialScale
      ? null
      : 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> for proper mobile rendering.'
  });

  // 2. Font size checks
  const smallFontSelectors = [
    '[style*="font-size:10px"]', '[style*="font-size: 10px"]',
    '[style*="font-size:11px"]', '[style*="font-size: 11px"]',
    '[style*="font-size:12px"]', '[style*="font-size: 12px"]',
  ];
  let smallFontElements = 0;
  for (const sel of smallFontSelectors) {
    smallFontElements += $(sel).length;
  }

  const styleTags = $('style').map((_, el) => $(el).html() || '').get().join(' ');
  const hasSmallFontDeclarations = /font-size\s*:\s*1[0-2]px/i.test(styleTags);

  checks.push({
    check_name: 'font_size',
    label: 'Font sizes are mobile-friendly (not too small)',
    passed: smallFontElements === 0 && !hasSmallFontDeclarations,
    severity: 'warning',
    detail: smallFontElements > 0 || hasSmallFontDeclarations
      ? 'Found font sizes of 12px or smaller which may be hard to read on mobile devices.'
      : 'No excessively small font sizes detected.',
    recommendation: smallFontElements > 0 || hasSmallFontDeclarations
      ? 'Use relative units (rem/em) and ensure body text is at least 16px for readability on mobile.'
      : null
  });

  // 3. Tap target sizing (heuristic: look for very small links/buttons)
  const allLinks = $('a').map((_, el) => ({
    text: $(el).text().trim(),
    html: $(el).html() || '',
    class: $(el).attr('class') || ''
  })).get();

  const smallTapTargets = allLinks.filter(l => {
    const innerText = l.text;
    return innerText.length > 0 && innerText.length < 3 && !l.class.includes('btn') && !l.class.includes('button');
  }).length;

  checks.push({
    check_name: 'tap_targets',
    label: 'Interactive elements have adequate tap target sizes',
    passed: smallTapTargets < 3,
    severity: 'warning',
    detail: smallTapTargets >= 3
      ? `Found ${smallTapTargets} very small link targets that may be difficult to tap on mobile.`
      : 'No undersized interactive elements detected.',
    recommendation: smallTapTargets >= 3
      ? 'Ensure buttons and links are at least 48x48px with adequate spacing for easy tapping.'
      : null
  });

  // 4. Responsive design indicators
  const hasMediaQueries = styleTags.includes('@media');
  const hasResponsiveClass = $('[class*="md:"], [class*="lg:"], [class*="sm:"]').length > 0;
  const hasFlexWrap = $('[class*="flex-wrap"], [style*="flex-wrap"]').length > 0;
  const isResponsive = hasMediaQueries || hasResponsiveClass || hasFlexWrap;

  checks.push({
    check_name: 'responsive_design',
    label: 'Page uses responsive design techniques',
    passed: isResponsive,
    severity: 'warning',
    detail: isResponsive
      ? 'Media queries or responsive classes detected — page likely adapts to different screen sizes.'
      : 'No responsive design indicators found. Page may not adapt well to mobile screens.',
    recommendation: isResponsive
      ? null
      : 'Implement responsive design using CSS media queries or a framework like Tailwind CSS.'
  });

  return {
    dimension: 'mobile',
    label: 'Mobile Friendliness',
    icon: '📱',
    checks
  };
}