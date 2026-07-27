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

export interface PipelineCaseStudy {
  id: string; user_id: string; client_name: string; client_url: string | null;
  old_site_url: string | null; screenshots: string | null;
  traffic_data: string | null; revenue_data: string | null;
  generated_content: string | null; status: string; created_at: string;
}

export interface PipelinePitch {
  id: string; user_id: string; prospect_name: string; prospect_url: string | null;
  audit_results: string | null; cold_email: string | null;
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
  },
  pitches: {
    list: () => request<{ pitches: PipelinePitch[] }>('/pitches'),
  },
};
