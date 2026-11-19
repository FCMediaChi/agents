import { z } from 'zod';
import { ANSWER_STATUSES, type AnswerStatus } from '../qa/scoring.js';

const answerStatusSchema = z.enum(ANSWER_STATUSES as [AnswerStatus, ...AnswerStatus[]]);

export const UpdateAnswerSchema = z
  .object({
    status: answerStatusSchema.optional(),
    notes: z.string().trim().max(2000, 'Notes must be under 2000 characters').nullable().optional(),
  })
  .refine((value) => value.status !== undefined || value.notes !== undefined, {
    message: 'Provide a status and/or notes',
  });

export type UpdateAnswerInput = z.infer<typeof UpdateAnswerSchema>;

/** Start a new QA run. `carryForward` copies the previous run's answers as a starting point. */
export const CreateRunSchema = z.object({
  label: z.string().trim().max(120, 'Label must be under 120 characters').optional(),
  carryForward: z.boolean().optional(),
});

export type CreateRunInput = z.infer<typeof CreateRunSchema>;
