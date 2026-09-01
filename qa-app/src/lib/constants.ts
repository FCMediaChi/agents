import type { ProjectStatus } from './api';

export const PLATFORMS = [
  'Wix',
  'Wix Studio',
  'WordPress',
  'Webflow',
  'Squarespace',
  'Shopify',
  'Framer',
  'Custom',
  'Other',
] as const;

export const WEBSITE_TYPES = [
  'Business',
  'Portfolio',
  'Nonprofit',
  'Ecommerce',
  'Blog',
  'Service Business',
  'Membership',
  'Restaurant',
  'Professional Services',
  'Landing Page',
  'Other',
] as const;

export const PROJECT_STATUSES: ProjectStatus[] = [
  'not_started',
  'in_progress',
  'needs_attention',
  'ready_for_launch',
  'launched',
];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  needs_attention: 'Needs Attention',
  ready_for_launch: 'Ready for Launch',
  launched: 'Launched',
};
