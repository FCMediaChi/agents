const API_BASE = '/api/pipeline';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.message || err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

export interface PipelineUser {
  id: string;
  email: string;
  subscription_tier: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_active: boolean;
  created_at: string;
}

export interface PipelineAgency {
  id: string;
  user_id: string;
  agency_name: string;
  website: string | null;
  niche: string | null;
  team_size: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineCaseStudy {
  id: string;
  user_id: string;
  agency_id: string | null;
  client_name: string;
  industry: string | null;
  challenge: string | null;
  solution: string | null;
  results: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PipelinePitch {
  id: string;
  user_id: string;
  agency_id: string | null;
  prospect_name: string;
  company_name: string | null;
  industry: string | null;
  pain_points: string | null;
  proposed_solution: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DashboardData {
  agency: PipelineAgency | null;
  stats: {
    case_studies: number;
    pitches: number;
  };
  recent_case_studies: PipelineCaseStudy[];
  recent_pitches: PipelinePitch[];
}

export const pipelineApi = {
  auth: {
    register: (email: string, password: string) =>
      request<PipelineUser>('/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
    login: (email: string, password: string) =>
      request<PipelineUser>('/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    me: () =>
      request<{ user: PipelineUser }>('/me'),
  },

  agency: {
    get: () =>
      request<{ agency: PipelineAgency | null }>('/agency'),
    create: (data: { agency_name: string; website?: string; niche?: string; team_size?: string }) =>
      request<{ agency: PipelineAgency }>('/agency', { method: 'POST', body: JSON.stringify(data) }),
    update: (data: { agency_name?: string; website?: string; niche?: string; team_size?: string }) =>
      request<{ agency: PipelineAgency }>('/agency', { method: 'PUT', body: JSON.stringify(data) }),
  },

  dashboard: {
    get: () =>
      request<DashboardData>('/dashboard'),
  },

  caseStudies: {
    list: () =>
      request<{ case_studies: PipelineCaseStudy[] }>('/case-studies'),
  },

  pitches: {
    list: () =>
      request<{ pitches: PipelinePitch[] }>('/pitches'),
  },
};
