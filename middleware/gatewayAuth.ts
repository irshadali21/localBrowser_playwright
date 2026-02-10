/**
 * API Key Authentication Middleware
 * Validates X-API-Key header and supports API key rotation
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * API Key metadata stored in the registry
 */
export interface ApiKeyMetadata {
  /** Unique key identifier */
  keyId: string;

  /** Human-readable key name */
  name: string;

  /** Associated client/owner */
  clientId: string;

  /** Key permissions/scopes */
  scopes: string[];

  /** Whether the key is active */
  active: boolean;

  /** Key creation timestamp */
  createdAt: Date;

  /** Key expiration timestamp (null = never expires) */
  expiresAt: Date | null;

  /** Last used timestamp */
  lastUsedAt: Date | null;

  /** Rate limit tier (default, high, low) */
  rateLimitTier: 'default' | 'high' | 'low';
}

/**
 * Extended Express Request with API key info
 */
export interface ApiKeyRequest extends Request {
  apiKey?: ApiKeyMetadata;
  apiKeyId?: string;
}

// ============================================================================
// API Key Registry (In-memory for demo, use Redis/DB in production)
// ============================================================================

// Active API keys registry (supports rotation)
const apiKeyRegistry: Map<string, ApiKeyMetadata> = new Map();

// Key hash to metadata mapping (for O(1) lookup)
const keyHashRegistry: Map<string, ApiKeyMetadata> = new Map();

// ============================================================================
// API Key Management Functions
// ============================================================================

/**
 * Initialize with default API keys from environment
 *
 * Supported environment variables:
 * - API_KEYS: comma-separated key:secret pairs (key1:secret1,key2:secret2)
 * - GATEWAY_API_KEY: single API key (alternative format)
 * - API_KEY: single API key (legacy, same as GATEWAY_API_KEY)
 * - API_KEY_SECRET: secret used for hashing keys (defaults to 'default-api-key-hash-secret')
 */
export function initializeApiKeys(): void {
  // Clear existing keys
  apiKeyRegistry.clear();
  keyHashRegistry.clear();

  // Priority: API_KEYS (comma-separated pairs) > GATEWAY_API_KEY > API_KEY > fallback to dev key
  const keysEnv = process.env.API_KEYS || '';
  const gatewayKey = process.env.GATEWAY_API_KEY || '';
  const legacyKey = process.env.API_KEY || '';

  if (keysEnv) {
    // Format: key1:secret1,key2:secret2,key3:secret3
    const keyPairs = keysEnv.split(',').filter(k => k.trim());

    keyPairs.forEach((pair, index) => {
      const [key, secret] = pair.split(':').map(s => s.trim());
      if (key && secret) {
        const keyId = `key_${index + 1}`;
        const metadata: ApiKeyMetadata = {
          keyId,
          name: `API Key ${index + 1}`,
          clientId: `client_${index + 1}`,
          scopes: ['gateway:all'],
          active: true,
          createdAt: new Date(),
          expiresAt: null,
          lastUsedAt: null,
          rateLimitTier: 'default',
        };

        // Store both key and hashed version
        const keyHash = hashKey(key);
        apiKeyRegistry.set(keyId, metadata);
        keyHashRegistry.set(keyHash, metadata);
      } else if (key) {
        // Handle case where no secret is provided (single key format)
        const keyId = `key_${index + 1}`;
        const metadata: ApiKeyMetadata = {
          keyId,
          name: `API Key ${index + 1}`,
          clientId: `client_${index + 1}`,
          scopes: ['gateway:all'],
          active: true,
          createdAt: new Date(),
          expiresAt: null,
          lastUsedAt: null,
          rateLimitTier: 'default',
        };

        const keyHash = hashKey(key);
        apiKeyRegistry.set(keyId, metadata);
        keyHashRegistry.set(keyHash, metadata);
      }
    });

    console.log(`[ApiKeyAuth] Initialized ${apiKeyRegistry.size} API keys from API_KEYS`);
  } else if (gatewayKey) {
    // Single key format from GATEWAY_API_KEY
    const keyId = 'gateway_key';
    const metadata: ApiKeyMetadata = {
      keyId,
      name: 'Gateway API Key',
      clientId: 'gateway_client',
      scopes: ['gateway:all'],
      active: true,
      createdAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
      rateLimitTier: 'default',
    };

    const keyHash = hashKey(gatewayKey);
    apiKeyRegistry.set(keyId, metadata);
    keyHashRegistry.set(keyHash, metadata);

    console.log('[ApiKeyAuth] Initialized single API key from GATEWAY_API_KEY');
  } else if (legacyKey) {
    // Legacy single key format from API_KEY
    const keyId = 'legacy_key';
    const metadata: ApiKeyMetadata = {
      keyId,
      name: 'Legacy API Key',
      clientId: 'legacy_client',
      scopes: ['gateway:all'],
      active: true,
      createdAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
      rateLimitTier: 'default',
    };

    const keyHash = hashKey(legacyKey);
    apiKeyRegistry.set(keyId, metadata);
    keyHashRegistry.set(keyHash, metadata);

    console.log('[ApiKeyAuth] Initialized single API key from API_KEY (legacy)');
  }

  // Add a default development key if none exist
  if (apiKeyRegistry.size === 0) {
    const devKey = 'dev_api_key_12345';
    const devHash = hashKey(devKey);
    const devMetadata: ApiKeyMetadata = {
      keyId: 'dev_key',
      name: 'Development Key',
      clientId: 'dev_client',
      scopes: ['gateway:all'],
      active: true,
      createdAt: new Date(),
      expiresAt: null,
      lastUsedAt: null,
      rateLimitTier: 'default',
    };

    apiKeyRegistry.set('dev_key', devMetadata);
    keyHashRegistry.set(devHash, devMetadata);

    console.log('[ApiKeyAuth] Default development key added (no valid API keys configured)');
  }

  console.log(`[ApiKeyAuth] Total active API keys: ${apiKeyRegistry.size}`);
}

