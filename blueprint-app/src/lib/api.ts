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

interface ApiErrorPayload {
  error?: string;
  message?: string;
  verification_required?: boolean;
  email?: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err: ApiErrorPayload = await res.json().catch(() => ({}));
    throw new ApiError(err.message || err.error || `Request failed (HTTP ${res.status})`, res.status, err);
  }
  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  status: number;
  payload: ApiErrorPayload;
  constructor(message: string, status: number, payload: ApiErrorPayload = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }

  /** True when login was rejected because the account's email is unverified. */
  get requiresVerification(): boolean {
    return this.status === 403 && Boolean(this.payload.verification_required);
  }
}

export const api = {
  auth: {
    register: (email: string, password: string) =>
      request<RegisterResult>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
    verifyEmail: (token: string) =>
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
};
