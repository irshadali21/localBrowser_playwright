/**
 * Gateway Middleware Index
 * Export all middleware and compose middleware stack for gateway routes
 */

import { Request, Response, NextFunction } from 'express';
import {
  apiKeyAuth,
  ApiKeyRequest,
  initializeApiKeys,
  addApiKey,
  removeApiKey,
  getActiveApiKeys,
} from './gatewayAuth';
import {
  validateGatewayRequest,
  validateCommandExists,
  validatePayload,
  validateRequest,
  ValidatedRequest,
  getPayloadSchema,
  registerPayloadSchema,
} from './gatewayValidation';
import {
  rateLimitGlobal,
  rateLimitPerCommand,
  rateLimit,
  rateLimitIp,
  rateLimitStrict,
  getRateLimitStatus,
  resetClientRateLimit,
  getRateLimitConfig,
  RateLimitedRequest,
  GLOBAL_RATE_LIMIT,
  PER_COMMAND_RATE_LIMITS,
} from './gatewayRateLimit';
import {
  hipaaCompliance,
  hipaaAudit,
  hipaaResponse,
  verifyHipaaCompliance,
  maskSensitiveData,
  logPhiAccess,
  getAuditLogsForCorrelation,
  getPhiAccessLogs,
  exportAuditLogs,
  HipaaRequest,
  DataClassification,
} from './hipaaCompliance';
import {
  requestLogging,
  responseLogging,
  logging,
  auditTrail,
  generateCorrelationId,
  getCorrelationId,
  maskRequestBody,
  LoggedRequest,
  LogLevel,
  logDebug,
  logInfo,
  logWarn,
  logError,
} from './gatewayLogging';
import {
  gatewayErrorHandler,
  notFoundHandler,
  asyncHandler,
  formatErrorResponse,
  mapErrorToCode,
  getHttpStatusCode,
  GatewayError,
  GatewayErrorCode,
  ErrorHandledRequest,
} from './gatewayErrorHandler';

// ============================================================================
// Type Aliases for Convenience
// ============================================================================

/**
 * Extended Express Request with all gateway middleware context
 */
export interface GatewayRequest
  extends
    Request,
    ApiKeyRequest,
    ValidatedRequest,
    RateLimitedRequest,
    HipaaRequest,
    LoggedRequest,
    ErrorHandledRequest {}

// ============================================================================
// Middleware Stack Composition
// ============================================================================

/**
 * Full gateway middleware stack
 *
 * Order matters! Middleware is executed in this order:
 * 1. Request logging (first to capture all requests)
 * 2. HIPAA compliance (early to detect PHI)
 * 3. Rate limiting (before expensive operations)
 * 4. Authentication (early to reject unauthorized requests)
 * 5. Validation (after auth, before business logic)
 * 6. Response logging (to capture timing)
 * 7. Error handling (last)
 */
export function createGatewayMiddlewareStack(options?: {
  skipAuth?: boolean;
  skipRateLimit?: boolean;
  skipValidation?: boolean;
  skipHipaa?: boolean;
  skipLogging?: boolean;
}): RequestHandler[] {
  const opts = {
    skipAuth: options?.skipAuth ?? false,
    skipRateLimit: options?.skipRateLimit ?? false,
    skipValidation: options?.skipValidation ?? false,
    skipHipaa: options?.skipHipaa ?? false,
    skipLogging: options?.skipLogging ?? false,
  };

  const stack: RequestHandler[] = [];

  // 1. Request logging (always first)
  if (!opts.skipLogging) {
    stack.push(requestLogging);
  }

  // 2. HIPAA compliance (early detection)
  if (!opts.skipHipaa) {
    stack.push(hipaaCompliance());
  }

  // 3. Rate limiting (before auth to prevent abuse)
  if (!opts.skipRateLimit) {
    stack.push(rateLimitGlobal());
    stack.push(rateLimitPerCommand());
  }

  // 4. Authentication
  if (!opts.skipAuth) {
    stack.push(apiKeyAuth);
  }

  // 5. Validation
  if (!opts.skipValidation) {
    stack.push(validateGatewayRequest);
    stack.push(validateCommandExists);
  }

  // 6. Response logging (after all other middleware)
  if (!opts.skipLogging) {
    stack.push(responseLogging);
  }

  return stack;
}

/**
 * Lightweight middleware stack (minimal overhead)
 */
export function createLightweightMiddlewareStack(): RequestHandler[] {
  return [
    requestLogging,
    rateLimitGlobal(),
    apiKeyAuth,
    validateGatewayRequest,
    validateCommandExists,
  ];
}

/**
 * Health check middleware stack (no auth, minimal checks)
 */
export function createHealthCheckMiddlewareStack(): RequestHandler[] {
  return [requestLogging, rateLimitIp({ maxRequests: 200, windowMs: 60000 })];
}

/**
 * Admin middleware stack (additional security)
 */
export function createAdminMiddlewareStack(): RequestHandler[] {
  return [
    requestLogging,
    hipaaCompliance({ requireCorrelationId: true }),
    rateLimitStrict(20, 60000), // Stricter rate limits for admin
    apiKeyAuth,
    requireScope('gateway:admin'), // Additional scope check
    validateGatewayRequest,
    validateCommandExists,
    responseLogging,
  ];
}

// ============================================================================
// Type Definition for RequestHandler
// ============================================================================

type RequestHandler = (req: Request, res: Response, next: NextFunction) => void;

// ============================================================================
// Scope Requirement Helper
// ============================================================================

/**
 * Require specific scope (admin-only routes)
 */
