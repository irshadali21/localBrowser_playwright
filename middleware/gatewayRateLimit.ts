/**
 * Rate Limiting Middleware
 * Implements sliding window rate limiting with global and per-command limits
 */

import { Request, Response, NextFunction } from 'express';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Window size in milliseconds
  maxRequests: number; // Maximum requests per window
}

/**
 * Per-command rate limit configuration
 */
export interface PerCommandRateLimit {
  [command: string]: number; // max requests per minute
}

/**
 * Rate limit entry for sliding window
 */
interface RateLimitEntry {
  count: number;
  windowStart: number;
  requests: number[]; // Timestamps of requests
}

/**
 * Extended Express Request with rate limit info
 */
export interface RateLimitedRequest extends Request {
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: number;
    tier: string;
  };
  clientId?: string; // For client-specific rate limiting
}

// ============================================================================
// Rate Limit Configuration
// ============================================================================

/**
 * Global rate limit: 100 requests per minute
 */
export const GLOBAL_RATE_LIMIT: RateLimitConfig = {
  windowMs: 60000, // 1 minute
  maxRequests: 100,
};

/**
 * Per-command rate limits (requests per minute)
 */
export const PER_COMMAND_RATE_LIMITS: PerCommandRateLimit = {
  // Browser commands
  'browser.visit': 60,
  'browser.execute': 30,
  'browser.screenshot': 30,
  'browser.navigate': 60,
  'browser.evaluate': 30,

  // Chat commands
  'chat.message': 50,
  'chat.conversation': 30,
  'chat.history': 30,
  'chat.clear': 10,

  // IAAPA commands
  'iaapa.search': 30,
  'iaapa.filter': 30,
  'iaapa.export': 10,
  'iaapa.import': 10,

  // Internal commands
  'internal.health': 120,
  'internal.metrics': 60,
  'internal.config': 20,
  'internal.worker': 30,

  // Job commands
  'job.create': 30,
  'job.status': 60,
  'job.cancel': 20,
  'job.list': 60,

  // Page commands
  'page.create': 30,
  'page.read': 60,
  'page.update': 30,
  'page.delete': 10,

  // Cron commands
  'cron.schedule': 20,
  'cron.unschedule': 20,
  'cron.list': 60,
  'cron.trigger': 10,

  // Cleanup commands
  'cleanup.logs': 10,
  'cleanup.cache': 10,
  'cleanup.temp': 10,
  'cleanup.sessions': 20,

  // Error commands
  'error.report': 30,
  'error.status': 60,
  'error.history': 30,
  'error.resolve': 20,
};

// ============================================================================
// Rate Limit Storage (In-memory, use Redis in production)
// ============================================================================

// Global rate limit storage by IP
const globalRateLimitStore: Map<string, RateLimitEntry> = new Map();

// Per-command rate limit storage by IP + command
const perCommandRateLimitStore: Map<string, RateLimitEntry> = new Map();

// Client-specific rate limit storage (for API key based limiting)
const _clientRateLimitStore: Map<string, RateLimitEntry> = new Map();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get client identifier from request (IP + API key if present)
 */
