import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
});

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const VerifyEmailSchema = z.object({
  token: z.string().trim().min(8, 'Verification token is required').max(256),
});

export const ResendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
});

export const ResetPasswordSchema = z
  .object({
    token: z.string().trim().min(8, 'Invalid reset token').max(256),
    // `newPassword` is the canonical field (mirrors the monolith); `password` is
    // accepted as an alias so either client shape works.
    newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long').optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long').optional(),
  })
  .refine((data) => Boolean(data.newPassword || data.password), {
    message: 'A new password is required',
    path: ['newPassword'],
  });

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type VerifyEmailInput = z.infer<typeof VerifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof ResendVerificationSchema>;
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
