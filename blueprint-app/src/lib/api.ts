// Frontend API client for Nuria Website Blueprint.
// Every call goes to THIS app's own backend (blueprint-app/server) — `/api/*`.
// Auth uses the app's own `blueprint_token` cookie (set by the server; `credentials: 'include'`).
const API_BASE = '/api';

export interface User {
  id: string;
  email: string;
  subscription_tier: string;
  verified: boolean;
  created_at: string;
}

export interface EmailDelivery {
  delivered: boolean;
  transport: 'resend' | 'log';
}

export interface RegisterResult {
  id: string;
  email: string;
  subscription_tier: string;
  verified: boolean;
  message: string;
  email_delivery?: EmailDelivery;
  /** Development only — lets the verification flow be exercised without an inbox. */
  dev_verification_token?: string;
  dev_verify_url?: string;
}

export interface VerifyResult {
  success: boolean;
  verified: boolean;
  message: string;
}

export interface ResendVerificationResult {
  success: boolean;
  message: string;
  email_delivery?: EmailDelivery;
  dev_verification_token?: string;
  dev_verify_url?: string;
}

export interface ForgotPasswordResult {
  success: boolean;
  message: string;
  email_delivery?: EmailDelivery;
  /** Development only — lets the reset flow be exercised without an inbox. */
  dev_reset_token?: string;
  dev_reset_url?: string;
}

export interface ResetPasswordResult {
  success: boolean;
  message: string;
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

interface ApiErrorPayload {
  error?: string;
  message?: string;
  details?: unknown;
  verification_required?: boolean;
  email?: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    const err: ApiErrorPayload = await res.json().catch(() => ({}));
    throw new ApiError(
      err.message || err.error || `Request failed (HTTP ${res.status})`,
      res.status,
      err,
    );
  }
  // 204 / empty bodies are valid for DELETE-style endpoints.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export class ApiError extends Error {
  status: number;
  payload: ApiErrorPayload;
  /** Monolith-compatible alias: some ported pages read `err.body`. */
  body: ApiErrorPayload;
  constructor(message: string, status: number, payload: ApiErrorPayload = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
    this.body = payload;
  }

  /** True when login was rejected because the account's email is unverified. */
  get requiresVerification(): boolean {
    return this.status === 403 && Boolean(this.payload.verification_required);
  }
}

export interface QuestionnairePayload {
  questions?: string[];
  answers?: Record<string, string>;
}

export interface WireframeBlockRecord {
  id: string;
  type: string;
  title: string;
  subtitle?: string | null;
  content?: string | null;
  order: number;
}

export interface WireframePayload {
  blocks?: WireframeBlockRecord[];
  approval_status?: string;
}

export const api = {
  auth: {
    register: (email: string, password: string) =>
      request<RegisterResult>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
    verifyEmail: (token: string) =>
      request<VerifyResult>('/auth/verify', { method: 'POST', body: JSON.stringify({ token }) }),
    verify: (token: string) =>
      request<VerifyResult>('/auth/verify', { method: 'POST', body: JSON.stringify({ token }) }),
    resendVerification: (email: string) =>
      request<ResendVerificationResult>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    login: (email: string, password: string) =>
      request<User>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => request<{ success: boolean }>('/auth/logout', { method: 'POST' }),
    me: () => request<{ user: User }>('/auth/me'),
    forgotPassword: (email: string) =>
      request<ForgotPasswordResult>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    resetPassword: (token: string, newPassword: string) =>
      request<ResetPasswordResult>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      }),
  },

  projects: {
    list: () => request<Project[]>('/projects'),
    get: (id: string) => request<Project>(`/projects/${id}`),
    create: (title: string, description?: string) =>
      request<Project>('/projects', { method: 'POST', body: JSON.stringify({ title, description }) }),
    update: (id: string, data: Partial<Project>) =>
      request<Project>(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ success: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
  },

  pages: {
    list: (projectId: string) => request<Page[]>(`/projects/${projectId}/pages`),
    create: (
      projectId: string,
      data: { title: string; page_type?: string; parent_id?: string | null; sort_order?: number },
    ) => request<Page>(`/projects/${projectId}/pages`, { method: 'POST', body: JSON.stringify(data) }),
    update: (projectId: string, pageId: string, data: Partial<Page>) =>
      request<Page>(`/projects/${projectId}/pages/${pageId}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (projectId: string, pageId: string) =>
      request<{ success: boolean }>(`/projects/${projectId}/pages/${pageId}`, { method: 'DELETE' }),
    saveOutline: (projectId: string, pageId: string, data: { description?: string; goals?: string; notes?: string }) =>
      request<Page>(`/projects/${projectId}/pages/${pageId}/outline`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  },

  questionnaires: {
    get: (pageId: string) => request<QuestionnairePayload>(`/pages/${pageId}/questionnaire`),
    saveAnswers: (pageId: string, answers: Record<string, string>) =>
      request<QuestionnairePayload>(`/pages/${pageId}/questionnaire`, {
        method: 'PUT',
        body: JSON.stringify({ answers }),
      }),
  },

  wireframes: {
    get: (pageId: string) => request<WireframePayload>(`/pages/${pageId}/wireframe`),
    saveBlocks: (pageId: string, blocks: unknown[]) =>
      request<WireframePayload>(`/pages/${pageId}/wireframe`, {
        method: 'PUT',
        body: JSON.stringify({ blocks }),
      }),
  },
};
