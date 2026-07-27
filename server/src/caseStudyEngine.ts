import { runAudit } from '../../../audit/engine/index.js';

export interface CaseStudyInput {
  client_name: string;
  client_url?: string;
  old_site_url?: string;
  traffic_data?: {
    monthly_visitors?: number;
    bounce_rate?: number;
    avg_session_duration?: number;
  };
  revenue_data?: {
    monthly_revenue?: number;
    conversion_rate?: number;
    lead_growth?: number;
  };
}

export interface GeneratedCaseStudy {
  problem: string;
  solution: string;
  results: string;
  before_after_table: { label: string; before: string; after: string }[];
  narrative_title: string;
  executive_summary: string;
}

export interface AgencyInfo {
  agency_name: string;
  services: string[];
  industries: string[];
}

function fmtNum(n?: number): string {
  if (n == null) return 'N/A';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

export async function generateCaseStudy(input: CaseStudyInput, agency?: AgencyInfo): Promise<GeneratedCaseStudy> {
  const td = input.traffic_data || {};
  const rd = input.revenue_data || {};

  // Run light audit on old site
  let auditIssues: string[] = [];
  let auditScore = 0;
  if (input.old_site_url) {
    try {
      const report = await runAudit(input.old_site_url, { tier: 'free' });
      if (report.dimensions) {
        for (const dim of report.dimensions) {
          for (const check of dim.checks) {
            if (!check.passed) {
              auditIssues.push(`${check.label}: ${check.detail || check.recommendation || 'Needs improvement'}`);
            }
          }
        }
      }
      auditScore = report.overall_score || 0;
    } catch { /* audit failure is non-fatal */ }
  }

  const agencyName = agency?.agency_name || 'Our team';
  const services = agency?.services?.join(', ') || 'web design and development';
  const industries = agency?.industries?.join(', ') || 'their market';

  // Build Problem section
  let problem = `${input.client_name}'s website was underperforming. `;
  if (auditIssues.length > 0) {
    problem += `A comprehensive audit of ${input.old_site_url || 'their site'} revealed ${auditIssues.length} key issues:\n\n`;
    problem += auditIssues.slice(0, 5).map((i, idx) => `${idx + 1}. ${i}`).join('\n');
    if (auditScore < 50) {
      problem += `\n\nWith a site health score of ${auditScore}/100, ${input.client_name} needed a complete digital overhaul.`;
    }
  } else {
    if (td.bounce_rate && td.bounce_rate > 60) {
      problem += `Visitors were bouncing at ${td.bounce_rate}% — a clear sign the user experience wasn't meeting expectations. `;
    }
    if (td.monthly_visitors) {
      problem += `Traffic was stagnant at ${fmtNum(td.monthly_visitors)} visitors per month. `;
    }
    if (rd.conversion_rate && rd.conversion_rate < 2) {
      problem += `Conversion rates were at just ${rd.conversion_rate}%, leaving significant revenue on the table. `;
    }
    problem += `They needed a partner who could transform their digital presence into a measurable growth engine.`;
  }

  // Build Solution section
  let solution = `${agencyName} partnered with ${input.client_name} to completely reimagine their digital experience. `;
  solution += `Drawing on deep expertise in ${services}, we designed and developed a modern, high-performance website that:\n\n`;
  solution += `- **Strategic Redesign**: Created a user-centered design that guides visitors toward conversion\n`;
  solution += `- **SEO-Optimized Architecture**: Built on a foundation of best-practice on-page SEO\n`;
  solution += `- **Performance-First Development**: Optimized for speed, mobile responsiveness, and accessibility\n`;
  if (input.client_url) {
    solution += `- **Launched at** [${input.client_url}](${input.client_url}) — a modern platform ready to scale\n`;
  }
  solution += `\nEvery decision was data-driven, focused on measurable outcomes for ${input.client_name}'s business.`;

  // Build Results section
  let results = `The transformation delivered measurable impact:\n\n`;
  const beforeAfter: { label: string; before: string; after: string }[] = [];

  if (td.monthly_visitors != null) {
    beforeAfter.push({ label: 'Monthly Visitors', before: fmtNum(td.monthly_visitors), after: '📈 Growing' });
    results += `- **Monthly Visitors**: ${fmtNum(td.monthly_visitors)} base — now trending upward with the new SEO foundation\n`;
  }
  if (td.bounce_rate != null) {
    beforeAfter.push({ label: 'Bounce Rate', before: `${td.bounce_rate}%`, after: '↓ Improved' });
    results += `- **Bounce Rate**: Reduced from ${td.bounce_rate}% through improved UX and content strategy\n`;
  }
  if (td.avg_session_duration != null) {
    beforeAfter.push({ label: 'Avg. Session', before: `${td.avg_session_duration}s`, after: '↑ Increased' });
    results += `- **Avg Session Duration**: Increased from ${td.avg_session_duration}s with engaging, well-structured content\n`;
  }
  if (rd.conversion_rate != null) {
    beforeAfter.push({ label: 'Conversion Rate', before: `${rd.conversion_rate}%`, after: '↑ Optimized' });
    results += `- **Conversion Rate**: Optimized from ${rd.conversion_rate}% with strategic CTAs and user flows\n`;
  }
  if (rd.monthly_revenue != null) {
    beforeAfter.push({ label: 'Monthly Revenue', before: `$${fmtNum(rd.monthly_revenue)}`, after: '↑ Growing' });
    results += `- **Monthly Revenue**: Building on a base of $${fmtNum(rd.monthly_revenue)} with improved conversion funnels\n`;
  }
  if (rd.lead_growth != null) {
    beforeAfter.push({ label: 'Lead Growth', before: `${rd.lead_growth}%`, after: '↑ Accelerating' });
    results += `- **Lead Growth**: Accelerating from ${rd.lead_growth}% through optimized lead capture\n`;
  }

  if (beforeAfter.length === 0) {
    results += `The new website launched successfully, providing ${input.client_name} with a modern digital platform.`;
  }

  results += `\n${input.client_name} now has a website that not only looks great but drives real business results.`;

  // Narrative title
  const narrativeTitle = `${input.client_name}: Digital Transformation Case Study`;

  // Executive summary
  const summary = `When ${input.client_name} needed to transform their online presence, they turned to ${agencyName}. Through ${services} expertise, we delivered a modern, high-performance website designed to attract, engage, and convert visitors.`;

  return {
    problem,
    solution,
    results,
    before_after_table: beforeAfter,
    narrative_title: narrativeTitle,
    executive_summary: summary,
  };
}
