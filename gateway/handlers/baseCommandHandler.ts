/**
 * Base Command Handler
 * Abstract base class for all command handlers with HIPAA audit integration
 */

import { GatewayRequest, GatewayResponse, ResponseData, ErrorResponse } from '../commandTypes';
import { logPhiAccess, maskSensitiveData, HipaaAuditLog } from '../../middleware/hipaaCompliance';

/**
 * Audit context for HIPAA compliance
 */
export interface AuditContext {
  correlationId: string;
  commandId: string;
  userId?: string;
  clientId?: string;
  ip?: string;
  userAgent?: string;
  action: 'read' | 'write' | 'delete' | 'export';
}

/**
 * Handler result interface
 */
export interface HandlerResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Abstract base class for all command handlers
 */
export abstract class BaseCommandHandler {
  protected auditLogs: HipaaAuditLog[] = [];

  /**
   * Validate the command payload
   * @param payload - Command payload to validate
   * @returns Validation result with errors if any
   */
  abstract validate(payload: Record<string, unknown>): { valid: boolean; errors?: string[] };

  /**
   * Execute the command
   * @param payload - Command payload
   * @param context - Audit context
   * @returns Handler result
   */
  abstract execute(payload: Record<string, unknown>, context: AuditContext): Promise<HandlerResult>;

  /**
   * Get the command category
   */
  abstract getCategory(): string;

  /**
   * Get the command name
   */
  abstract getName(): string;

  /**
   * Format response data
   * @param result - Raw result from execution
   * @returns Formatted response data
   */
  formatResponse(result: HandlerResult): ResponseData {
    return {
      result: result.data,
      info: result.error ? { warning: result.error } : undefined,
    };
  }

  /**
   * Format error response
   * @param error - Error object
   * @param correlationId - Correlation ID for tracking
   * @returns Formatted error response
   */
  formatErrorResponse(error: Error, correlationId: string): ErrorResponse {
    const code = this.getErrorCode(error);
    return {
      code,
      message: error.message || 'An unexpected error occurred',
      details: {
        type: error.constructor.name,
        correlationId,
      },
      correlationId,
    };
  }

  /**
   * Get error code from error
   * @param error - Error object
   * @returns Error code string
   */
  protected getErrorCode(error: Error): string {
    const errorMessage = error.message.toUpperCase().replace(/\s+/g, '_');
    return `ERR_${errorMessage}`;
  }

  /**
   * Log HIPAA audit trail
   * @param context - Audit context
   * @param payload - Request payload (will be masked)
   * @param success - Whether the operation was successful
   * @param errorMessage - Error message if failed
   */
  protected logAudit(
    context: AuditContext,
    payload: Record<string, unknown>,
    success: boolean,
    errorMessage?: string
  ): void {
    const maskedPayload = maskSensitiveData(payload);

    const auditId = logPhiAccess(
      context.correlationId,
      context.commandId,
      maskedPayload,
      {
        ip: context.ip || '',
        get: (header: string) => (header === 'user-agent' ? context.userAgent : ''),
      } as any,
      context.action,
      success,
      errorMessage
    );

    this.auditLogs.push({
      auditId,
      timestamp: new Date().toISOString(),
      correlationId: context.correlationId,
      commandId: context.commandId,
      classification:
        maskedPayload && Object.keys(maskedPayload).length > 0
          ? (maskedPayload as any).classification || 'public'
          : 'public',
      phiAccessed: false,
      action: context.action,
      success,
      errorMessage,
      ip: context.ip,
      userAgent: context.userAgent,
    });
  }

  /**
   * Get audit logs for this handler instance
   * @returns Array of audit logs
   */
  getAuditLogs(): HipaaAuditLog[] {
    return [...this.auditLogs];
  }

  /**
   * Clear audit logs
   */
  clearAuditLogs(): void {
    this.auditLogs = [];
  }

  /**
   * Process a command request
   * @param request - Gateway request
   * @returns Gateway response
   */
  async process(request: GatewayRequest): Promise<GatewayResponse> {
    const startTime = Date.now();
    const correlationId =
      request.metadata?.requestId || `corr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    const context: AuditContext = {
      correlationId,
      commandId: request.commandId,
      ip: request.metadata?.context?.ip,
      userAgent: request.metadata?.context?.userAgent,
      action: this.getDefaultAction(),
    };

    try {
      // Validate payload
      const validation = this.validate(request.payload);
      if (!validation.valid) {
        const error = new Error(`Validation failed: ${validation.errors?.join(', ')}`);
        this.logAudit(context, request.payload, false, error.message);

        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
            details: { errors: validation.errors },
            correlationId,
          },
          metadata: {
            processingTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            commandId: request.commandId,
            version: request.version || '1.0.0',
          },
        };
      }

      // Execute command
      const result = await this.execute(request.payload, context);
      this.logAudit(context, request.payload, result.success, result.error);

      if (result.success) {
        return {
          success: true,
          data: this.formatResponse(result),
          metadata: {
            processingTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            commandId: request.commandId,
            version: request.version || '1.0.0',
          },
        };
      } else {
        return {
          success: false,
          error: {
            code: result.code || 'EXECUTION_ERROR',
            message: result.error || 'Command execution failed',
            correlationId,
          },
          metadata: {
            processingTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            commandId: request.commandId,
            version: request.version || '1.0.0',
          },
        };
      }
    } catch (error) {
      const err = error as Error;
      this.logAudit(context, request.payload, false, err.message);

      return {
        success: false,
        error: this.formatErrorResponse(err, correlationId),
        metadata: {
          processingTimeMs: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          commandId: request.commandId,
          version: request.version || '1.0.0',
        },
      };
    }
  }

  /**
   * Get the default audit action for this handler
   * Override in subclasses for specific actions
   */
  protected getDefaultAction(): 'read' | 'write' | 'delete' | 'export' {
    return 'read';
  }
}

/**
 * Factory function to create audit context from request
 * @param request - Gateway request
 * @param commandId - Command ID being executed
 * @returns Audit context
 */
export function createAuditContext(request: GatewayRequest, commandId: string): AuditContext {
  return {
    correlationId:
      request.metadata?.requestId || `corr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    commandId,
    ip: request.metadata?.context?.ip,
    userAgent: request.metadata?.context?.userAgent,
    action: 'read',
  };
}
