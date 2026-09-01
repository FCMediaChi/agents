import { z } from 'zod';
import { validateWebsiteUrl } from '../utils/url.js';

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

export const PROJECT_STATUSES = [
  'not_started',
  'in_progress',
  'needs_attention',
  'ready_for_launch',
  'launched',
] as const;

const websiteUrlSchema = z
  .string()
  .trim()
  .max(2048, 'URL too long')
  .optional()
  .nullable()
  .refine((val) => {
    if (!val) return true;
    return validateWebsiteUrl(val).valid;
  }, { message: 'Enter a valid http(s) website URL' });

export const CreateProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(120, 'Project name must be under 120 characters'),
  website_url: websiteUrlSchema,
  client_name: z.string().trim().max(120, 'Client name too long').optional().nullable(),
  platform: z.enum(PLATFORMS).optional().default('Other'),
  website_type: z.enum(WEBSITE_TYPES).optional().default('Other'),
  notes: z.string().trim().max(2000, 'Notes too long').optional().nullable(),
  status: z.enum(PROJECT_STATUSES).optional().default('not_started'),
});

export const UpdateProjectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(120, 'Project name must be under 120 characters').optional(),
  website_url: websiteUrlSchema,
  client_name: z.string().trim().max(120, 'Client name too long').optional().nullable(),
  platform: z.enum(PLATFORMS).optional(),
  website_type: z.enum(WEBSITE_TYPES).optional(),
  notes: z.string().trim().max(2000, 'Notes too long').optional().nullable(),
  status: z.enum(PROJECT_STATUSES).optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;
