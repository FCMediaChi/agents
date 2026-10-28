import { z } from 'zod';

export const CreateProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters'),
  description: z.string().max(2000, 'Description too long').optional().nullable(),
});

export const UpdateProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be under 200 characters').optional(),
  description: z.string().max(2000, 'Description too long').optional().nullable(),
  branding_logo_url: z.string().max(500, 'URL too long').optional().nullable(),
  branding_primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color').optional(),
  branding_secondary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a valid hex color').optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;