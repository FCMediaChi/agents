import * as cheerio from 'cheerio';
import crypto from 'crypto';
import type { AuditReport, AuditDimension, CheckerInput } from './types';
import { calculateGrade, calculateDimensionGrade, calculateDimensionScore, generateDimensionSummary } from './types';
import { analyzeHomepage } from './homepage';
import { analyzeMobile } from './mobile';
import { analyzeBranding } from './branding';
import { analyzeNavigation } from './navigation';
import { analyzeTrust } from './trust';
import { analyzeConversion } from './conversion';
import { analyzeAccessibility } from './accessibility';

const DIMENSION_WEIGHTS: Record<string, number> = {
  homepage: 0.20,
  mobile: 0.15,
  branding: 0.10,
  navigation: 0.15,
  trust: 0.15,
  conversion: 0.15,
  accessibility: 0.10,
};

interface FetchResult {
  html: string;
  url: string;
  error?: string;
}

async function fetchUrl(targetUrl: string): Promise<FetchResult> {
  const normalizedUrl = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(normalizedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return {
        html: '',
        url: normalizedUrl,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const html = await response.text();
    return { html, url: normalizedUrl };
  } catch (err) {
    clearTimeout(timeout);
    const e = err as { name?: string; message?: string } | null | undefined;
    if (e?.name === 'AbortError') {
      return { html: '', url: normalizedUrl, error: 'Request timed out after 15 seconds.' };
    }
    return { html: '', url: normalizedUrl, error: `Failed to fetch: ${e?.message || 'Unknown error'}` };
  }
}

export function isLockedDimension(dim: AuditDimension): boolean {
  return dim.checks.length === 1 && !!dim.checks[0]?.check_name.endsWith('_locked');
}

/**
 * Weighted overall score across only the dimensions that were actually measured.
 * Locked dimensions carry no data, so their weight is dropped and the remaining
 * weights are normalised back to 1 — otherwise every free audit scores in the
 * teens (and grades "Critical") no matter how good the site is.
 */
export function computeOverallScore(dimensions: AuditDimension[]): number {
  const measured = dimensions.filter(d => !isLockedDimension(d));
  if (measured.length === 0) return 0;

  const weightOf = (dim: AuditDimension) => DIMENSION_WEIGHTS[dim.dimension] || 0.14;
  const totalWeight = measured.reduce((sum, dim) => sum + weightOf(dim), 0);
  if (totalWeight <= 0) return 0;

  const weighted = measured.reduce((sum, dim) => sum + dim.score * weightOf(dim), 0);
  return Math.round(weighted / totalWeight);
}

function buildOverallSummary(dimensions: AuditDimension[], overallScore: number): string {
  const realDims = dimensions.filter(d => !isLockedDimension(d));
  const lockedCount = dimensions.length - realDims.length;
  const passed = dimensions.filter(d => d.grade === 'pass').length;
  const warned = dimensions.filter(d => d.grade === 'warn').length;
  const failed = dimensions.filter(d => d.grade === 'fail' && !d.checks[0]?.check_name.endsWith('_locked')).length;

  const strongest = realDims.reduce((prev, curr) => curr.score > prev.score ? curr : prev, realDims[0]);
  const weakest = realDims.reduce((prev, curr) => curr.score < prev.score ? curr : prev, realDims[0]);

  if (lockedCount > 0) {
    // Free audit: the score only reflects the dimensions we actually measured.
    let partial = `Your site scores ${overallScore}/100 on the ${realDims.length} dimension${realDims.length === 1 ? '' : 's'} this free audit measures. `;
    partial += `The other ${lockedCount} dimension${lockedCount === 1 ? ' is' : 's are'} locked, so this is not a whole-site score. `;
    partial += 'Upgrade for the full 7-dimension report.';
    return partial;
  }

  let summary = `Your website scores ${overallScore}/100. `;

  if (overallScore >= 70) {
    summary += 'Looking good! ';
  } else if (overallScore >= 50) {
    summary += 'Room for improvement. ';
  } else {
    summary += 'Several issues need attention. ';
  }

  summary += `${passed} of ${dimensions.length} dimensions pass, ${warned} need attention`;
  if (failed > 0) summary += `, and ${failed} require urgent fixes`;

  if (strongest && weakest && strongest.dimension !== weakest.dimension) {
    summary += `. Strongest area: ${strongest.label} (${strongest.score}/100). `;
    summary += `Focus on improving: ${weakest.label} (${weakest.score}/100).`;
  }

  return summary;
}

/**
 * Run a full audit from pre-fetched HTML instead of fetching a URL.
 * Identical pipeline to runAudit() from cheerio.load onward — skips fetchUrl().
 */
export async function runAuditFromHtml(html: string, sourceUrl: string, tier: string): Promise<AuditReport> {
  const reportId = crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });

  const report: AuditReport = {
    id: reportId,
    target_url: sourceUrl,
    overall_score: 0,
    overall_grade: 'average',
    status: 'running',
    summary: '',
    dimensions: [],
    created_at: new Date().toISOString(),
  };

  try {
    // Validate HTML is non-empty
    if (!html || html.trim().length === 0) {
      report.status = 'failed';
      report.error = 'No HTML content provided for audit.';
      report.summary = 'Unable to audit: empty HTML content.';
      return report;
    }

    // Parse HTML with Cheerio — gracefully handles malformed HTML
    let $: cheerio.CheerioAPI;
    try {
      $ = cheerio.load(html);
    } catch {
      report.status = 'failed';
      report.error = 'Failed to parse the provided HTML content.';
      report.summary = 'Unable to audit: the HTML could not be parsed (malformed or invalid).';
      return report;
    }

    const input: CheckerInput = {
      $,
      url: sourceUrl,
      html,
    };

    // Run checkers — same pipeline as runAudit()
    const allCheckers = [
      analyzeHomepage,
      analyzeMobile,
      analyzeBranding,
      analyzeNavigation,
      analyzeTrust,
      analyzeConversion,
      analyzeAccessibility,
    ];

    let checkerResults;
    if (tier === 'free') {
      const homepageResult = analyzeHomepage(input);
      const lockedDimensions = allCheckers.slice(1).map((fn) => {
        const info = fn(input);
        return {
          dimension: info.dimension,
          label: info.label,
          icon: info.icon,
          checks: [{
            check_name: `${info.dimension}_locked`,
            label: `${info.label} Analysis`,
            passed: false,
            severity: 'info' as const,
            detail: 'Available on paid plans',
            recommendation: 'Upgrade to Single Use ($29) or Team ($49/mo) for full access to all 7 dimensions.',
          }],
        };
      });
      checkerResults = [homepageResult, ...lockedDimensions];
    } else {
      checkerResults = allCheckers.map(fn => fn(input));
    }

    // Convert to dimensions with scores
    const dimensions: AuditDimension[] = checkerResults.map(r => {
      const isLocked = r.checks.length === 1 && r.checks[0].check_name.endsWith('_locked');
      if (isLocked) {
        return {
          dimension: r.dimension,
          label: r.label,
          score: 0,
          grade: 'fail' as const,
          icon: r.icon,
          summary: `🔒 ${r.label}: Upgrade to access this dimension.`,
          checks: r.checks,
        };
      }
      const score = calculateDimensionScore(r.checks);
      return {
        dimension: r.dimension,
        label: r.label,
        score,
        grade: calculateDimensionGrade(score),
        icon: r.icon,
        summary: generateDimensionSummary(r.checks, r.label),
        checks: r.checks,
      };
    });

    // Calculate overall weighted score — locked dimensions excluded, weights normalised
    const overallScore = computeOverallScore(dimensions);

    const overallSummary = buildOverallSummary(dimensions, overallScore);

    report.overall_score = overallScore;
    report.overall_grade = calculateGrade(overallScore);
    report.dimensions = dimensions;
    report.summary = overallSummary;
    report.status = 'completed';
  } catch (err) {
    report.status = 'failed';
    report.error = err instanceof Error ? err.message : 'An unexpected error occurred during analysis.';
    report.summary = `Audit failed: ${report.error}`;
  }

  return report;
}

