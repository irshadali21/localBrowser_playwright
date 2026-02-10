/**
 * HIPAA Compliance Middleware
 * Identifies PHI-containing requests, audits logging, data classification, and masking
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Data classification levels
 */
export enum DataClassification {
  PUBLIC = 'public',
  SENSITIVE = 'sensitive',
  PHI = 'phi', // Protected Health Information
  CONFIDENTIAL = 'confidential', // Business confidential
}

/**
 * PHI field patterns for detection
 */
export interface PhiPattern {
  name: string;
  pattern: RegExp;
  classification: DataClassification;
}

/**
 * Audit log entry for HIPAA compliance
 */
export interface HipaaAuditLog {
  /** Unique audit ID */
  auditId: string;

  /** Timestamp of access */
  timestamp: string;

  /** Correlation ID for tracking */
  correlationId: string;

  /** Who accessed the data */
  userId?: string;
  clientId?: string;
  apiKeyId?: string;

  /** What was accessed */
  commandId: string;
  resourceType?: string;
  resourceId?: string;

  /** Data classification */
  classification: DataClassification;

  /** Whether PHI was accessed */
  phiAccessed: boolean;

  /** Specific PHI types accessed */
  phiTypes?: string[];

  /** Request metadata */
  ip?: string;
  userAgent?: string;

  /** Action performed */
  action: 'read' | 'write' | 'delete' | 'export';

  /** Success/failure */
  success: boolean;

  /** Error message if failed */
  errorMessage?: string;
}

/**
 * Extended Express Request with HIPAA compliance info
 */
export interface HipaaRequest extends Request {
  hipaa?: {
    correlationId: string;
    classification: DataClassification;
    phiFields: string[];
    requiresAudit: boolean;
    retentionDays: number;
  };
}

// ============================================================================
// PHI Detection Patterns
// ============================================================================

/**
 * Known PHI field patterns for detection
 */
export const PHI_PATTERNS: PhiPattern[] = [
  { name: 'ssn', pattern: /^\d{3}-?\d{2}-?\d{4}$/, classification: DataClassification.PHI },
  {
    name: 'social_security',
    pattern: /\b\d{3}-\d{2}-\d{4}\b/,
    classification: DataClassification.PHI,
  },
  {
    name: 'date_of_birth',
    pattern: /dob|birth_date|birthdate/i,
    classification: DataClassification.PHI,
  },
  {
    name: 'medical_record',
    pattern: /mrn|medical_record_number/i,
    classification: DataClassification.PHI,
  },
  {
    name: 'health_plan',
    pattern: /health_plan|insurance|policy_number/i,
    classification: DataClassification.PHI,
  },
  {
    name: 'email',
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    classification: DataClassification.SENSITIVE,
  },
  { name: 'phone', pattern: /^\+?[\d\s\-()]{10,}$/, classification: DataClassification.SENSITIVE },
  {
    name: 'address',
    pattern: /address|street|city|zip|postal/i,
    classification: DataClassification.SENSITIVE,
  },
  {
    name: 'ip_address',
    pattern:
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
    classification: DataClassification.SENSITIVE,
  },
  {
    name: 'credit_card',
    pattern:
      /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})$/,
    classification: DataClassification.PHI,
  },
  {
    name: 'password',
    pattern: /password|passwd|pwd/i,
    classification: DataClassification.CONFIDENTIAL,
  },
  {
    name: 'api_key',
    pattern: /api_key|apikey|secret|token/i,
    classification: DataClassification.CONFIDENTIAL,
  },
];

/**
 * Sensitive field names to mask
 */
export const SENSITIVE_FIELDS = new Set([
  'ssn',
  'social_security_number',
  'date_of_birth',
  'dob',
  'birth_date',
  'medical_record_number',
  'mrn',
  'health_plan_number',
  'insurance_id',
  'credit_card',
  'cvv',
  'password',
  'api_key',
  'secret',
  'token',
  'access_token',
  'refresh_token',
]);

/**
 * Fields that indicate PHI content
 */
export const PHI_INDICATOR_FIELDS = new Set([
  'patient',
  'patient_id',
  'diagnosis',
  'treatment',
  'prescription',
  'medication',
  'lab_result',
  'lab_results',
  'clinical',
  'health',
  'medical',
  'healthcare',
  'hipaa',
  'protected_health',
]);

// ============================================================================
// Audit Log Storage (In-memory, use secure database in production)
// ============================================================================

const auditLogStore: HipaaAuditLog[] = [];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate unique audit ID
 */
