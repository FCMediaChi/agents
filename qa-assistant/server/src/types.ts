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

export interface ChecklistCategory {
  id: string;
  name: string;
  description: string | null;
  order: number;
  active: number;
}

export interface ChecklistItem {
  id: string;
  category_id: string;
  title: string;
  description: string | null;
  severity: string;
  remediation_guidance: string | null;
  ai_prompt_context: string | null;
  recommended: number;
  applicable_platforms: string | null;
  applicable_site_types: string | null;
  order: number;
  active: number;
  version: string;
}

export interface QaResult {
  id: string;
  qa_run_id: string;
  checklist_item_id: string;
  status: string;
  notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface AiInteraction {
  id: string;
  user_id: string;
  project_id: string | null;
  qa_run_id: string | null;
  operation: string;
  input_reference: string | null;
  output_reference: string | null;
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
