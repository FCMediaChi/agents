const API_BASE = '/api';

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export type ProjectStatus =
  | 'not_started'
  | 'in_progress'
  | 'needs_attention'
  | 'ready_for_launch'
  | 'launched';

export interface Project {
  id: string;
  user_id: string;
  name: string;
  website_url: string | null;
  client_name: string | null;
  platform: string;
  website_type: string;
  notes: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface ProjectInput {
  name: string;
  website_url?: string | null;
  client_name?: string | null;
  platform?: string;
  website_type?: string;
  notes?: string | null;
  status?: ProjectStatus;
}

interface ApiErrorShape {
  error?: string;
  message?: string;
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
    const err: ApiErrorShape = await res.json().catch(() => ({}));
    throw new ApiError(err.message || err.error || `Request failed (HTTP ${res.status})`, res.status);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const api = {
  auth: {
    register: (email: string, password: string) =>
      request<User>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
    login: (email: string, password: string) =>
      request<User>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
    me: () => request<{ user: User }>('/auth/me'),
    requestPasswordReset: (email: string) =>
      request<{ success: boolean; debug_reset_token?: string }>('/auth/request-password-reset', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    resetPassword: (token: string, password: string) =>
      request<{ success: boolean }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      }),
  },

  projects: {
    list: () => request<Project[]>('/projects'),
    get: (id: string) => request<Project>(`/projects/${id}`),
    create: (data: ProjectInput) =>
      request<Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<ProjectInput>) =>
      request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
  },
};