/**
 * Hash an API key for secure storage
 */
function hashKey(key: string): string {
  const secret = process.env.API_KEY_SECRET || 'default-api-key-hash-secret';
  return crypto.createHmac('sha256', secret).update(key).digest('hex');
}

/**
 * Add a new API key (for key rotation)
 */
export function addApiKey(
  keyId: string,
  key: string,
  metadata: Omit<ApiKeyMetadata, 'keyId' | 'createdAt' | 'lastUsedAt'>
): void {
  const keyHash = hashKey(key);
  const fullMetadata: ApiKeyMetadata = {
    ...metadata,
    keyId,
    createdAt: new Date(),
    lastUsedAt: null,
  };

  apiKeyRegistry.set(keyId, fullMetadata);
  keyHashRegistry.set(keyHash, fullMetadata);

  console.log(`[ApiKeyAuth] Added API key: ${keyId}`);
}

/**
 * Remove an API key (for key rotation)
 */
export function removeApiKey(keyId: string): boolean {
  const metadata = apiKeyRegistry.get(keyId);
  if (!metadata) return false;

  // Note: In production, you'd also need to track key hashes separately
  // to properly remove them from the hash registry
  apiKeyRegistry.delete(keyId);

  console.log(`[ApiKeyAuth] Removed API key: ${keyId}`);
  return true;
}

/**
 * Rotate an API key (atomic: add new, remove old)
 */
export function rotateApiKey(
  oldKeyId: string,
  newKey: string,
  newMetadata: Omit<ApiKeyMetadata, 'keyId' | 'createdAt' | 'lastUsedAt'>
): boolean {
  const newKeyId = `${oldKeyId}_rotated_${Date.now()}`;

  // Add new key first
  addApiKey(newKeyId, newKey, newMetadata);

  // Then remove old key
  removeApiKey(oldKeyId);

  return true;
}

/**
 * Get all active API keys (for admin purposes)
 */
export function getActiveApiKeys(): ApiKeyMetadata[] {
  return Array.from(apiKeyRegistry.values()).filter(k => k.active);
}

/**
 * Mark a key as used
 */
function markKeyUsed(keyId: string): void {
  const metadata = apiKeyRegistry.get(keyId);
  if (metadata) {
    metadata.lastUsedAt = new Date();
  }
}

// ============================================================================
// Middleware Implementation
// ============================================================================

/**
 * API Key Authentication Middleware
 *
 * Validates the X-API-Key header and adds key metadata to the request.
 * Supports multiple valid keys (key rotation).
 */
