import * as cheerio from 'cheerio';

export interface CaseStudyInput {
  client_name: string;
  client_url?: string;
  old_site_url?: string;
  traffic_data?: {
    monthly_visitors_before?: number;
    monthly_visitors_after?: number;
    bounce_rate_before?: number;
    bounce_rate_after?: number;
    avg_session_before?: number;
    avg_session_after?: number;
  };
  revenue_data?: {
    monthly_revenue_before?: number;
    monthly_revenue_after?: number;
    conversion_rate_before?: number;
    conversion_rate_after?: number;
    lead_growth_before?: number;
    lead_growth_after?: number;
  };
}

export interface SiteAuditResult {
  url: string;
  title: string | null;
  issues: string[];
  score: number;
}

export interface GeneratedCaseStudy {
  problem: string;
  solution: string;
  results: string;
  metrics: MetricBlock[];
  narrative_title: string;
  executive_summary: string;
}

export interface MetricBlock {
  label: string;
  before: string;
  after: string;
  change: string;
  positive: boolean;
}

async function fetchSite(url: string): Promise<{ html: string; error?: string }> {
  const normalized = url.startsWith('http') ? url : `https://${url}`;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(normalized, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NuriaPipeline/1.0)' },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!res.ok) return { html: '', error: `HTTP ${res.status}` };
    return { html: await res.text() };
  } catch (e: any) {
    return { html: '', error: e.message || 'Fetch failed' };
  }
}

export async function auditSite(url: string): Promise<SiteAuditResult> {
  const { html, error } = await fetchSite(url);
  const issues: string[] = [];
  let title: string | null = null;

  if (error) {
    issues.push(`Could not fetch site: ${error}`);
    return { url, title: null, issues, score: 0 };
  }

  const $ = cheerio.load(html);

  // Title
  title = $('title').text().trim() || null;
  if (!title) issues.push('Missing page title');
  else if (title.length < 10) issues.push('Page title is too short (< 10 chars)');
  else if (title.length > 70) issues.push('Page title is too long (> 70 chars)');

  // Meta description
  const metaDesc = $('meta[name="description"]').attr('content');
  if (!metaDesc) issues.push('Missing meta description');
  else if (metaDesc.length < 50) issues.push('Meta description is too short');

  // H1
  const h1s = $('h1');
  if (h1s.length === 0) issues.push('Missing H1 heading');
  else if (h1s.length > 1) issues.push('Multiple H1 headings found');

  // Images without alt
  const imgsWithoutAlt = $('img:not([alt])').length;
  if (imgsWithoutAlt > 0) issues.push(`${imgsWithoutAlt} image(s) missing alt text`);

  // Viewport meta
  if (!$('meta[name="viewport"]').length) issues.push('Missing viewport meta tag');

  // Page size estimate
  const htmlSize = html.length;
  if (htmlSize > 200000) issues.push('Page HTML is very large (>200KB)');
  else if (htmlSize > 100000) issues.push('Page HTML is large (>100KB)');

  // Links count
  const links = $('a[href]').length;
  if (links < 5) issues.push('Very few links on page (< 5)');

  const score = Math.max(0, 100 - issues.length * 12);

  return { url, title, issues, score };
}

