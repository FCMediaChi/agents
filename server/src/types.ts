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
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
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
