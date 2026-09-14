import { z } from 'zod';

export const runAuditSchema = z.object({
  url: z.string()
    .min(1, 'URL is required')
    .refine((val) => {
      try {
        const url = val.startsWith('http') ? val : `https://${val}`;
        new URL(url);
        return true;
      } catch {
        return false;
      }
    }, 'Please enter a valid URL (e.g., example.com or https://example.com)'),
});

export type RunAuditInput = z.infer<typeof runAuditSchema>;

export const runAuditFromHtmlSchema = z.object({
  html: z.string()
    .min(1, 'HTML content is required')
    .max(5 * 1024 * 1024, 'HTML content exceeds the 5MB limit'),
  url: z.string()
    .min(1, 'URL is required')
    .refine((val) => {
      try {
        new URL(val.startsWith('http') ? val : `https://${val}`);
        return true;
      } catch {
        return false;
      }
    }, 'Please enter a valid URL'),
});

export type RunAuditFromHtmlInput = z.infer<typeof runAuditFromHtmlSchema>;