function fmtPct(before: number, after: number): string {
  if (!before) return 'N/A';
  const change = ((after - before) / before) * 100;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${Math.round(change)}%`;
}

function fmtNum(n?: number): string {
  if (n == null) return 'N/A';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtDuration(sec?: number): string {
  if (sec == null) return 'N/A';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

export function generateCaseStudy(input: CaseStudyInput, audit?: SiteAuditResult): GeneratedCaseStudy {
  const td = input.traffic_data || {};
  const rd = input.revenue_data || {};
  const auditIssues = audit?.issues || [];

  // Build metrics
  const metrics: MetricBlock[] = [];

  if (td.monthly_visitors_before != null && td.monthly_visitors_after != null) {
    metrics.push({
      label: 'Monthly Visitors',
      before: fmtNum(td.monthly_visitors_before),
      after: fmtNum(td.monthly_visitors_after),
      change: fmtPct(td.monthly_visitors_before, td.monthly_visitors_after),
      positive: td.monthly_visitors_after > td.monthly_visitors_before,
    });
  }

  if (td.bounce_rate_before != null && td.bounce_rate_after != null) {
    metrics.push({
      label: 'Bounce Rate',
      before: `${td.bounce_rate_before}%`,
      after: `${td.bounce_rate_after}%`,
      change: fmtPct(td.bounce_rate_before, td.bounce_rate_after),
      positive: td.bounce_rate_after < td.bounce_rate_before,
    });
  }

  if (td.avg_session_before != null && td.avg_session_after != null) {
    metrics.push({
      label: 'Avg Session Duration',
      before: fmtDuration(td.avg_session_before),
      after: fmtDuration(td.avg_session_after),
      change: fmtPct(td.avg_session_before, td.avg_session_after),
      positive: td.avg_session_after > td.avg_session_before,
    });
  }

  if (rd.conversion_rate_before != null && rd.conversion_rate_after != null) {
    metrics.push({
      label: 'Conversion Rate',
      before: `${rd.conversion_rate_before}%`,
      after: `${rd.conversion_rate_after}%`,
      change: fmtPct(rd.conversion_rate_before, rd.conversion_rate_after),
      positive: rd.conversion_rate_after > rd.conversion_rate_before,
    });
  }

  if (rd.monthly_revenue_before != null && rd.monthly_revenue_after != null) {
    metrics.push({
      label: 'Monthly Revenue',
      before: `$${fmtNum(rd.monthly_revenue_before)}`,
      after: `$${fmtNum(rd.monthly_revenue_after)}`,
      change: fmtPct(rd.monthly_revenue_before, rd.monthly_revenue_after),
      positive: rd.monthly_revenue_after > rd.monthly_revenue_before,
    });
  }

  if (rd.lead_growth_before != null && rd.lead_growth_after != null) {
    metrics.push({
      label: 'Lead Growth',
      before: fmtNum(rd.lead_growth_before),
      after: fmtNum(rd.lead_growth_after),
      change: fmtPct(rd.lead_growth_before, rd.lead_growth_after),
      positive: rd.lead_growth_after > rd.lead_growth_before,
    });
  }

  // Build Problem section
  let problem = '';
  if (audit && audit.issues.length > 0) {
    problem = `${input.client_name}'s website was underperforming. A technical audit of ${audit.url || 'their site'} revealed ${audit.issues.length} key issues:\n\n`;
    problem += audit.issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n');
    if (audit.score < 50) {
      problem += `\n\nWith an overall site health score of ${audit.score}/100, it was clear that ${input.client_name} needed a complete digital overhaul to compete effectively in their market.`;
    } else if (audit.score < 75) {
      problem += `\n\nWith a site health score of ${audit.score}/100, there was significant room for improvement across multiple areas.`;
    }
  } else {
    problem = `${input.client_name} approached us looking to improve their digital presence. `;
    if (td.bounce_rate_before && td.bounce_rate_before > 60) {
      problem += `Their bounce rate was alarmingly high at ${td.bounce_rate_before}%, signaling that visitors weren't finding what they needed. `;
    }
    if (rd.conversion_rate_before && rd.conversion_rate_before < 2) {
      problem += `Conversion rates were stagnant at ${rd.conversion_rate_before}%, leaving significant revenue on the table. `;
    }
    problem += `They needed a partner who could transform their online presence into a growth engine.`;
  }

  // Build Solution section
  let solution = `We partnered with ${input.client_name} to completely reimagine their digital experience. Our approach included:\n\n`;
  solution += `- **Strategic Discovery**: Deep analysis of their target audience, competitive landscape, and business goals\n`;
  solution += `- **UX & Design Overhaul**: Created a modern, intuitive interface optimized for conversion\n`;
  solution += `- **Technical Implementation**: Built a high-performance, SEO-optimized platform\n`;
  if (audit && audit.issues.some(i => i.includes('title') || i.includes('meta') || i.includes('H1'))) {
    solution += `- **SEO Foundation**: Addressed critical on-page SEO gaps identified in the audit\n`;
  }
  if (audit && audit.issues.some(i => i.includes('image') || i.includes('alt'))) {
    solution += `- **Accessibility Improvements**: Ensured all content is accessible and properly structured\n`;
  }
  solution += `\nEvery decision was driven by data and focused on measurable business outcomes.`;

  // Build Results section
  let results = `The transformation delivered exceptional results for ${input.client_name}:\n\n`;
  const positiveMetrics = metrics.filter(m => m.positive);
  if (positiveMetrics.length > 0) {
    positiveMetrics.forEach(m => {
      results += `- **${m.label}**: ${m.before} → ${m.after} (${m.change})\n`;
    });
  } else if (metrics.length > 0) {
    results += `Key metrics showed improvement across the board.\n`;
  } else {
    results += `The new website launched successfully, providing ${input.client_name} with a modern, high-performance digital platform built for growth.\n`;
  }
  results += `\n${input.client_name} now has a website that not only looks great but drives real business results — attracting more visitors, engaging them longer, and converting them at higher rates.`;

  // Executive summary
  const summary = `${input.client_name} partnered with us to transform their digital presence. Through a comprehensive redesign and development process, we delivered a modern, high-performance website that drove measurable improvements across all key metrics.`;

  const narrativeTitle = `${input.client_name}: Digital Transformation Case Study`;

  return { problem, solution, results, metrics, narrative_title: narrativeTitle, executive_summary: summary };
}
