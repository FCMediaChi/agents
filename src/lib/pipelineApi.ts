const API_BASE = '/api/pipeline';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.message || err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface PipelineUser {
  id: string; email: string; subscription_tier: string;
  trial_started_at: string | null; trial_ends_at: string | null;
  trial_active: boolean; created_at: string;
}

export interface PipelineAgency {
  id: string; user_id: string; agency_name: string;
  website_url: string | null; services: string | null; industries: string | null;
  created_at: string;
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

export interface PipelineCaseStudy {
  id: string; user_id: string; client_name: string; client_url: string | null;
  old_site_url: string | null; screenshots: string | null;
  traffic_data: { monthly_visitors_before?: number; monthly_visitors_after?: number; bounce_rate_before?: number; bounce_rate_after?: number; avg_session_before?: number; avg_session_after?: number } | null;
  revenue_data: { monthly_revenue_before?: number; monthly_revenue_after?: number; conversion_rate_before?: number; conversion_rate_after?: number; lead_growth_before?: number; lead_growth_after?: number } | null;
  generated_content: GeneratedCaseStudy | null;
  status: string; created_at: string;
}

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

export interface PipelinePitch {
  id: string; user_id: string; prospect_name: string; prospect_url: string | null;
  audit_results: { service?: string; findings?: PitchFinding[] } | null;
  cold_email: ColdEmailScript | null;
  status: string; created_at: string;
}

export interface DashboardData {
  agency: PipelineAgency | null;
  stats: { case_studies: number; pitches: number; meetings_booked: number };
  recent_case_studies: PipelineCaseStudy[];
  recent_pitches: PipelinePitch[];
}

export const pipelineApi = {
  auth: { me: () => request<{ user: PipelineUser }>('/me') },
  agency: {
    get: () => request<{ agency: PipelineAgency | null }>('/agency'),
    create: (data: { agency_name: string; website_url?: string; services?: string[]; industries?: string[] }) =>
      request<{ agency: PipelineAgency }>('/onboarding', { method: 'POST', body: JSON.stringify(data) }),
  },
  dashboard: {
    get: () => request<DashboardData>('/dashboard'),
  },
  caseStudies: {
    list: () => request<{ case_studies: PipelineCaseStudy[] }>('/case-studies'),
    get: (id: string) => request<{ case_study: PipelineCaseStudy }>(`/case-studies/${id}`),
    create: (data: { client_name: string; client_url?: string; old_site_url?: string; traffic_data?: any; revenue_data?: any; screenshots?: string[] }) =>
      request<{ case_study: PipelineCaseStudy }>('/case-studies', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<{ case_study: PipelineCaseStudy }>(`/case-studies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    generate: (id: string) =>
      request<{ case_study: PipelineCaseStudy }>(`/case-studies/${id}/generate`, { method: 'POST' }),
  },
  pitches: {
    list: () => request<{ pitches: PipelinePitch[] }>('/pitches'),
    get: (id: string) => request<{ pitch: PipelinePitch }>(`/pitches/${id}`),
    create: (data: { prospect_name: string; prospect_url?: string; service?: string }) =>
      request<{ pitch: PipelinePitch }>('/pitches', { method: 'POST', body: JSON.stringify(data) }),
    analyze: (id: string) =>
      request<{ pitch: PipelinePitch }>(`/pitches/${id}/analyze`, { method: 'POST' }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/pitches/${id}`, { method: 'DELETE' }),
  },
};