export async function runAudit(url: string, options?: { tier?: string }): Promise<AuditReport> {
  const tier = options?.tier || 'free';
  const reportId = crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });

  const report: AuditReport = {
    id: reportId,
    target_url: url,
    overall_score: 0,
    overall_grade: 'average',
    status: 'running',
    summary: '',
    dimensions: [],
    created_at: new Date().toISOString(),
  };

  try {
    // Fetch the URL
    const fetchResult = await fetchUrl(url);

    if (fetchResult.error) {
      report.status = 'failed';
      report.error = fetchResult.error;
      report.summary = `Unable to audit this site: ${fetchResult.error}`;
      return report;
    }

    // Parse HTML with Cheerio
    const $ = cheerio.load(fetchResult.html);
    const input: CheckerInput = {
      $,
      url: fetchResult.url,
      html: fetchResult.html,
    };

    // Run checkers — free tier only gets homepage analysis
    const allCheckers = [
      analyzeHomepage,
      analyzeMobile,
      analyzeBranding,
      analyzeNavigation,
      analyzeTrust,
      analyzeConversion,
      analyzeAccessibility,
    ];

    let checkerResults;
    if (tier === 'free') {
      const homepageResult = analyzeHomepage(input);
      const lockedDimensions = allCheckers.slice(1).map((fn) => {
        const info = fn(input);
        return {
          dimension: info.dimension,
          label: info.label,
          icon: info.icon,
          checks: [{
            check_name: `${info.dimension}_locked`,
            label: `${info.label} Analysis`,
            passed: false,
            severity: 'info' as const,
            detail: 'Available on paid plans',
            recommendation: 'Upgrade to Single Use ($29) or Team ($49/mo) for full access to all 7 dimensions.',
          }],
        };
      });
      checkerResults = [homepageResult, ...lockedDimensions];
    } else {
      checkerResults = allCheckers.map(fn => fn(input));
    }

    // Convert to dimensions with scores
    const dimensions: AuditDimension[] = checkerResults.map(r => {
      const isLocked = r.checks.length === 1 && r.checks[0].check_name.endsWith('_locked');
      if (isLocked) {
        return {
          dimension: r.dimension,
          label: r.label,
          score: 0,
          grade: 'fail' as const,
          icon: r.icon,
          summary: `🔒 ${r.label}: Upgrade to access this dimension.`,
          checks: r.checks,
        };
      }
      const score = calculateDimensionScore(r.checks);
      return {
        dimension: r.dimension,
        label: r.label,
        score,
        grade: calculateDimensionGrade(score),
        icon: r.icon,
        summary: generateDimensionSummary(r.checks, r.label),
        checks: r.checks,
      };
    });

    // Calculate overall weighted score — locked dimensions excluded, weights normalised
    const overallScore = computeOverallScore(dimensions);

    const overallSummary = buildOverallSummary(dimensions, overallScore);

    report.overall_score = overallScore;
    report.overall_grade = calculateGrade(overallScore);
    report.dimensions = dimensions;
    report.summary = overallSummary;
    report.status = 'completed';
  } catch (err) {
    report.status = 'failed';
    report.error = err instanceof Error ? err.message : 'An unexpected error occurred during analysis.';
    report.summary = `Audit failed: ${report.error}`;
  }

  return report;
}