function getClientId(req: RateLimitedRequest): string {
  // Check for API key
  const apiKeyId = (req as { apiKeyId?: string }).apiKeyId;
  if (apiKeyId) {
    return `apikey:${apiKeyId}`;
  }

  // Fall back to IP
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

/**
 * Get current timestamp
 */
function now(): number {
  return Date.now();
}

/**
 * Calculate sliding window count
 * Uses a sliding window log algorithm for accurate rate limiting
 */
function getSlidingWindowCount(
  store: Map<string, RateLimitEntry>,
  key: string,
  windowMs: number
): { count: number; requests: number[] } {
  const currentTime = now();
  const entry = store.get(key);

  if (!entry) {
    return { count: 0, requests: [] };
  }

  // Remove old entries outside the window
  const cutoff = currentTime - windowMs;
  entry.requests = entry.requests.filter(t => t > cutoff);

  // Update storage
  if (entry.requests.length === 0) {
    store.delete(key);
    return { count: 0, requests: [] };
  }

  store.set(key, entry);
  return { count: entry.requests.length, requests: entry.requests };
}

/**
 * Record a request in the sliding window
 */
function recordRequest(store: Map<string, RateLimitEntry>, key: string, windowMs: number): void {
  const currentTime = now();
  let entry = store.get(key);

  if (!entry) {
    entry = {
      count: 0,
      windowStart: currentTime,
      requests: [],
    };
  }

  // Remove old entries
  const cutoff = currentTime - windowMs;
  entry.requests = entry.requests.filter(t => t > cutoff);

  // Add new request
  entry.requests.push(currentTime);

  store.set(key, entry);
}

/**
 * Reset rate limit for a key
 */
function resetRateLimit(store: Map<string, RateLimitEntry>, key: string): void {
  store.delete(key);
}

// ============================================================================
// Middleware Implementation
// ============================================================================

/**
 * Global Rate Limit Middleware
 * Applies to all requests regardless of command
 */
export function rateLimitGlobal(options?: Partial<RateLimitConfig>) {
  const config = { ...GLOBAL_RATE_LIMIT, ...options };

  return (req: RateLimitedRequest, _res: Response, next: NextFunction): void => {
    const clientId = getClientId(req);
    const key = `global:${clientId}`;

    // Get current count
    const { count, requests } = getSlidingWindowCount(globalRateLimitStore, key, config.windowMs);

    // Calculate remaining requests
    const remaining = Math.max(0, config.maxRequests - count);

    // Calculate reset time
    const oldestRequest = requests.length > 0 ? Math.min(...requests) : now();
    const reset = Math.ceil((oldestRequest + config.windowMs) / 1000);

    // Attach rate limit info to request
    req.rateLimit = {
      limit: config.maxRequests,
      remaining,
      reset,
      tier: 'global',
    };

    // Check if over limit
    if (count >= config.maxRequests) {
      console.warn(`[RateLimit] Global rate limit exceeded for ${clientId}`);

      _res.set('X-RateLimit-Limit', config.maxRequests.toString());
      _res.set('X-RateLimit-Remaining', '0');
      _res.set('X-RateLimit-Reset', reset.toString());
      _res.set('Retry-After', Math.ceil(config.windowMs / 1000).toString());

      _res.status(429).json({
        success: false,
        error: {
          code: 'ERR_RATE_LIMIT_EXCEEDED',
          message: 'Global rate limit exceeded',
          details: {
            limit: config.maxRequests,
            windowMs: config.windowMs,
            retryAfter: Math.ceil(config.windowMs / 1000),
          },
        },
      });
      return;
    }

    // Record the request
    recordRequest(globalRateLimitStore, key, config.windowMs);

    next();
  };
}

/**
 * Per-Command Rate Limit Middleware
 * Applies specific limits based on command ID
 */
export function rateLimitPerCommand(options?: { maxRequests?: number }) {
  return (req: RateLimitedRequest, _res: Response, next: NextFunction): void => {
    const commandId = (req as { commandId?: string }).commandId || 'unknown';
    const clientId = getClientId(req);
    const key = `command:${clientId}:${commandId}`;

    // Get limit for this command
    const maxRequests = options?.maxRequests ?? PER_COMMAND_RATE_LIMITS[commandId] ?? 30;

    // Get current count
    const { count, requests } = getSlidingWindowCount(
      perCommandRateLimitStore,
      key,
      GLOBAL_RATE_LIMIT.windowMs
    );

    // Calculate remaining requests
    const remaining = Math.max(0, maxRequests - count);

    // Calculate reset time
    const oldestRequest = requests.length > 0 ? Math.min(...requests) : now();
    const reset = Math.ceil((oldestRequest + GLOBAL_RATE_LIMIT.windowMs) / 1000);

    // Update rate limit info
    if (req.rateLimit) {
      req.rateLimit.limit = maxRequests;
      req.rateLimit.remaining = remaining;
      req.rateLimit.reset = reset;
      req.rateLimit.tier = 'per-command';
    }

    // Check if over limit
    if (count >= maxRequests) {
      console.warn(`[RateLimit] Command rate limit exceeded for ${clientId} on ${commandId}`);

      _res.set('X-RateLimit-Limit', maxRequests.toString());
      _res.set('X-RateLimit-Remaining', '0');
      _res.set('X-RateLimit-Reset', reset.toString());
      _res.set('Retry-After', Math.ceil(GLOBAL_RATE_LIMIT.windowMs / 1000).toString());

      _res.status(429).json({
        success: false,
        error: {
          code: 'ERR_COMMAND_RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded for command: ${commandId}`,
          details: {
            commandId,
            limit: maxRequests,
            windowMs: GLOBAL_RATE_LIMIT.windowMs,
            retryAfter: Math.ceil(GLOBAL_RATE_LIMIT.windowMs / 1000),
          },
        },
      });
      return;
    }

    // Record the request
    recordRequest(perCommandRateLimitStore, key, GLOBAL_RATE_LIMIT.windowMs);

    next();
  };
}

/**
 * Combined Rate Limit Middleware
 * Applies both global and per-command limits
 */
export function rateLimit(options?: {
  global?: Partial<RateLimitConfig>;
  perCommand?: { maxRequests?: number };
}) {
  return [rateLimitGlobal(options?.global), rateLimitPerCommand(options?.perCommand)];
}

/**
 * IP-based Rate Limit Middleware (simple version)
 * For endpoints that don't have command ID yet
 */
export function rateLimitIp(options?: Partial<RateLimitConfig>) {
  const config = { ...GLOBAL_RATE_LIMIT, ...options };

  return (req: RateLimitedRequest, _res: Response, next: NextFunction): void => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const key = `ip:${ip}`;

    // Get current count
    const { count, requests } = getSlidingWindowCount(globalRateLimitStore, key, config.windowMs);

    // Calculate reset time
    const oldestRequest = requests.length > 0 ? Math.min(...requests) : now();
    const reset = Math.ceil((oldestRequest + config.windowMs) / 1000);

    // Check if over limit
    if (count >= config.maxRequests) {
      _res.set('X-RateLimit-Limit', config.maxRequests.toString());
      _res.set('X-RateLimit-Remaining', '0');
      _res.set('X-RateLimit-Reset', reset.toString());

      _res.status(429).json({
        success: false,
        error: {
          code: 'ERR_RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded',
        },
      });
      return;
    }

    // Record the request
    recordRequest(globalRateLimitStore, key, config.windowMs);

    next();
  };
}

