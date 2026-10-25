export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface PipelineMe {
  id: string;
  email: string;
  subscription_tier: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  trial_active: boolean;
  created_at: string;
}

interface ApiErrorShape {
  error?: string;
  message?: string;
  code?: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err: ApiErrorShape = await res.json().catch(() => ({}));
    throw new ApiError(err.message || err.error || `Request failed (HTTP ${res.status})`, res.status, err.code);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
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
  pipeline: {
    me: () => request<{ user: PipelineMe }>('/pipeline/me'),
  },
};