function generateAuditId(): string {
  return `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Detect PHI in data
 */
function detectPhi(data: Record<string, unknown>): {
  hasPhi: boolean;
  phiFields: string[];
  phiTypes: string[];
} {
  const phiFields: string[] = [];
  const phiTypes: string[] = [];

  function scanObject(obj: Record<string, unknown>, prefix = ''): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      const lowerKey = key.toLowerCase();

      // Check if field name indicates PHI
      if (PHI_INDICATOR_FIELDS.has(lowerKey) || SENSITIVE_FIELDS.has(lowerKey)) {
        phiFields.push(fullKey);

        // Check pattern match
        for (const pattern of PHI_PATTERNS) {
          if (pattern.classification === DataClassification.PHI) {
            if (typeof value === 'string' && pattern.pattern.test(value)) {
              if (!phiTypes.includes(pattern.name)) {
                phiTypes.push(pattern.name);
              }
            }
          }
        }
      }

      // Recursively scan nested objects
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        scanObject(value as Record<string, unknown>, fullKey);
      }
    }
  }

  scanObject(data);

  return {
    hasPhi: phiFields.length > 0,
    phiFields,
    phiTypes,
  };
}

/**
 * Classify data based on content
 */
function classifyData(data: Record<string, unknown>): DataClassification {
  const { hasPhi } = detectPhi(data);

  if (hasPhi) {
    return DataClassification.PHI;
  }

  // Check for sensitive indicators
  for (const key of Object.keys(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_FIELDS.has(lowerKey)) {
      return DataClassification.SENSITIVE;
    }
  }

  return DataClassification.PUBLIC;
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  function mask(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      if (SENSITIVE_FIELDS.has(lowerKey) || PHI_INDICATOR_FIELDS.has(lowerKey)) {
        // Mask sensitive fields
        if (typeof value === 'string') {
          result[key] = '***MASKED***';
        } else {
          result[key] = '***MASKED***';
        }
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Recursively mask nested objects
        result[key] = mask(value as Record<string, unknown>);
      } else if (Array.isArray(value)) {
        // Process arrays
        result[key] = value.map(item => {
          if (item !== null && typeof item === 'object') {
            return mask(item as Record<string, unknown>);
          }
          return item;
        });
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  return mask(data);
}

/**
 * Get retention days based on classification
 */
function getRetentionDays(classification: DataClassification): number {
  switch (classification) {
    case DataClassification.PHI:
      return 2190; // 6 years for HIPAA
    case DataClassification.CONFIDENTIAL:
      return 1095; // 3 years
    case DataClassification.SENSITIVE:
      return 365; // 1 year
    default:
      return 90; // 90 days for public
  }
}

// ============================================================================
// Audit Logging Functions
// ============================================================================

/**
 * Log PHI access for HIPAA compliance
 */
export function logPhiAccess(
  correlationId: string,
  commandId: string,
  data: Record<string, unknown>,
  request: Request,
  action: 'read' | 'write' | 'delete' | 'export',
  success: boolean,
  errorMessage?: string
): string {
  const classification = classifyData(data);
  const { hasPhi, phiTypes } = detectPhi(data);

  const auditEntry: HipaaAuditLog = {
    auditId: generateAuditId(),
    timestamp: new Date().toISOString(),
    correlationId,
    commandId,
    classification,
    phiAccessed: hasPhi,
    phiTypes: hasPhi ? phiTypes : undefined,
    action,
    success,
    errorMessage,
    ip: request.ip,
    userAgent: request.get('user-agent'),
  };

  // Add client info if available
  const apiKeyId = (request as { apiKeyId?: string }).apiKeyId;
  if (apiKeyId) {
    auditEntry.apiKeyId = apiKeyId;
  }

  // Store audit log
  auditLogStore.push(auditEntry);

  // In production, this would also write to a secure, append-only audit log

  console.log(
    `[HIPAA Audit] ${auditEntry.phiAccessed ? 'PHI ACCESS' : 'Data Access'}: ${auditEntry.auditId}`
  );

  return auditEntry.auditId;
}

/**
 * Get audit logs for a correlation ID
 */
export function getAuditLogsForCorrelation(correlationId: string): HipaaAuditLog[] {
  return auditLogStore.filter(log => log.correlationId === correlationId);
}

/**
 * Get all PHI access audit logs
 */
export function getPhiAccessLogs(): HipaaAuditLog[] {
  return auditLogStore.filter(log => log.phiAccessed);
}

/**
 * Export audit logs (for compliance reporting)
 */
export function exportAuditLogs(options?: {
  startDate?: Date;
  endDate?: Date;
  phiOnly?: boolean;
}): HipaaAuditLog[] {
  let logs = [...auditLogStore];

  if (options?.startDate) {
    logs = logs.filter(log => new Date(log.timestamp) >= options.startDate!);
  }

  if (options?.endDate) {
    logs = logs.filter(log => new Date(log.timestamp) <= options.endDate!);
  }

  if (options?.phiOnly) {
    logs = logs.filter(log => log.phiAccessed);
  }

  return logs;
}

// ============================================================================
// Middleware Implementation
// ============================================================================

/**
 * HIPAA Compliance Middleware
 *
 * This middleware:
 * 1. Generates a correlation ID if not present
 * 2. Detects PHI in request payload
 * 3. Adds HIPAA-specific headers to response
 * 4. Sets up audit logging for PHI access
 */
export function hipaaCompliance(options?: {
  requireCorrelationId?: boolean;
  auditPhiOnly?: boolean;
}) {
  const opts = {
    requireCorrelationId: options?.requireCorrelationId ?? false,
    auditPhiOnly: options?.auditPhiOnly ?? true,
  };

  return (req: HipaaRequest, _res: Response, next: NextFunction): void => {
    // Generate or extract correlation ID
    const correlationId =
      (req.headers['x-correlation-id'] as string) ||
      `corr_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Classify the request payload
    const body = req.body as Record<string, unknown> | undefined;
    const classification = body ? classifyData(body) : DataClassification.PUBLIC;
    const { hasPhi, phiFields } = body ? detectPhi(body) : { hasPhi: false, phiFields: [] };

    // Attach HIPAA info to request
    req.hipaa = {
      correlationId,
      classification,
      phiFields,
      requiresAudit: hasPhi || !opts.auditPhiOnly,
      retentionDays: getRetentionDays(classification),
    };

    // Add HIPAA headers to response
    _res.set('X-HIPAA-Compliance', 'enabled');
    _res.set('X-Data-Classification', classification);
    _res.set('X-Correlation-ID', correlationId);

    if (hasPhi) {
      _res.set('X-PHI-Detected', 'true');
      _res.set('X-Audit-Required', 'true');
    }

    next();
  };
}

