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

export type QaAnswerStatus = 'not_checked' | 'pass' | 'fail' | 'needs_review' | 'not_applicable';
export type QaSeverity = 'critical' | 'high' | 'medium' | 'low';
export type QaReadinessStatus = 'not_started' | 'not_ready' | 'needs_attention' | 'nearly_ready' | 'ready';

export interface QaItem {
  id: string;
  title: string;
  description: string | null;
  severity: QaSeverity;
  remediation: string | null;
  status: QaAnswerStatus;
  notes: string | null;
  reviewed_at: string | null;
}

export interface QaCategory {
  id: string;
  name: string;
  description: string | null;
  items: QaItem[];
}

export interface QaCounts {
  total: number;
  passed: number;
  failed: number;
  needsReview: number;
  notApplicable: number;
  notChecked: number;
  criticalFailures: number;
  highFailures: number;
  unreviewedRequired: number;
}

export interface QaCategoryScore {
  id: string;
  name: string;
  score: number | null;
  completionPercentage: number;
  counts: QaCounts;
}

export interface QaSummary {
  score: number | null;
  completionPercentage: number;
  counts: QaCounts;
  readiness: { status: QaReadinessStatus; label: string; reason: string };
  categories: QaCategoryScore[];
}

export interface QaRun {
  id: string;
  project_id: string;
  label: string | null;
  version: string;
  started_at: string | null;
  completed_at: string | null;
  score: number | null;
  completion_percentage: number | null;
  launch_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface QaChecklistResponse {
  run: QaRun;
  summary: QaSummary;
  categories: QaCategory[];
  runs: QaRunSummary[];
  currentRunId: string;
  is_current: boolean;
}

export interface QaAnswerResponse {
  item: QaItem;
  summary: QaSummary;
  run: QaRun;
  runs: QaRunSummary[];
  currentRunId: string;
  is_current: boolean;
}

/** One entry in a project's run history (Phase 3). */
export interface QaRunSummary {
  id: string;
  label: string | null;
  started_at: string | null;
  completed_at: string | null;
  score: number | null;
  completion_percentage: number | null;
  launch_status: QaReadinessStatus | null;
  answered: number;
  is_current: boolean;
}

export interface QaRunsResponse {
  runs: QaRunSummary[];
  currentRunId: string | null;
}

export interface QaItemChange {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  severity: QaSeverity;
  from: QaAnswerStatus;
  to: QaAnswerStatus;
}

export interface QaSingleSideItem {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  severity: QaSeverity;
  status: QaAnswerStatus;
}

export interface QaMetricDelta {
  base: number | null;
  head: number | null;
  delta: number | null;
}

export interface QaCountDelta {
  base: number;
  head: number;
  delta: number;
}

export interface QaComparison {
  base: QaRunSnapshot;
  head: QaRunSnapshot;
  score: QaMetricDelta;
  completion: QaMetricDelta;
  readiness: { base: QaReadinessStatus; head: QaReadinessStatus; direction: 'improved' | 'unchanged' | 'worsened' };
  counts: {
    passed: QaCountDelta;
    failed: QaCountDelta;
    needsReview: QaCountDelta;
    notChecked: QaCountDelta;
    notApplicable: QaCountDelta;
    criticalFailures: QaCountDelta;
  };
  fixed: QaItemChange[];
  broken: QaItemChange[];
  stillFailing: QaItemChange[];
  improved: QaItemChange[];
  worsened: QaItemChange[];
  otherChanges: QaItemChange[];
  onlyInBase: QaSingleSideItem[];
  onlyInHead: QaSingleSideItem[];
  totals: { comparable: number; changed: number; unchangedPassing: number };
}

export interface QaRunSnapshot {
  runId: string;
  label: string | null;
  startedAt: string | null;
  score: number | null;
  completionPercentage: number;
  readiness: QaReadinessStatus;
}

export interface QaComparisonResponse {
  comparison: QaComparison;
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

  qa: {
    get: (projectId: string) => request<QaChecklistResponse>(`/projects/${projectId}/qa`),
    runs: (projectId: string) => request<QaRunsResponse>(`/projects/${projectId}/qa/runs`),
    getRun: (projectId: string, runId: string) =>
      request<QaChecklistResponse>(`/projects/${projectId}/qa/runs/${runId}`),
    startRun: (projectId: string, data: { label?: string; carryForward?: boolean } = {}) =>
      request<QaChecklistResponse>(`/projects/${projectId}/qa/runs`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    compare: (projectId: string, baseId: string, headId: string) =>
      request<QaComparisonResponse>(`/projects/${projectId}/qa/runs/${baseId}/compare/${headId}`),
    answer: (projectId: string, itemId: string, data: { status?: QaAnswerStatus; notes?: string | null }) =>
      request<QaAnswerResponse>(`/projects/${projectId}/qa/answers/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },
};