/**
 * Strict Rate Limit Middleware
 * For sensitive operations with lower limits
 */
export function rateLimitStrict(maxRequests: number = 10, windowMs: number = 60000) {
  const config: RateLimitConfig = { windowMs, maxRequests };

  return (req: RateLimitedRequest, _res: Response, next: NextFunction): void => {
    const clientId = getClientId(req);
    const key = `strict:${clientId}`;

    // Get current count
    const { count, requests } = getSlidingWindowCount(globalRateLimitStore, key, config.windowMs);

    // Calculate reset time
    const oldestRequest = requests.length > 0 ? Math.min(...requests) : now();
    const reset = Math.ceil((oldestRequest + config.windowMs) / 1000);

    // Check if over limit
    if (count >= config.maxRequests) {
      console.warn(`[RateLimit] Strict rate limit exceeded for ${clientId}`);

      _res.set('X-RateLimit-Limit', config.maxRequests.toString());
      _res.set('X-RateLimit-Remaining', '0');
      _res.set('X-RateLimit-Reset', reset.toString());

      _res.status(429).json({
        success: false,
        error: {
          code: 'ERR_STRICT_RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded for sensitive operation',
        },
      });
      return;
    }

    // Record the request
    recordRequest(globalRateLimitStore, key, config.windowMs);

    next();
  };
}

// ============================================================================
// Admin Functions
// ============================================================================

/**
 * Get current rate limit status for a client
 */
export function getRateLimitStatus(clientId: string): {
  global: { count: number; limit: number; remaining: number };
  perCommand: Record<string, { count: number; limit: number }>;
} {
  const globalKey = `global:${clientId}`;
  const { count: globalCount } = getSlidingWindowCount(
    globalRateLimitStore,
    globalKey,
    GLOBAL_RATE_LIMIT.windowMs
  );

  const perCommand: Record<string, { count: number; limit: number }> = {};

  // Note: In production, you'd iterate over actual keys
  return {
    global: {
      count: globalCount,
      limit: GLOBAL_RATE_LIMIT.maxRequests,
      remaining: Math.max(0, GLOBAL_RATE_LIMIT.maxRequests - globalCount),
    },
    perCommand,
  };
}

/**
 * Reset rate limit for a client
 */
export function resetClientRateLimit(clientId: string): void {
  resetRateLimit(globalRateLimitStore, `global:${clientId}`);
  resetRateLimit(globalRateLimitStore, `ip:${clientId.replace('apikey:', '')}`);
}

/**
 * Get rate limit configuration
 */
export function getRateLimitConfig(): {
  global: RateLimitConfig;
  perCommand: PerCommandRateLimit;
} {
  return {
    global: GLOBAL_RATE_LIMIT,
    perCommand: PER_COMMAND_RATE_LIMITS,
  };
}

// ============================================================================
// Export
// ============================================================================

export default {
  rateLimitGlobal,
  rateLimitPerCommand,
  rateLimit,
  rateLimitIp,
  rateLimitStrict,
  getRateLimitStatus,
  resetClientRateLimit,
  getRateLimitConfig,
  GLOBAL_RATE_LIMIT,
  PER_COMMAND_RATE_LIMITS,
};
