import { Request } from 'express';

export type SubscriptionTier = 'FREE' | 'SOLO' | 'TEAM' | 'AGENCY';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  subscription_tier: SubscriptionTier;
  verified: number;
  verification_token: string | null;
  reset_token: string | null;
  reset_token_expiry: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSafe {
  id: string;
  email: string;
  subscription_tier: SubscriptionTier;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  website_type: string | null;
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
  subscriptionTier: SubscriptionTier;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

// Pipeline types
export interface PipelineAgency {
  id: string;
  user_id: string;
  agency_name: string;
  website: string | null;
  niche: string | null;
  team_size: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineCaseStudy {
  id: string;
  user_id: string;
  agency_id: string | null;
  client_name: string;
  industry: string | null;
  challenge: string | null;
  solution: string | null;
  results: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface PipelinePitch {
  id: string;
  user_id: string;
  agency_id: string | null;
  prospect_name: string;
  company_name: string | null;
  industry: string | null;
  pain_points: string | null;
  proposed_solution: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}