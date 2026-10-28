import type { Request } from 'express';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  subscription_tier: string;
  verified: number;
  verification_token: string | null;
  reset_token: string | null;
  reset_token_expiry: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

/** The subset of a user that is safe to return to the client. */
export interface PublicUser {
  id: string;
  email: string;
  subscription_tier: string;
  verified: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  branding_logo_url: string | null;
  branding_primary_color: string | null;
  branding_secondary_color: string | null;
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

export interface JwtPayload {
  userId: string;
  email: string;
  subscriptionTier?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}
