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
  website_type: string | null;
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

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any) {
    super(body?.message || body?.error || `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

interface ApiResponseError {
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
    const body: ApiResponseError = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new ApiError(res.status, body);
  }

  return res.json();
}

// Auth
export const api = {
  auth: {
    register: (email: string, password: string) =>
      request<{ id: string; email: string; message?: string; verified?: boolean }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
    login: (email: string, password: string) =>
      request<User>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () =>
      request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
    me: () =>
      request<{ user: User }>('/auth/me'),
    verify: (token: string) =>
      request<{ success: boolean; message: string }>('/auth/verify', { method: 'POST', body: JSON.stringify({ token }) }),
    resendVerification: (email: string) =>
      request<{ success: boolean; message: string }>('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),
    forgotPassword: (email: string) =>
      request<{ success: boolean; message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (token: string, newPassword: string) =>
      request<{ success: boolean; message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) }),
  },

  // Projects
  projects: {
    list: () =>
      request<Project[]>('/projects'),
    get: (id: string) =>
      request<Project>(`/projects/${id}`),
    create: (title: string, description?: string, website_type?: string | null) =>
      request<Project>('/projects', { method: 'POST', body: JSON.stringify({ title, description, website_type }) }),
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