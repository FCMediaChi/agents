export interface AuditCheck {
  check_name: string;
  label: string;
  passed: boolean;
  severity: 'critical' | 'warning' | 'info';
  detail: string | null;
  recommendation: string | null;
}

export interface AuditDimension {
  dimension: string;
  label: string;
  score: number;
  grade: 'pass' | 'warn' | 'fail';
  icon: string;
  summary: string;
  checks: AuditCheck[];
}

export interface AuditReport {
  id: string;
  target_url: string;
  overall_score: number;
  overall_grade: 'excellent' | 'good' | 'average' | 'poor' | 'critical';
  status: 'completed' | 'running' | 'failed';
  summary: string;
  dimensions: AuditDimension[];
  created_at: string;
  error?: string;
}

export interface CheckerInput {
  $: cheerio.CheerioAPI;
  url: string;
  html: string;
}

export interface CheckerResult {
  dimension: string;
  label: string;
  icon: string;
  checks: AuditCheck[];
}

export function calculateGrade(score: number): 'excellent' | 'good' | 'average' | 'poor' | 'critical' {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'average';
  if (score >= 30) return 'poor';
  return 'critical';
}

export function calculateDimensionGrade(score: number): 'pass' | 'warn' | 'fail' {
  if (score >= 70) return 'pass';
  if (score >= 40) return 'warn';
  return 'fail';
}

export function calculateDimensionScore(checks: AuditCheck[]): number {
  if (checks.length === 0) return 0;
  let score = 100;
  for (const check of checks) {
    if (!check.passed) {
      if (check.severity === 'critical') score -= 15;
      else if (check.severity === 'warning') score -= 8;
      else score -= 3;
    }
  }
  return Math.max(0, Math.min(100, score));
}

export function generateDimensionSummary(checks: AuditCheck[], label: string): string {
  const passed = checks.filter(c => c.passed).length;
  const total = checks.length;
  const criticalFailures = checks.filter(c => !c.passed && c.severity === 'critical').length;
  
  if (passed === total) return `${label}: All checks passed.`;
  if (criticalFailures > 0) return `${label}: ${passed}/${total} passed. ${criticalFailures} critical issue${criticalFailures > 1 ? 's' : ''} found.`;
  if (passed >= total / 2) return `${label}: ${passed}/${total} passed. Some improvements needed.`;
  return `${label}: Only ${passed}/${total} passed. Significant improvements recommended.`;
}