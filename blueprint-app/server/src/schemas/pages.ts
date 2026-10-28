import { z } from 'zod';

export const CreatePageSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be under 100 characters'),
  parent_id: z.string().uuid().nullable().optional(),
  page_type: z.enum(['homepage', 'about', 'services', 'contact', 'blog', 'pricing', 'generic']).default('generic'),
  sort_order: z.number().int().nonnegative().optional(),
});

export const UpdatePageSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title must be under 100 characters').optional(),
  parent_id: z.string().uuid().nullable().optional(),
  sort_order: z.number().int().nonnegative().optional(),
  page_type: z.enum(['homepage', 'about', 'services', 'contact', 'blog', 'pricing', 'generic']).optional(),
});

export const UpdateOutlineSchema = z.object({
  description: z.string().max(5000, 'Description too long').optional().nullable(),
  goals: z.string().max(5000, 'Goals too long').optional().nullable(),
  notes: z.string().max(5000, 'Notes too long').optional().nullable(),
});

export const UpdateAnswersSchema = z.object({
  answers: z.record(z.string(), z.string()),
});

export const UpdateBlocksSchema = z.object({
  blocks: z.array(z.object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    subtitle: z.string().optional().nullable(),
    content: z.string().optional().nullable(),
    order: z.number().int().nonnegative(),
  })),
});

export const UpdateProposalSchema = z.object({
  client_name: z.string().min(1, 'Client name is required').optional(),
  executive_summary: z.string().max(10000).optional().nullable(),
  pricing_estimate: z.string().max(5000).optional().nullable(),
  timeline_weeks: z.number().int().positive().optional(),
  terms_conditions: z.string().max(20000).optional().nullable(),
  status: z.enum(['draft', 'sent']).optional(),
});

export type CreatePageInput = z.infer<typeof CreatePageSchema>;
export type UpdatePageInput = z.infer<typeof UpdatePageSchema>;
export type UpdateOutlineInput = z.infer<typeof UpdateOutlineSchema>;
export type UpdateAnswersInput = z.infer<typeof UpdateAnswersSchema>;
export type UpdateBlocksInput = z.infer<typeof UpdateBlocksSchema>;
export type UpdateProposalInput = z.infer<typeof UpdateProposalSchema>;