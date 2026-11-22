import * as cheerio from 'cheerio';
import { writeText, parseJsonObject, readProseField, safeWrite, type TextWriter } from './ai.js';

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
  /** True when the prose came from the model, false when it is the template. */
  ai_generated: boolean;
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

type TrafficData = NonNullable<CaseStudyInput['traffic_data']>;
type RevenueData = NonNullable<CaseStudyInput['revenue_data']>;

/**
 * Metric blocks — pure arithmetic on the numbers the user entered.
 * These are never written by a model; they are the same today, tomorrow and
 * after any model failure.
 */
export function buildMetrics(td: TrafficData, rd: RevenueData): MetricBlock[] {
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

  return metrics;
}

/**
 * Build a case study for `input`.
 *
 * Deterministic by default: metric blocks, the numbered audit issues and the
 * site-health score are computed here and never delegated. The narrative
 * sections (problem, solution, results commentary, executive summary) are
 * written by the model; if it returns nothing usable, the original template
 * prose is returned unchanged.
 */
export async function generateCaseStudy(
  input: CaseStudyInput,
  audit?: SiteAuditResult,
  writer: TextWriter = writeText
): Promise<GeneratedCaseStudy> {
  const td = input.traffic_data || {};
  const rd = input.revenue_data || {};
  const metrics = buildMetrics(td, rd);
  const template = buildTemplateContent(input, audit, metrics, td, rd);

  const prose = await writeCaseStudyProse(input, audit, metrics, writer);
  if (!prose) {
    return { ...template, metrics, ai_generated: false };
  }

  const facts = auditIssueBlock(audit);
  const lines = metricLines(metrics);

  return {
    problem: facts ? `${prose.problem}\n\n${facts}` : prose.problem,
    solution: prose.solution,
    results: lines ? `${lines}\n\n${prose.results}` : prose.results,
    metrics,
    narrative_title: template.narrative_title,
    executive_summary: prose.executive_summary,
    ai_generated: true,
  };
}

/** The numbered audit issues plus the site-health sentence — always our own text. */
function auditIssueBlock(audit?: SiteAuditResult): string {
  if (!audit || audit.issues.length === 0) return '';

  let block = `A technical audit of ${audit.url || 'their site'} revealed ${audit.issues.length} key issues:\n\n`;
  block += audit.issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n');
  if (audit.score < 50) {
    block += `\n\nWith an overall site health score of ${audit.score}/100, it was clear that a complete digital overhaul was needed to compete effectively in their market.`;
  } else if (audit.score < 75) {
    block += `\n\nWith a site health score of ${audit.score}/100, there was significant room for improvement across multiple areas.`;
  }
  return block;
}

/** Metric blocks rendered as text — always our own numbers. */
function metricLines(metrics: MetricBlock[]): string {
  return metrics
    .map(m => `- **${m.label}**: ${m.before} → ${m.after} (${m.change})`)
    .join('\n');
}

interface CaseStudyProse {
  problem: string;
  solution: string;
  results: string;
  executive_summary: string;
}

/**
 * Ask the model for the narrative sections, given the facts we already computed.
 * Returns null (→ template fallback) on any failure or malformed reply.
 */
async function writeCaseStudyProse(
  input: CaseStudyInput,
  audit: SiteAuditResult | undefined,
  metrics: MetricBlock[],
  writer: TextWriter
): Promise<CaseStudyProse | null> {
  const facts: string[] = [`Client name: ${input.client_name}`];
  if (input.client_url) facts.push(`Client website: ${input.client_url}`);
  if (input.old_site_url) facts.push(`Previous website: ${input.old_site_url}`);

  if (audit) {
    facts.push(`Site health score before the work: ${audit.score}/100`);
    if (audit.issues.length) {
      facts.push(`Issues found in the old site:\n${audit.issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}`);
    }
  }

  if (metrics.length) {
    facts.push(
      `Measured results (already computed — do not change or add numbers):\n${metrics
        .map(m => `- ${m.label}: ${m.before} → ${m.after} (${m.change})`)
        .join('\n')}`
    );
  } else {
    facts.push('No before/after numbers were supplied — do not state any metrics.');
  }

  const prompt = [
    'Write the narrative sections of a website redesign case study for an agency portfolio.',
    '',
    'Facts (use only these):',
    ...facts,
    '',
    'Requirements:',
    '- Plain text, no markdown headings, no bullet lists.',
    '- problem: 2-4 sentences on what was wrong before the work.',
    '- solution: 3-5 sentences on what the agency did, in past tense.',
    '- results: 2-3 sentences on the outcome. Refer to the supplied numbers only; if none were supplied, describe the launch without inventing metrics.',
    '- executive_summary: 2-3 sentences summarising the whole engagement.',
    '- Never invent numbers, percentages, client names, awards, timelines or guarantees.',
    '- No urgency or pressure language.',
    '',
    'Reply with JSON only, exactly this shape:',
    '{"problem": "...", "solution": "...", "results": "...", "executive_summary": "..."}',
  ].join('\n');

  const parsed = parseJsonObject(await safeWrite(writer, prompt));
  const problem = readProseField(parsed, 'problem');
  const solution = readProseField(parsed, 'solution');
  const results = readProseField(parsed, 'results');
  const executiveSummary = readProseField(parsed, 'executive_summary');

  if (!problem || !solution || !results || !executiveSummary) return null;

  return { problem, solution, results, executive_summary: executiveSummary };
}

/** The original template prose, unchanged — the fallback whenever AI returns null. */
function buildTemplateContent(
  input: CaseStudyInput,
  audit: SiteAuditResult | undefined,
  metrics: MetricBlock[],
  td: TrafficData,
  rd: RevenueData
): Omit<GeneratedCaseStudy, 'metrics' | 'ai_generated'> {
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

  return { problem, solution, results, narrative_title: narrativeTitle, executive_summary: summary };
}
