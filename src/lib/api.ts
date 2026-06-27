const API_BASE = '/api';

export interface User {
  id: string;
  email: string;
  subscription_tier: 'FREE' | 'PAID';
}

export interface Project {
  id: string;
  title: string;
  description: string | null;
  user_id: string;
  branding_logo_url: string | null;
  branding_primary_color: string;
  branding_secondary_color: string;
  created_at: string;
  updated_at: string;
}

export interface Page {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  slug: string;
  sort_order: number;
  page_type: string;
  description: string | null;
  goals: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiError {
  error: string;
  message?: string;
  details?: any;
}

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
    const err: ApiError = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.message || err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// Auth
export const api = {
  auth: {
    register: (email: string, password: string) =>
      request<User>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
    login: (email: string, password: string) =>
      request<User>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () =>
      request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
    me: () =>
      request<{ user: User }>('/auth/me'),
  },

  // Projects
  projects: {
    list: () =>
      request<Project[]>('/projects'),
    get: (id: string) =>
      request<Project>(`/projects/${id}`),
    create: (title: string, description?: string) =>
      request<Project>('/projects', { method: 'POST', body: JSON.stringify({ title, description }) }),
    update: (id: string, data: Partial<Project>) =>
      request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
  },

  // Pages
  pages: {
    list: (projectId: string) =>
      request<Page[]>(`/projects/${projectId}/pages`),
    create: (projectId: string, data: { title: string; page_type?: string; parent_id?: string | null; sort_order?: number }) =>
      request<Page>(`/projects/${projectId}/pages`, { method: 'POST', body: JSON.stringify(data) }),
    update: (projectId: string, pageId: string, data: Partial<Page>) =>
      request<Page>(`/projects/${projectId}/pages/${pageId}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (projectId: string, pageId: string) =>
      request<{ success: boolean }>(`/projects/${projectId}/pages/${pageId}`, { method: 'DELETE' }),
    saveOutline: (projectId: string, pageId: string, data: { description?: string; goals?: string; notes?: string }) =>
      request<Page>(`/projects/${projectId}/pages/${pageId}/outline`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  // Questionnaires
  questionnaires: {
    get: (pageId: string) =>
      request<any>(`/pages/${pageId}/questionnaire`),
    saveAnswers: (pageId: string, answers: Record<string, string>) =>
      request<any>(`/pages/${pageId}/questionnaire`, { method: 'PUT', body: JSON.stringify({ answers }) }),
  },

  // Wireframes
  wireframes: {
    get: (pageId: string) =>
      request<any>(`/pages/${pageId}/wireframe`),
    saveBlocks: (pageId: string, blocks: any[]) =>
      request<any>(`/pages/${pageId}/wireframe`, { method: 'PUT', body: JSON.stringify({ blocks }) }),
  },
};