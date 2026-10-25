import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
});

export const LoginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const RequestPasswordResetSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(16, 'Invalid reset token'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RequestPasswordResetInput = z.infer<typeof RequestPasswordResetSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
