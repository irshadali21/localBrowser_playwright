/**
 * Zod Validation Schemas for API input validation
 */

import { z } from 'zod';

/**
 * URL validation pattern
 */
const urlSchema = z.string().url().refine((url) => {
  return url.startsWith('http://') || url.startsWith('https://');
}, {
  message: 'URL must start with http:// or https://',
});

/**
 * Visit URL options schema
 */
export const visitUrlSchema = z.object({
  url: urlSchema,
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle', 'commit']).optional(),
  timeout: z.number().positive().max(300000).optional(), // Max 5 minutes
  saveToFile: z.boolean().optional(),
  returnHtml: z.boolean().optional(),
  handleCloudflare: z.boolean().optional(),
  useProgressiveRetry: z.boolean().optional(),
});

/**
 * Execute code schema
 */
export const executeCodeSchema = z.object({
  code: z.string().min(1, 'Code cannot be empty').max(10000, 'Code too long'),
});

/**
 * Google search schema
 */
export const googleSearchSchema = z.object({
  q: z.string().min(1, 'Search query cannot be empty').max(500, 'Query too long'),
});

/**
 * Scrape product schema
 */
export const scrapeProductSchema = z.object({
  url: urlSchema,
  vendor: z.string().min(1, 'Vendor cannot be empty').max(100, 'Vendor name too long'),
});

/**
 * Cleanup options schema
 */
export const cleanupSchema = z.object({
  maxAge: z.number().positive().max(720).optional(), // Max 30 days
});

/**
 * Job creation schema
 */
export const jobSchema = z.object({
  jobId: z.string().optional(),
  target: z.object({
    url: urlSchema,
    metadata: z.record(z.unknown()).optional(),
    lead: z.record(z.unknown()).optional(),
  }),
  parser: z.object({
    id: z.string().min(1),
    slug: z.string().min(1),
    mode: z.enum(['single', 'batch', 'vendor']),
    definition: z.record(z.unknown()).optional(),
  }),
  callbackUrl: urlSchema.optional(),
});

/**
 * Task creation schema
 */
export const taskSchema = z.object({
  id: z.string().optional(),
  type: z.string().min(1),
  target: z.object({
    url: urlSchema,
    metadata: z.record(z.unknown()).optional(),
    lead: z.record(z.unknown()).optional(),
  }),
  parser: z.object({
    id: z.string().min(1),
    slug: z.string().min(1),
    mode: z.enum(['single', 'batch', 'vendor']),
    definition: z.record(z.unknown()).optional(),
  }),
  callbackUrl: urlSchema.optional(),
});

/**
 * Error report schema
 */
export const errorReportSchema = z.object({
  type: z.string().min(1),
  message: z.string().min(1),
  stack: z.string().optional(),
  route: z.string().optional(),
  input: z.record(z.unknown()).optional(),
});

/**
 * Chat message schema
 */
export const chatMessageSchema = z.object({
  prompt: z.string().min(1, 'Prompt cannot be empty').max(10000, 'Prompt too long'),
  sessionId: z.string().optional(),
});

/**
 * Chat prepare schema
 */
export const chatPrepareSchema = z.object({}).optional();

/**
 * Page request schema
 */
export const pageRequestSchema = z.object({
  type: z.enum(['browser', 'chat', 'scraper']).optional(),
});

/**
 * Pagination schema
 */
export const paginationSchema = z.object({
  page: z.number().positive().optional(),
  limit: z.number().positive().max(100).optional(),
});

/**
 * Validate input and return formatted errors
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, errors: result.error };
}

/**
 * Create validation error response
 */
export function createValidationError(errors: z.ZodError): {
  success: false;
  error: {
    code: string;
    message: string;
    details: {
      field: string;
      message: string;
    }[];
  };
} {
  return {
    success: false,
    error: {
      code: 'ERR_VALIDATION',
      message: 'Validation failed',
      details: errors.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    },
  };
}

export default {
  visitUrl: visitUrlSchema,
  executeCode: executeCodeSchema,
  googleSearch: googleSearchSchema,
  scrapeProduct: scrapeProductSchema,
  cleanup: cleanupSchema,
  job: jobSchema,
  task: taskSchema,
  errorReport: errorReportSchema,
  chatMessage: chatMessageSchema,
  chatPrepare: chatPrepareSchema,
  pageRequest: pageRequestSchema,
  pagination: paginationSchema,
};
