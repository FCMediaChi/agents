import { Request } from 'express';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  subscription_tier: 'FREE' | 'PAID';
  created_at: string;
  updated_at: string;
}

export interface UserSafe {
  id: string;
  email: string;
  subscription_tier: 'FREE' | 'PAID';
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
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

export interface Questionnaire {
  id: string;
  page_id: string;
  questions: string;
  answers: string;
  created_at: string;
  updated_at: string;
}

export interface Wireframe {
  id: string;
  page_id: string;
  blocks: string;
  created_at: string;
  updated_at: string;
}

export interface Proposal {
  id: string;
  project_id: string;
  client_name: string;
  executive_summary: string | null;
  pricing_estimate: string | null;
  timeline_weeks: number;
  terms_conditions: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface JwtPayload {
  userId: string;
  email: string;
  subscriptionTier: 'FREE' | 'PAID';
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}