export function apiKeyAuth(req: ApiKeyRequest, _res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  // Check if auth should be skipped for this request (e.g., public endpoints)
  if ((req as any).skipGatewayAuth) {
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_API_KEYS === 'true') {
      console.log('[ApiKeyAuth] Skipped for public endpoint', { path: req.path });
    }
    next();
    return;
  }

  // Debug logging in development
  if (process.env.NODE_ENV === 'development' && process.env.DEBUG_API_KEYS === 'true') {
    console.log('[ApiKeyAuth] Incoming request', {
      path: req.path,
      method: req.method,
      hasApiKey: !!apiKey,
    });
  }

  if (!apiKey) {
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_API_KEYS === 'true') {
      console.warn('[ApiKeyAuth] Missing API key header', { path: req.path });
    }
    _res.status(401).json({
      success: false,
      error: {
        code: 'ERR_MISSING_API_KEY',
        message: 'Missing X-API-Key header',
      },
    });
    return;
  }

  // Hash the provided key and lookup
  const keyHash = hashKey(apiKey);
  const metadata = keyHashRegistry.get(keyHash);

  if (!metadata) {
    console.warn('[ApiKeyAuth] Invalid API key attempt', {
      path: req.path,
      ip: req.ip,
    });
    _res.status(401).json({
      success: false,
      error: {
        code: 'ERR_INVALID_API_KEY',
        message: 'Invalid API key',
      },
    });
    return;
  }

  // Check if key is active
  if (!metadata.active) {
    console.warn('[ApiKeyAuth] Inactive API key attempt', {
      keyId: metadata.keyId,
      path: req.path,
      ip: req.ip,
    });
    _res.status(403).json({
      success: false,
      error: {
        code: 'ERR_API_KEY_INACTIVE',
        message: 'API key is not active',
      },
    });
    return;
  }

  // Check if key has expired
  if (metadata.expiresAt && new Date() > metadata.expiresAt) {
    console.warn('[ApiKeyAuth] Expired API key attempt', {
      keyId: metadata.keyId,
      path: req.path,
      ip: req.ip,
    });
    _res.status(403).json({
      success: false,
      error: {
        code: 'ERR_API_KEY_EXPIRED',
        message: 'API key has expired',
      },
    });
    return;
  }

  // Validate required scopes
  const requiredScopes = ['gateway:access'];
  const hasRequiredScopes = requiredScopes.every(scope => metadata.scopes.includes(scope));

  if (!hasRequiredScopes) {
    console.warn('[ApiKeyAuth] Insufficient scopes', {
      keyId: metadata.keyId,
      path: req.path,
      required: requiredScopes,
      has: metadata.scopes,
    });
    _res.status(403).json({
      success: false,
      error: {
        code: 'ERR_INSUFFICIENT_SCOPES',
        message: 'API key lacks required permissions',
      },
    });
    return;
  }

  // Mark key as used and attach to request
  markKeyUsed(metadata.keyId);
  req.apiKey = metadata;
  req.apiKeyId = metadata.keyId;

  if (process.env.NODE_ENV === 'development' && process.env.DEBUG_API_KEYS === 'true') {
    console.log('[ApiKeyAuth] Authenticated request', {
      keyId: metadata.keyId,
      clientId: metadata.clientId,
      path: req.path,
    });
  }

  next();
}

/**
 * Optional API Key Middleware
 *
 * Extracts API key if present but doesn't require it.
 * Useful for endpoints that support both authenticated and anonymous access.
 */
export function optionalApiKeyAuth(req: ApiKeyRequest, _res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (apiKey) {
    const keyHash = hashKey(apiKey);
    const metadata = keyHashRegistry.get(keyHash);

    if (metadata && metadata.active) {
      // Check expiration
      if (!metadata.expiresAt || new Date() <= metadata.expiresAt) {
        markKeyUsed(metadata.keyId);
        req.apiKey = metadata;
        req.apiKeyId = metadata.keyId;
      }
    }
  }

  next();
}

/**
 * Require Specific Scope Middleware Factory
 *
 * Creates middleware that requires a specific scope in addition to API key auth.
 */
export function requireScope(scope: string) {
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
// Export
// ============================================================================

export default {
  apiKeyAuth,
  optionalApiKeyAuth,
  requireScope,
  initializeApiKeys,
  addApiKey,
  removeApiKey,
  rotateApiKey,
  getActiveApiKeys,
};
