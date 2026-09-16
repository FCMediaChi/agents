import type { Request } from 'express';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  password_reset_token: string | null;
  password_reset_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditReport {
  id: string;
  user_id: string;
  target_url: string;
  status: string;
  overall_score: number | null;
  summary: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditDimension {
  id: string;
  report_id: string;
  dimension: string;
  label: string;
  icon: string | null;
  score: number;
  status: string;
  summary: string | null;
}

export interface AuditCheck {
  id: string;
  dimension_id: string;
  check_name: string;
  label: string;
  passed: number;
  severity: string;
  detail: string | null;
  recommendation: string | null;
}

export interface AuditUsage {
  user_id: string;
  audits_run: number;
  last_audit_at: string | null;
}

export interface JwtPayload {
  userId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
