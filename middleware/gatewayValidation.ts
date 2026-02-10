/**
 * Request Validation Middleware
 * Validates command ID and payload structure against command schema using Zod
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';
import { commandRegistry } from '../gateway/commandRegistry';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Extended Express Request with parsed command info
 */
export interface ValidatedRequest extends Request {
  commandId?: string;
  commandName?: string;
  validatedPayload?: Record<string, unknown>;
  rawPayload?: Record<string, unknown>;
}

// ============================================================================
// Common Zod Schemas
// ============================================================================

/**
 * Base gateway request schema
 */
export const gatewayRequestSchema = z.object({
  commandId: z.string().min(1, 'Command ID is required'),
  version: z.string().optional().default('v1'),
  payload: z.record(z.unknown()).optional().default({}),
  metadata: z
    .object({
      requestId: z.string().optional(),
      clientTimestamp: z.string().optional(),
      callbackUrl: z.string().url().optional().nullable(),
      priority: z.number().int().min(1).max(10).optional().default(5),
      context: z
        .object({
          ip: z.string().optional(),
          userAgent: z.string().optional(),
          source: z.string().optional(),
          correlationId: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

// ============================================================================
// Command-Specific Payload Schemas
// ============================================================================

/**
 * Browser visit options schema (defined first to avoid forward reference)
 */
const browserVisitOptionsSchema = z.object({
  waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle', 'commit']).optional(),
  timeout: z.number().int().positive().optional(),
  returnHtml: z.boolean().optional(),
  saveToFile: z.boolean().optional(),
  handleCloudflare: z.boolean().optional(),
  useProgressiveRetry: z.boolean().optional(),
});

/**
 * Browser command payloads
 */
export const browserPayloadSchemas: Record<string, z.ZodSchema> = {
  'browser.visit': z.object({
    url: z.string().url('Invalid URL format'),
    options: browserVisitOptionsSchema.optional(),
  }),

  'browser.execute': z.object({
    code: z.string().min(1, 'JavaScript code is required'),
    timeout: z.number().int().positive().optional(),
  }),

  'browser.screenshot': z.object({
    pageId: z.string().optional(),
    options: z
      .object({
        fullPage: z.boolean().optional(),
        format: z.enum(['png', 'jpeg', 'webp']).optional(),
        quality: z.number().int().min(0).max(100).optional(),
        saveToFile: z.boolean().optional(),
      })
      .optional(),
  }),

  'browser.navigate': z.object({
    pageId: z.string().optional(),
    url: z.string().url('Invalid URL format'),
    options: browserVisitOptionsSchema.optional(),
  }),

  'browser.evaluate': z.object({
    expression: z.string().min(1, 'Expression is required'),
    pageId: z.string().optional(),
    timeout: z.number().int().positive().optional(),
  }),
};

/**
 * Chat command payloads
 */
export const chatPayloadSchemas: Record<string, z.ZodSchema> = {
  'chat.message': z.object({
    prompt: z.string().min(1, 'Prompt is required'),
    sessionId: z.string().optional(),
    options: z
      .object({
        stream: z.boolean().optional(),
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().int().positive().optional(),
        model: z.string().optional(),
      })
      .optional(),
  }),

  'chat.conversation': z.object({
    sessionId: z.string().min(1, 'Session ID is required'),
    options: z
      .object({
        includeMetadata: z.boolean().optional(),
        limit: z.number().int().positive().max(100).optional(),
      })
      .optional(),
  }),

  'chat.history': z.object({
    sessionId: z.string().optional(),
    options: z
      .object({
        limit: z.number().int().positive().max(100).optional(),
        offset: z.number().int().nonnegative().optional(),
      })
      .optional(),
  }),

  'chat.clear': z.object({
    sessionId: z.string().optional(),
    all: z.boolean().optional(),
  }),
};

/**
 * IAAPA command payloads
 */
export const iaapaPayloadSchemas: Record<string, z.ZodSchema> = {
  'iaapa.search': z.object({
    query: z.string().min(1, 'Query is required'),
    filters: z.record(z.unknown()).optional(),
    options: z
      .object({
        limit: z.number().int().positive().max(100).optional(),
        offset: z.number().int().nonnegative().optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
      })
      .optional(),
  }),

  'iaapa.filter': z.object({
    filters: z.record(z.unknown()).optional(),
    options: z
      .object({
        limit: z.number().int().positive().max(100).optional(),
        offset: z.number().int().nonnegative().optional(),
      })
      .optional(),
  }),

  'iaapa.export': z.object({
    format: z.enum(['csv', 'json', 'xlsx']),
    filters: z.record(z.unknown()).optional(),
    filename: z.string().optional(),
  }),

  'iaapa.import': z.object({
    source: z.string().min(1, 'Source is required'),
    format: z.enum(['csv', 'json']),
    options: z.record(z.unknown()).optional(),
  }),
};

/**
 * Job command payloads
 */
export const jobPayloadSchemas: Record<string, z.ZodSchema> = {
  'job.create': z.object({
    jobId: z.string().optional(),
    target: z.object({
      url: z.string().url('Invalid target URL'),
      metadata: z.record(z.unknown()).optional(),
      lead: z.record(z.unknown()).optional(),
    }),
    parser: z.object({
      slug: z.string().min(1, 'Parser slug is required'),
      mode: z.enum(['single', 'batch', 'vendor']),
      definition: z.record(z.unknown()).optional(),
    }),
    callbackUrl: z.string().url().optional().nullable(),
    priority: z.number().int().min(1).max(10).optional().default(5),
  }),

  'job.status': z.object({
    jobId: z.string().min(1, 'Job ID is required'),
  }),

  'job.cancel': z.object({
    jobId: z.string().min(1, 'Job ID is required'),
    reason: z.string().optional(),
  }),

  'job.list': z.object({
    options: z
      .object({
        status: z.string().optional(),
        limit: z.number().int().positive().max(100).optional(),
        offset: z.number().int().nonnegative().optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(['asc', 'desc']).optional(),
      })
      .optional(),
  }),
};

/**
 * Internal command payloads
 */
export const internalPayloadSchemas: Record<string, z.ZodSchema> = {
  'internal.health': z.object({
    checks: z.array(z.string()).optional(),
  }),

  'internal.metrics': z.object({
    metrics: z.array(z.string()).optional(),
    timeframe: z
      .object({
        start: z.string().optional(),
        end: z.string().optional(),
      })
      .optional(),
  }),

  'internal.config': z.object({
    keys: z.array(z.string()).optional(),
  }),

  'internal.worker': z.object({
    action: z.enum(['status', 'restart', 'pause', 'resume']),
    workerId: z.string().optional(),
  }),
};

/**
 * Page command payloads
 */
export const pagePayloadSchemas: Record<string, z.ZodSchema> = {
  'page.create': z.object({
    type: z.enum(['browser', 'chat', 'scraper']),
    options: z.record(z.unknown()).optional(),
  }),

  'page.read': z.object({
    pageId: z.string().min(1, 'Page ID is required'),
  }),

  'page.update': z.object({
    pageId: z.string().min(1, 'Page ID is required'),
    updates: z.record(z.unknown()).optional(),
  }),

  'page.delete': z.object({
    pageId: z.string().min(1, 'Page ID is required'),
    force: z.boolean().optional(),
  }),
};

/**
 * Cron command payloads
 */
export const cronPayloadSchemas: Record<string, z.ZodSchema> = {
  'cron.schedule': z.object({
    cronExpression: z.string().min(1, 'Cron expression is required'),
    commandId: z.string().min(1, 'Command ID is required'),
    payload: z.record(z.unknown()).optional(),
    options: z.record(z.unknown()).optional(),
  }),

  'cron.unschedule': z.object({
    cronExpression: z.string().min(1, 'Cron expression is required'),
  }),

  'cron.list': z.object({
    options: z.record(z.unknown()).optional(),
  }),

  'cron.trigger': z.object({
    cronExpression: z.string().min(1, 'Cron expression is required'),
  }),
};

/**
 * Cleanup command payloads
 */
export const cleanupPayloadSchemas: Record<string, z.ZodSchema> = {
  'cleanup.logs': z.object({
    options: z
      .object({
        olderThan: z.string().optional(),
        limit: z.number().int().positive().optional(),
      })
      .optional(),
  }),

  'cleanup.cache': z.object({
    options: z
      .object({
        olderThan: z.string().optional(),
        pattern: z.string().optional(),
      })
      .optional(),
  }),

  'cleanup.temp': z.object({
    options: z
      .object({
        olderThan: z.string().optional(),
      })
      .optional(),
  }),

  'cleanup.sessions': z.object({
    options: z
      .object({
        olderThan: z.string().optional(),
        inactive: z.boolean().optional(),
      })
      .optional(),
  }),
};

/**
 * Error command payloads
 */
export const errorPayloadSchemas: Record<string, z.ZodSchema> = {
  'error.report': z.object({
    error: z.object({
      message: z.string().min(1, 'Error message is required'),
      stack: z.string().optional(),
      type: z.string().optional(),
    }),
    context: z.record(z.unknown()).optional(),
  }),

  'error.status': z.object({
    errorId: z.string().min(1, 'Error ID is required'),
  }),

  'error.history': z.object({
    options: z
      .object({
        limit: z.number().int().positive().max(100).optional(),
        offset: z.number().int().nonnegative().optional(),
      })
      .optional(),
  }),

  'error.resolve': z.object({
    errorId: z.string().min(1, 'Error ID is required'),
    resolution: z.string().optional(),
  }),
};

// ============================================================================
// Schema Registry
// ============================================================================

/**
 * Combined schema registry
 */
const payloadSchemaRegistry: Record<string, z.ZodSchema> = {
  ...browserPayloadSchemas,
  ...chatPayloadSchemas,
  ...iaapaPayloadSchemas,
  ...jobPayloadSchemas,
  ...internalPayloadSchemas,
  ...pagePayloadSchemas,
  ...cronPayloadSchemas,
  ...cleanupPayloadSchemas,
  ...errorPayloadSchemas,
};

/**
 * Get schema for a command
 */
export function getPayloadSchema(commandId: string): z.ZodSchema | null {
  return payloadSchemaRegistry[commandId] || null;
}

/**
 * Register a custom payload schema
 */
export function registerPayloadSchema(commandId: string, schema: z.ZodSchema): void {
  payloadSchemaRegistry[commandId] = schema;
}

// ============================================================================
// Middleware Implementation
// ============================================================================

/**
 * Validate the gateway request structure and command ID
 */
export function validateGatewayRequest(
  req: ValidatedRequest,
  _res: Response,
  next: NextFunction
): void {
  try {
    // Parse and validate the gateway request
    const parsed = gatewayRequestSchema.parse(req.body);

    // Attach parsed data to request
    req.commandId = parsed.commandId;
    req.rawPayload = parsed.payload as Record<string, unknown>;
    req.validatedPayload = parsed.payload as Record<string, unknown>;

    // Store full parsed request
    (req as unknown as { gatewayRequest: typeof parsed }).gatewayRequest = parsed;

    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      }));

      _res.status(400).json({
        success: false,
        error: {
          code: 'ERR_INVALID_REQUEST_STRUCTURE',
          message: 'Invalid gateway request structure',
          details: {
            validationErrors: errors,
          },
        },
      });
      return;
    }

    // Re-throw non-Zod errors
    throw error;
  }
}

/**
 * Validate command exists in registry
 */
export function validateCommandExists(
  req: ValidatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const commandId = req.commandId;

  if (!commandId) {
    _res.status(400).json({
      success: false,
      error: {
        code: 'ERR_MISSING_COMMAND_ID',
        message: 'Command ID is required',
      },
    });
    return;
  }

  // Check if command exists
  const command = commandRegistry.lookup(commandId);

  if (!command) {
    // Provide suggestions for similar commands
    const suggestions = findSimilarCommands(commandId);

    _res.status(400).json({
      success: false,
      error: {
        code: 'ERR_UNKNOWN_COMMAND',
        message: `Unknown command: ${commandId}`,
        details: {
          commandId,
          suggestions: suggestions.length > 0 ? suggestions : undefined,
        },
      },
    });
    return;
  }

  // Attach command info to request
  req.commandName = command.name;

  next();
}

/**
 * Validate payload against command schema
 */
export function validatePayload(commandId: string) {
  return (req: ValidatedRequest, _res: Response, next: NextFunction): void => {
    const payload = req.rawPayload || {};

    // Get the schema for this command
    const schema = getPayloadSchema(commandId);

    if (!schema) {
      // No schema defined, skip validation
      next();
      return;
    }

    try {
      // Validate and strip unknown fields
      const parsedPayload = schema.parse(payload);
      req.validatedPayload = parsedPayload;

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        }));

        _res.status(400).json({
          success: false,
          error: {
            code: 'ERR_INVALID_PAYLOAD',
            message: 'Invalid command payload',
            details: {
              commandId,
              validationErrors: errors,
            },
          },
        });
        return;
      }

      throw error;
    }
  };
}

/**
 * Combined middleware for full request validation
 *
 * Usage:
 *   router.post('/gateway',
 *     validateGatewayRequest,
 *     validateCommandExists,
 *     validatePayload('browser.visit'),
 *     gatewayController
 *   );
 */
export function validateRequest(commandId?: string) {
  if (commandId) {
    return [validateGatewayRequest, validateCommandExists, validatePayload(commandId)];
  }

  return [validateGatewayRequest, validateCommandExists];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find similar commands using Levenshtein distance
 */
function findSimilarCommands(commandId: string): string[] {
  const allCommands = commandRegistry.getAll().map(c => c.id);
  const threshold = 3;
  const maxSuggestions = 3;

  const suggestions = allCommands
    .map(cmd => ({
      id: cmd,
      distance: levenshteinDistance(commandId.toLowerCase(), cmd.toLowerCase()),
    }))
    .filter(s => s.distance <= threshold && s.distance > 0)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxSuggestions)
    .map(s => s.id);

  return suggestions;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// ============================================================================
// Export
// ============================================================================

export default {
  validateGatewayRequest,
  validateCommandExists,
  validatePayload,
  validateRequest,
  getPayloadSchema,
  registerPayloadSchema,
  gatewayRequestSchema,
};
