/**
 * Gateway Controller
 * Main handler for all gateway commands with validation and execution
 */

import type { Request, Response, NextFunction } from 'express';
import { commandRegistry } from '../gateway/commandRegistry';
import type { GatewayRequest, GatewayResponse } from '../gateway/commandTypes';
import { ValidationError } from '../types/errors';
import { logErrorToDB } from '../utils/errorLogger';

/**
 * Generate a unique correlation ID
 */
function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Main gateway command handler
 */
export async function handleGatewayCommand(
  req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  let correlationId = '';

  try {
    // Extract or generate correlation ID
    const body = req.body as Record<string, unknown> | undefined;
    correlationId =
      (req.headers['x-correlation-id'] as string) ||
      ((body?.metadata as Record<string, unknown>)?.correlationId as string) ||
      generateCorrelationId();

    // Parse the gateway request
    const gatewayRequest = parseGatewayRequest(req);

    // Lookup the command in the registry
    const command = commandRegistry.lookup(gatewayRequest.commandId);

    if (!command) {
      throw new ValidationError(`Unknown command: ${gatewayRequest.commandId}`, {
        commandId: gatewayRequest.commandId,
        correlationId,
      });
    }

    // Validate the payload
    const validationResult = validatePayload(command, gatewayRequest.payload);
    if (!validationResult.valid) {
      throw new ValidationError('Invalid payload', {
        validationErrors: validationResult.errors,
        correlationId,
      });
    }

    // Execute the handler
    const handlerResult = await executeHandler(command, gatewayRequest, req);

    // Format the response
    const processingTimeMs = Date.now() - startTime;
    const response = formatSuccessResponse(
      handlerResult,
      gatewayRequest.commandId,
      processingTimeMs,
      correlationId
    );

    res.json(response);
  } catch (err) {
    const error = err as Error;
    const processingTimeMs = Date.now() - startTime;

    // Log the error
    await logErrorToDB({
      type: 'GATEWAY_ERROR',
      message: error.message,
      stack: error.stack,
      route: '/api/v1/gateway',
      input: req.body,
    });

    // Format error response
    const errorResponse = formatErrorResponse(error, processingTimeMs, correlationId);

    res.status(errorResponse.error!.code.startsWith('ERR_') ? 400 : 500).json(errorResponse);
  }
}

/**
 * Parse incoming request into GatewayRequest format
 */
function parseGatewayRequest(req: Request): GatewayRequest {
  // Support both JSON body and query-based commands
  if (req.body && typeof req.body === 'object') {
    return {
      commandId: req.body.commandId || req.body.command,
      version: req.body.version || 'v1',
      payload: req.body.payload || {},
      metadata: {
        requestId: req.body.metadata?.requestId,
        clientTimestamp: req.body.metadata?.clientTimestamp,
        callbackUrl: req.body.metadata?.callbackUrl,
        priority: req.body.metadata?.priority || 5,
        context: {
          ip: req.ip || req.connection?.remoteAddress,
          userAgent: req.get('user-agent'),
          source: req.get('x-source') || 'api',
          correlationId: req.headers['x-correlation-id'] as string,
        },
      },
    };
  }

  // Fallback for query-based commands
  return {
    commandId: (req.query.commandId as string) || (req.query.command as string),
    version: (req.query.version as string) || 'v1',
    payload: req.query,
    metadata: {
      context: {
        ip: req.ip || req.connection?.remoteAddress,
        userAgent: req.get('user-agent'),
        source: req.get('x-source') || 'api',
        correlationId: req.headers['x-correlation-id'] as string,
      },
    },
  };
}

/**
 * Validate payload against command schema
 */
