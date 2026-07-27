import type { CheckerInput, CheckerResult, AuditCheck } from './types';

export function analyzeBranding(input: CheckerInput): CheckerResult {
  const { $, url } = input;
  const checks: AuditCheck[] = [];

  // 1. Title tag format consistency (check for brand name in title)
  const titleText = $('title').first().text().trim();
  const titleHasSeparator = titleText.includes('|') || titleText.includes('—') || titleText.includes('-') || titleText.includes('•');

  checks.push({
    check_name: 'title_format',
    label: 'Title tag follows a consistent format with brand name',
    passed: titleText.length > 0 && titleHasSeparator,
    severity: 'warning',
    detail: titleText
      ? titleHasSeparator
        ? `Title uses a separator format: "${titleText.substring(0, 60)}"`
        : `Title found but no separator detected: "${titleText.substring(0, 60)}"`
      : 'No title tag content found.',
    recommendation: titleHasSeparator
      ? null
      : 'Use a consistent title format like "Page Name | Brand Name" across all pages.'
  });

  // 2. H1 brand alignment
  const h1Text = $('h1').first().text().trim();
  const brandMentionsInH1 = h1Text.length > 0;

  checks.push({
    check_name: 'h1_branding',
    label: 'H1 heading reinforces brand or page purpose',
    passed: brandMentionsInH1 && h1Text.length >= 10,
    severity: 'warning',
    detail: h1Text
      ? h1Text.length >= 10
        ? `H1 found: "${h1Text.substring(0, 60)}"`
        : `H1 is very short: "${h1Text}"`
      : 'No H1 tag found for brand reinforcement.',
    recommendation: h1Text.length >= 10
      ? null
      : 'Ensure your H1 heading clearly communicates your brand value proposition.'
  });

  // 3. Logo / branding in header
  const hasLogo = $('img[alt*="logo"], img[src*="logo"], [class*="logo"], [id*="logo"]').length > 0;
  const headerText = $('header, nav, [class*="header"], [class*="navbar"]').first().text().trim();
  const domainName = new URL(url).hostname.replace('www.', '').split('.')[0];
  const brandInHeader = headerText.toLowerCase().includes(domainName.toLowerCase());

  checks.push({
    check_name: 'logo_branding',
    label: 'Logo or brand name is present in the header',
    passed: hasLogo || brandInHeader,
    severity: 'warning',
    detail: hasLogo
      ? 'Logo image found in the page header.'
      : brandInHeader
        ? `Brand name "${domainName}" appears in the header text.`
        : 'No clear logo or brand name found in the header area.',
    recommendation: hasLogo || brandInHeader
      ? null
      : 'Place your logo prominently in the header of every page for brand recognition.'
  });

  // 4. Contact info consistency
  const bodyText = $('body').text().toLowerCase();
  const hasEmail = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.test(bodyText);
  const hasPhone = /\b(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(bodyText);

  checks.push({
    check_name: 'contact_info',
    label: 'Contact information (email or phone) is visible',
    passed: hasEmail || hasPhone,
    severity: 'info',
    detail: hasEmail && hasPhone
      ? 'Both email and phone number found on the page.'
      : hasEmail
        ? 'Email address found on the page.'
        : hasPhone
          ? 'Phone number found on the page.'
          : 'No email address or phone number detected on the page.',
    recommendation: hasEmail || hasPhone
      ? null
      : 'Add visible contact information (email and/or phone) to build trust with visitors.'
  });

  return {
    dimension: 'branding',
    label: 'Brand Consistency',
    icon: '🎨',
    checks
  };
}