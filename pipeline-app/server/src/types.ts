import type { Request } from 'express';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  subscription_tier: string;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  password_reset_token: string | null;
  password_reset_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineAgency {
  id: string;
  user_id: string;
  agency_name: string;
  website_url: string | null;
  services: string | null;
  industries: string | null;
  created_at: string;
}

export interface PipelineCaseStudy {
  id: string;
  user_id: string;
  client_name: string;
  client_url: string | null;
  old_site_url: string | null;
  screenshots: string | null;
  traffic_data: string | null;
  revenue_data: string | null;
  generated_content: string | null;
  status: string;
  created_at: string;
}

export interface PipelinePitch {
  id: string;
  user_id: string;
  prospect_name: string;
  prospect_url: string | null;
  audit_results: string | null;
  cold_email: string | null;
  status: string;
  created_at: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