function validatePayload(
  command: { payloadSchema?: { schema: Record<string, unknown> } },
  payload: Record<string, unknown>
): { valid: boolean; errors?: string[] } {
  // Basic validation - check required fields from schema
  if (command.payloadSchema?.schema) {
    const schema = command.payloadSchema.schema as Record<string, unknown>;
    const errors: string[] = [];

    // Check for required fields
    if (schema.required && Array.isArray(schema.required)) {
      for (const requiredField of schema.required) {
        if (!(requiredField in payload) || payload[requiredField] === undefined) {
          errors.push(`Missing required field: ${requiredField}`);
        }
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }
  }

  return { valid: true };
}

/**
 * Execute the command handler
 */
async function executeHandler(
  command: { handler: string },
  gatewayRequest: GatewayRequest,
  req: Request
): Promise<unknown> {
  // Parse handler string (e.g., 'browserController.visit')
  const handlerPath = command.handler.split('.');
  const controllerName = handlerPath[0];
  const methodName = handlerPath[1];

  // Dynamically import the controller
  let controller: Record<string, unknown>;

  try {
    const controllerModule = await import(`../controllers/${controllerName}`);
    controller = controllerModule.default || controllerModule;
  } catch (_importError) {
    throw new Error(`Failed to load controller: ${controllerName}`);
  }

  // Get the handler method
  const handler = controller[methodName] as (
    req: Request,
    res: Response,
    next: NextFunction
  ) => Promise<void>;

  if (!handler) {
    throw new Error(`Handler not found: ${command.handler}`);
  }

  // Create a mock response object to capture the result
  let capturedResult: unknown;
  const mockRes = {
    json: (data: unknown) => {
      capturedResult = data;
    },
    status: () => mockRes,
    setHeader: () => mockRes,
  } as unknown as Response;

  // Execute the handler with a modified request
  const modifiedReq = {
    ...req,
    body: gatewayRequest.payload,
    query: gatewayRequest.metadata?.context,
  };

  await handler(modifiedReq as Request, mockRes, () => {});

  return capturedResult;
}

/**
 * Format a successful response
 */
function formatSuccessResponse(
  _result: unknown,
  commandId: string,
  processingTimeMs: number,
  _correlationId: string
): GatewayResponse {
  return {
    success: true,
    data: {
      result: _result,
    },
    metadata: {
      processingTimeMs,
      timestamp: new Date().toISOString(),
      commandId,
      version: 'v1',
    },
  };
}

/**
 * Format an error response
 */
function formatErrorResponse(
  error: Error,
  processingTimeMs: number,
  correlationId: string
): GatewayResponse {
  const errorResponse: GatewayResponse = {
    success: false,
    error: {
      code: getErrorCode(error),
      message: error.message || 'An unexpected error occurred',
      details: (error as { details?: Record<string, unknown> }).details,
      correlationId,
    },
    metadata: {
      processingTimeMs,
      timestamp: new Date().toISOString(),
      commandId: 'unknown',
      version: 'v1',
    },
  };

  return errorResponse;
}

/**
 * Extract error code from error
 */
function getErrorCode(error: Error): string {
  // Check for AppError with code property
  const appError = error as { code?: string };
  if (appError.code) {
    return appError.code;
  }

  // Map error types to codes
  if (error instanceof ValidationError) {
    return 'ERR_VALIDATION';
  }

  if (error.name === 'AuthenticationError') {
    return 'ERR_AUTHENTICATION';
  }

  if (error.name === 'AuthorizationError') {
    return 'ERR_AUTHORIZATION';
  }

  if (error.name === 'NotFoundError') {
    return 'ERR_NOT_FOUND';
  }

  if (error.name === 'TimeoutError') {
    return 'ERR_TIMEOUT';
  }

  if (error.name === 'NetworkError') {
    return 'ERR_NETWORK';
  }

  return 'ERR_INTERNAL';
}

/**
 * Get all registered commands (for debugging/admin)
 */
export async function getAllCommands(
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  const commands = commandRegistry.getAll();
  const stats = commandRegistry.getCategoryStats();

  res.json({
    success: true,
    data: {
      commands,
      stats,
      totalCommands: commands.length,
    },
  });
}

/**
 * Health check endpoint
 */
export async function healthCheck(
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> {
  const stats = commandRegistry.getCategoryStats();
  const totalCommands = Object.values(stats).reduce((a, b) => a + b, 0);

  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      gateway: {
        version: 'v1',
        totalCommands,
        categories: stats,
      },
    },
  });
}

/**
 * Metrics endpoint
 */
export async function getMetrics(_req: Request, res: Response, _next: NextFunction): Promise<void> {
  const stats = commandRegistry.getCategoryStats();
  const categories = commandRegistry.getCategories();

  const metrics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    commands: {
      total: Object.values(stats).reduce((a, b) => a + b, 0),
      byCategory: stats,
    },
  };

  // Add category details
  for (const [category, commands] of categories) {
    metrics[category] = {
      count: commands.length,
      commands: commands.map(c => ({
        id: c.id,
        name: c.name,
        requireAuth: c.requireAuth,
      })),
    };
  }

  res.json({
    success: true,
    data: metrics,
  });
}

export default {
  handleGatewayCommand,
  getAllCommands,
  healthCheck,
  getMetrics,
};