function requireScope(scope: string): RequestHandler {
  return (req: ApiKeyRequest, _res: Response, next: NextFunction): void => {
    if (!req.apiKey) {
      _res.status(401).json({
        success: false,
        error: {
          code: 'ERR_AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
        },
      });
      return;
    }

    if (!req.apiKey.scopes.includes(scope) && !req.apiKey.scopes.includes('gateway:admin')) {
      _res.status(403).json({
        success: false,
        error: {
          code: 'ERR_SCOPE_REQUIRED',
          message: `Required scope: ${scope}`,
        },
      });
      return;
    }

    next();
  };
}

// ============================================================================
// Default Middleware Stack
// ============================================================================

/**
 * Default gateway middleware stack
 * Ready-to-use middleware stack for gateway routes
 */
export const defaultGatewayStack = createGatewayMiddlewareStack();

/**
 * Alternative: Composed middleware function for express()
 */
export function gatewayMiddleware(options?: {
  skipAuth?: boolean;
  skipRateLimit?: boolean;
  skipValidation?: boolean;
  skipHipaa?: boolean;
  skipLogging?: boolean;
}): RequestHandler[] {
  return createGatewayMiddlewareStack(options);
}

// ============================================================================
// Admin Functions
// ============================================================================

/**
 * Initialize all middleware dependencies
 */
export function initializeMiddleware(): void {
  // Initialize API keys
  initializeApiKeys();

  console.log('[GatewayMiddleware] Initialized');
}

/**
 * Get middleware status
 */
export function getMiddlewareStatus(): {
  apiKeys: {
    count: number;
    keys: Array<{ keyId: string; name: string; active: boolean }>;
  };
  rateLimits: {
    global: typeof GLOBAL_RATE_LIMIT;
    perCommand: typeof PER_COMMAND_RATE_LIMITS;
  };
} {
  return {
    apiKeys: {
      count: getActiveApiKeys().length,
      keys: getActiveApiKeys().map(k => ({
        keyId: k.keyId,
        name: k.name,
        active: k.active,
      })),
    },
    rateLimits: {
      global: GLOBAL_RATE_LIMIT,
      perCommand: PER_COMMAND_RATE_LIMITS,
    },
  };
}

// ============================================================================
// Re-export All Middleware
// ============================================================================

// Authentication
export { apiKeyAuth, initializeApiKeys, addApiKey, removeApiKey, getActiveApiKeys, ApiKeyRequest };

// Validation
export {
  validateGatewayRequest,
  validateCommandExists,
  validatePayload,
  validateRequest,
  ValidatedRequest,
  getPayloadSchema,
  registerPayloadSchema,
};

// Rate Limiting
export {
  rateLimitGlobal,
  rateLimitPerCommand,
  rateLimit,
  rateLimitIp,
  rateLimitStrict,
  getRateLimitStatus,
  resetClientRateLimit,
  getRateLimitConfig,
  RateLimitedRequest,
  GLOBAL_RATE_LIMIT,
  PER_COMMAND_RATE_LIMITS,
};

// HIPAA
export {
  hipaaCompliance,
  hipaaAudit,
  hipaaResponse,
  verifyHipaaCompliance,
  maskSensitiveData,
  logPhiAccess,
  getAuditLogsForCorrelation,
  getPhiAccessLogs,
  exportAuditLogs,
  HipaaRequest,
  DataClassification,
};

// Logging
export {
  requestLogging,
  responseLogging,
  logging,
  auditTrail,
  generateCorrelationId,
  getCorrelationId,
  maskRequestBody,
  LoggedRequest,
  LogLevel,
  logDebug,
  logInfo,
  logWarn,
  logError,
};

// Error Handling
export {
  gatewayErrorHandler,
  notFoundHandler,
  asyncHandler,
  formatErrorResponse,
  mapErrorToCode,
  getHttpStatusCode,
  GatewayError,
  GatewayErrorCode,
  ErrorHandledRequest,
};

// ============================================================================
// Export
// ============================================================================

export default {
  // Middleware stacks
  createGatewayMiddlewareStack,
  createLightweightMiddlewareStack,
  createHealthCheckMiddlewareStack,
  createAdminMiddlewareStack,
  defaultGatewayStack,
  gatewayMiddleware,

  // Admin functions
  initializeMiddleware,
  getMiddlewareStatus,

  // Re-export all middleware
  apiKeyAuth,
  initializeApiKeys,
  addApiKey,
  removeApiKey,
  getActiveApiKeys,
  validateGatewayRequest,
  validateCommandExists,
  validatePayload,
  validateRequest,
  getPayloadSchema,
  registerPayloadSchema,
  rateLimitGlobal,
  rateLimitPerCommand,
  rateLimit,
  rateLimitIp,
  rateLimitStrict,
  getRateLimitStatus,
  resetClientRateLimit,
  getRateLimitConfig,
  hipaaCompliance,
  hipaaAudit,
  hipaaResponse,
  verifyHipaaCompliance,
  maskSensitiveData,
  logPhiAccess,
  getAuditLogsForCorrelation,
  getPhiAccessLogs,
  exportAuditLogs,
  requestLogging,
  responseLogging,
  logging,
  auditTrail,
  generateCorrelationId,
  getCorrelationId,
  maskRequestBody,
  logDebug,
  logInfo,
  logWarn,
  logError,
  gatewayErrorHandler,
  notFoundHandler,
  asyncHandler,
  formatErrorResponse,
  mapErrorToCode,
  getHttpStatusCode,
  GatewayError,
  GatewayErrorCode,
};
