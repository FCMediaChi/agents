import * as cheerio from 'cheerio';

export interface PitchFinding {
  issue: string;
  severity: 'critical' | 'warning' | 'suggestion';
  why_matters: string;
  fix: string;
}

export interface ColdEmailScript {
  subject: string;
  body: string;
  signature: string;
}

export interface PitchAnalysis {
  findings: PitchFinding[];
  email: ColdEmailScript;
}

interface AgencyInfo {
  agency_name: string;
  services: string[];
}

async function fetchSite(url: string): Promise<{ html: string; error?: string }> {
  const normalized = url.startsWith('http') ? url : `https://${url}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(normalized, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NuriaPipeline/1.0)', 'Accept': 'text/html' },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) return { html: '', error: `HTTP ${res.status}` };
    return { html: await res.text() };
  } catch (e: any) {
    return { html: '', error: e.message || 'Fetch failed' };
  }
}

export async function analyzePitch(
  prospectName: string,
  url: string,
  service: string,
  agency?: AgencyInfo
): Promise<PitchAnalysis> {
  const findings: PitchFinding[] = [];
  const { html, error } = await fetchSite(url);

  if (error) {
    findings.push({
      issue: `Could not access ${url}: ${error}`,
      severity: 'critical',
      why_matters: 'The site may be down or blocking automated checks.',
      fix: 'Verify the URL is correct and the site is publicly accessible.',
    });
    return { findings, email: buildFallbackEmail(prospectName, service, agency, url) };
  }

  const $ = cheerio.load(html);
  const bodyText = $('body').text().toLowerCase();
  const imgs = $('img');
  const links = $('a[href]');
  const stylesheets = $('link[rel="stylesheet"]');
  const scripts = $('script[src]');
  const forms = $('form');
  const headings = $('h1, h2, h3');
  const title = $('title').text().trim();
  const metaDesc = $('meta[name="description"]').attr('content') || '';

  // ============ SPEED HEURISTICS ============
  const htmlSize = html.length;
  if (htmlSize > 300000) {
    findings.push({
      issue: `Large page size (${Math.round(htmlSize/1024)}KB)`,
      severity: 'critical',
      why_matters: 'Slow page loads increase bounce rates and hurt SEO rankings.',
      fix: 'Compress assets, enable gzip/brotli, and consider lazy loading below-the-fold content.',
    });
  } else if (htmlSize > 150000) {
    findings.push({
      issue: `Page size is ${Math.round(htmlSize/1024)}KB — could be leaner`,
      severity: 'warning',
      why_matters: 'Faster sites convert better; every 100ms delay costs conversions.',
      fix: 'Minify HTML, compress images, and reduce render-blocking resources.',
    });
  }

  // Check for render-blocking resources
  if (scripts.length > 10) {
    findings.push({
      issue: `${scripts.length} external scripts — likely slowing page load`,
      severity: 'warning',
      why_matters: 'Excessive scripts block rendering and increase Time to Interactive.',
      fix: 'Audit scripts, defer non-critical JS, consolidate where possible.',
    });
  }
  if (stylesheets.length > 5) {
    findings.push({
      issue: `${stylesheets.length} CSS files — consider consolidation`,
      severity: 'suggestion',
      why_matters: 'Multiple stylesheet requests add round-trips and delay first paint.',
      fix: 'Combine CSS files or use a bundler to reduce HTTP requests.',
    });
  }

  // Large images estimate
  const largeImgs = imgs.filter((_, el) => {
    const src = ($(el).attr('src') || '').toLowerCase();
    return src.endsWith('.png') || src.endsWith('.bmp') || src.includes('original');
  });
  if (largeImgs.length > 3) {
    findings.push({
      issue: `${largeImgs.length} potentially unoptimized images (PNG/BMP/heavy formats)`,
      severity: 'warning',
      why_matters: 'Unoptimized images are the #1 cause of slow page loads.',
      fix: 'Convert to WebP/AVIF, use responsive srcset, and compress aggressively.',
    });
  }

  // ============ LAYOUT ============
  if (!$('meta[name="viewport"]').length) {
    findings.push({
      issue: 'Missing viewport meta tag',
      severity: 'critical',
      why_matters: 'Without viewport, mobile visitors see a broken, zoomed-out layout.',
      fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
    });
  }

  // Font size check
  const smallFontCount = $('[style*="font-size"],[style*="font-size"]').filter((_, el) => {
    const style = ($(el).attr('style') || '').toLowerCase();
    const match = style.match(/font-size:\s*(\d+)px/);
    return match && parseInt(match[1]) < 14;
  }).length;
  if (smallFontCount > 0) {
    findings.push({
      issue: `${smallFontCount} element(s) with small font size (< 14px)`,
      severity: 'warning',
      why_matters: 'Small text is hard to read on mobile, hurting engagement and accessibility.',
      fix: 'Set base font size to at least 16px, use relative units (rem/em).',
    });
  }

  // ============ SEO ============
  if (!title) {
    findings.push({
      issue: 'Missing page title',
      severity: 'critical',
      why_matters: 'Title tags are the #1 on-page SEO factor and appear in search results.',
      fix: 'Add a descriptive, keyword-rich title tag (50-60 characters).',
    });
  } else if (title.length < 10) {
    findings.push({
      issue: `Page title too short: "${title}"`,
      severity: 'warning',
      why_matters: 'Short titles miss keyword opportunities and look sparse in search results.',
      fix: 'Expand title to 50-60 characters with primary keywords.',
    });
  } else if (title.length > 70) {
    findings.push({
      issue: `Page title truncated in search results (${title.length} chars)`,
      severity: 'suggestion',
      why_matters: 'Google truncates titles over ~60 chars, hiding important information.',
      fix: 'Trim title to 50-60 characters, keeping key phrases at the front.',
    });
  }

  if (!metaDesc) {
    findings.push({
      issue: 'Missing meta description',
      severity: 'warning',
      why_matters: 'Meta descriptions influence click-through rates from search results.',
      fix: 'Write a compelling 150-160 character meta description with a call to action.',
    });
  }

  const h1s = $('h1');
  if (h1s.length === 0) {
    findings.push({
      issue: 'No H1 heading found',
      severity: 'critical',
      why_matters: 'H1s signal page topic to search engines and structure content for readers.',
      fix: 'Add a single, keyword-focused H1 heading at the top of the main content.',
    });
  } else if (h1s.length > 1) {
    findings.push({
      issue: `Multiple H1 headings (${h1s.length}) — should have exactly one`,
      severity: 'warning',
      why_matters: 'Multiple H1s dilute SEO signals and confuse screen readers.',
      fix: 'Keep one H1 per page; use H2-H6 for subheadings.',
    });
  }

  const imgsWithoutAlt = imgs.filter((_, el) => !$(el).attr('alt')).length;
  if (imgsWithoutAlt > 0) {
    findings.push({
      issue: `${imgsWithoutAlt} image(s) missing alt text`,
      severity: 'warning',
      why_matters: 'Missing alt text hurts accessibility and image search visibility.',
      fix: 'Add descriptive alt attributes to all content images.',
    });
  }

  // Schema markup
  const hasSchema = $('script[type="application/ld+json"]').length > 0;
  if (!hasSchema) {
    findings.push({
      issue: 'No structured data (Schema.org) markup detected',
      severity: 'suggestion',
      why_matters: 'Schema markup enables rich snippets in search results, boosting visibility.',
      fix: 'Add JSON-LD structured data for Organization, LocalBusiness, or relevant schema types.',
    });
  }

  // ============ CONVERSION ============
  const ctaPatterns = /get started|contact us|free quote|book a call|schedule|get a demo|sign up|buy now|learn more|call now/i;
  const hasCta = bodyText.match(ctaPatterns);
  if (!hasCta) {
    findings.push({
      issue: 'No clear call-to-action (CTA) detected',
      severity: 'critical',
      why_matters: 'Without a CTA, visitors don\'t know what to do next — they leave.',
      fix: 'Add a prominent, action-oriented CTA button (e.g., "Get Your Free Quote").',
    });
  }

  if (forms.length === 0) {
    findings.push({
      issue: 'No contact form found',
      severity: 'warning',
      why_matters: 'Contact forms are the most reliable lead generation tool on a website.',
      fix: 'Add a simple, above-the-fold contact form with minimal fields.',
    });
  }

  // ============ DESIGN ============
  const colors = new Set<string>();
  $('[style*="color"],[style*="background"]').each((_, el) => {
    const style = ($(el).attr('style') || '').toLowerCase();
    const matches = style.match(/#[0-9a-f]{3,6}|rgb\([^)]+\)/gi) || [];
    matches.forEach(c => colors.add(c));
  });
  if (colors.size < 3) {
    findings.push({
      issue: 'Limited color palette — may lack visual hierarchy',
      severity: 'suggestion',
      why_matters: 'A consistent, purposeful color system builds trust and guides attention.',
      fix: 'Define a brand color palette with primary, secondary, and accent colors.',
    });
  }

  // Font count
  const fontFamilies = new Set<string>();
  $('[style*="font-family"]').each((_, el) => {
    const style = ($(el).attr('style') || '').toLowerCase();
    const match = style.match(/font-family:\s*([^;]+)/);
    if (match) fontFamilies.add(match[1].trim());
  });
  if (fontFamilies.size > 3) {
    findings.push({
      issue: `${fontFamilies.size} different font families — inconsistent typography`,
      severity: 'suggestion',
      why_matters: 'Too many fonts create visual noise and slow page rendering.',
      fix: 'Limit to 1-2 font families (heading + body) for a cohesive look.',
    });
  }

  // Build email script
  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const warningCount = findings.filter(f => f.severity === 'warning').length;
  const totalIssues = findings.length;

  const agencyName = agency?.agency_name || 'Our team';
  const serviceLabel = service === 'Other' ? 'improve their website' : service.toLowerCase();

  const email = buildEmail(prospectName, url, serviceLabel, agencyName, findings, criticalCount, warningCount, totalIssues);

  return { findings, email };
}

function buildEmail(
  prospectName: string,
  url: string,
  service: string,
  agencyName: string,
  findings: PitchFinding[],
  criticalCount: number,
  warningCount: number,
  totalIssues: number
): ColdEmailScript {
  const topCritical = findings.filter(f => f.severity === 'critical').slice(0, 2);
  const domain = url.replace(/https?:\/\//, '').replace(/\/$/, '');

  const subject = `Quick audit of ${domain} — found ${totalIssues} opportunities to improve`;

  let body = `Hi ${prospectName || 'there'},\n\n`;
  body += `I took a quick look at ${url} and noticed ${totalIssues} things that might be holding back your results. Here are the top issues:\n\n`;

  for (const f of topCritical) {
    body += `• ${f.issue}\n`;
  }
  body += `\nThese aren't just cosmetic — they directly impact how many visitors turn into customers.\n\n`;
  body += `At ${agencyName}, we specialize in ${service}. We've helped businesses like yours fix these exact problems and see measurable improvements in traffic, leads, and revenue.\n\n`;
  body += `Would you be open to a 15-minute call this week? I'll walk you through the full audit and share specific recommendations — no pitch, just value.\n\n`;
  body += `Best,\n[Agency Contact Name]\n${agencyName}`;

  const signature = `${agencyName}\nWebsite: [Your Website Here]`;

  return { subject, body, signature };
}

function buildFallbackEmail(
  prospectName: string,
  service: string,
  agency: AgencyInfo | undefined,
  url: string
): ColdEmailScript {
  const agencyName = agency?.agency_name || 'Our team';
  const domain = url.replace(/https?:\/\//, '').replace(/\/$/, '');
  const serviceLabel = service === 'Other' ? 'improving websites' : service.toLowerCase();

  return {
    subject: `Helping ${domain} get better results`,
    body: `Hi ${prospectName || 'there'},\n\nI came across ${url} and wanted to reach out. At ${agencyName}, we help businesses like yours with ${serviceLabel}. We'd love to share some insights on how to improve your online presence.\n\nWould you be open to a quick chat this week?\n\nBest,\n[Agency Contact Name]\n${agencyName}`,
    signature: `${agencyName}\nWebsite: [Your Website Here]`,
  };
}