/**
 * Audit Logging Middleware
 *
 * Logs all requests that access PHI or sensitive data
 */
export function hipaaAudit(action: 'read' | 'write' | 'delete' | 'export') {
  return (req: HipaaRequest, _res: Response, next: NextFunction): void => {
    const body = req.body as Record<string, unknown> | undefined;
    const correlationId =
      req.hipaa?.correlationId ||
      (req.headers['x-correlation-id'] as string) ||
      `corr_${Date.now()}`;
    const commandId = (req as { commandId?: string }).commandId || 'unknown';

    // Store audit function for response phase
    const auditPayload = body || {};

    // Attach audit function to request
    (req as unknown as { _hipaaAudit?: () => void })._hipaaAudit = () => {
      logPhiAccess(correlationId, commandId, auditPayload, req, action, true);
    };

    next();
  };
}

/**
 * HIPAA Response Middleware
 *
 * Attach to response to ensure proper headers and logging on completion
 */
export function hipaaResponse() {
  return (req: HipaaRequest, _res: Response, next: NextFunction): void => {
    // Override res.json to add HIPAA headers and audit logging
    const originalJson = _res.json.bind(_res);

    _res.json = function (data: unknown): Response {
      // Add HIPAA headers
      if (req.hipaa) {
        _res.set('X-Retention-Days', req.hipaa.retentionDays.toString());

        if (req.hipaa.phiFields.length > 0) {
          _res.set('X-PHI-Fields', req.hipaa.phiFields.join(','));
        }
      }

      // Log PHI access
      if ((req as unknown as { _hipaaAudit?: () => void })._hipaaAudit) {
        (req as unknown as { _hipaaAudit?: () => void })._hipaaAudit!();
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Verify HIPAA compliance for a request
 */
export function verifyHipaaCompliance(req: HipaaRequest): {
  compliant: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!req.hipaa) {
    issues.push('No HIPAA context attached to request');
    return { compliant: false, issues };
  }

  if (req.hipaa.classification === DataClassification.PHI && !req.hipaa.phiFields.length) {
    issues.push('PHI classification but no PHI fields detected');
  }

  return {
    compliant: issues.length === 0,
    issues,
  };
}

// ============================================================================
// Data Masking Utilities
// ============================================================================

/**
 * Create a mask for a specific field
 */
export function maskField(value: unknown): string {
  if (value === null || value === undefined) {
    return '***NULL***';
  }

  if (typeof value === 'string') {
    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }
    return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
  }

  return '***MASKED***';
}

/**
 * Mask email address
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***@***';

  const maskedLocal =
    local.length <= 2
      ? '*'.repeat(local.length)
      : local[0] + '*'.repeat(local.length - 2) + local[local.length - 1];

  return `${maskedLocal}@${domain}`;
}

/**
 * Mask phone number
 */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***-***-****';
  return `***-***-${digits.slice(-4)}`;
}

// ============================================================================
// Export
// ============================================================================

export default {
  hipaaCompliance,
  hipaaAudit,
  hipaaResponse,
  verifyHipaaCompliance,
  maskSensitiveData,
  maskField,
  maskEmail,
  maskPhone,
  logPhiAccess,
  getAuditLogsForCorrelation,
  getPhiAccessLogs,
  exportAuditLogs,
  DataClassification,
  PHI_PATTERNS,
  SENSITIVE_FIELDS,
  PHI_INDICATOR_FIELDS,
};
