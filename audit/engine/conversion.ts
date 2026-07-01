import type { CheckerInput, CheckerResult, AuditCheck } from './types';

export function analyzeConversion(input: CheckerInput): CheckerResult {
  const { $ } = input;
  const checks: AuditCheck[] = [];

  // 1. CTA buttons
  const ctaTexts = ['get started', 'sign up', 'buy now', 'shop now', 'subscribe', 'try free', 'start free', 'book now', 'schedule', 'purchase', 'order now', 'register', 'join now', 'claim', 'get access', 'start trial'];
  const allButtons = $('button, a[class*="btn"], a[class*="button"], a[href*="signup"], a[href*="register"], a[href*="pricing"]');
  const buttonTexts = allButtons.map((_, el) => $(el).text().toLowerCase().trim()).get();
  const hasCta = buttonTexts.some(t => ctaTexts.some(cta => t.includes(cta)));

  checks.push({
    check_name: 'cta_buttons',
    label: 'Primary call-to-action buttons are present',
    passed: hasCta,
    severity: 'critical',
    detail: hasCta
      ? 'Action-oriented buttons detected (e.g., Get Started, Sign Up, Buy Now).'
      : 'No clear call-to-action buttons found.',
    recommendation: hasCta
      ? null
      : 'Add clear, action-oriented CTA buttons (e.g., "Get Started", "Buy Now") to drive conversions.'
  });

  // 2. Forms
  const forms = $('form').length;
  const hasForm = forms > 0;
  const inputs = $('input:not([type="hidden"]):not([type="submit"]), textarea, select').length;

  checks.push({
    check_name: 'forms_present',
    label: 'Contact or signup forms are present',
    passed: hasForm && inputs >= 2,
    severity: 'warning',
    detail: hasForm
      ? `${forms} form${forms !== 1 ? 's' : ''} found with ${inputs} input field${inputs !== 1 ? 's' : ''}.`
      : 'No forms detected on the page.',
    recommendation: hasForm && inputs >= 2
      ? null
      : 'Add a contact form or signup form to capture leads and inquiries.'
  });

  // 3. Value proposition
  const heroArea = $('header, [class*="hero"], [class*="banner"], section').first().text().toLowerCase();
  const vpIndicators = ['we help', 'we provide', 'platform for', 'solution for', 'best', 'leading', 'trusted', 'award-winning', '#1', '#1'];
  const hasVP = vpIndicators.some(ind => heroArea.includes(ind));
  
  const firstH1 = $('h1').first().text().toLowerCase();
  const hasH1VP = firstH1.length >= 5;

  checks.push({
    check_name: 'value_proposition',
    label: 'Clear value proposition in the first screen',
    passed: hasVP || hasH1VP,
    severity: 'warning',
    detail: hasVP || hasH1VP
      ? hasVP
        ? 'Value proposition language detected in the hero area.'
        : 'H1 heading is present which communicates page purpose.'
      : 'No clear value proposition detected in the first screen area.',
    recommendation: hasVP || hasH1VP
      ? null
      : 'State your unique value proposition clearly in the hero section within the first screen.'
  });

  // 4. Social proof indicators
  const bodyText = $('body').text().toLowerCase();
  const proofIndicators = ['as featured in', 'trusted by', 'join', 'customers', 'clients', 'users', 'downloads', 'award', 'recognized', 'mentioned in'];
  const hasSocialProof = proofIndicators.some(ind => bodyText.includes(ind));

  checks.push({
    check_name: 'social_proof',
    label: 'Social proof indicators are present',
    passed: hasSocialProof,
    severity: 'info',
    detail: hasSocialProof
      ? 'Social proof detected (e.g., "Trusted by", "As featured in", customer counts).'
      : 'No social proof indicators found.',
    recommendation: hasSocialProof
      ? null
      : 'Add social proof elements like customer counts, testimonials, or "As featured in" logos.'
  });

  return {
    dimension: 'conversion',
    label: 'Conversion Ideas',
    icon: '📈',
    checks
  };
}