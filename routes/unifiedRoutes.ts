/**
 * Unified Routes
 * Central route file that mounts the Unified API Gateway at /api/v1
 * All legacy routes have been migrated to the gateway command system
 */

import { Router, Request, Response, NextFunction } from 'express';
import gatewayRoutes from './gatewayRoutes';
import {
  createGatewayMiddlewareStack,
  gatewayErrorHandler,
  notFoundHandler,
} from '../middleware/gatewayMiddleware';
import { optionalApiKeyAuth } from '../middleware/gatewayAuth';

const router = Router();

// ============================================================================
// Public endpoints that don't require authentication
// ============================================================================

/**
 * Public endpoint check middleware
 * Skips auth for GET requests to public endpoints
 */
function skipAuthForPublicEndpoints(req: Request, _res: Response, next: NextFunction): void {
  const isGetRequest = req.method === 'GET';
  const isPublicEndpoint = [
    '/api/v1/commands',
    '/api/v1/health',
    '/api/v1/metrics',
    '/api/v1/gateway/commands',
    '/api/v1/gateway/health',
    '/api/v1/gateway/metrics',
  ].includes(req.path);

  if (isGetRequest && isPublicEndpoint) {
    // Skip auth middleware by calling next() directly
    // The gateway middleware stack will check this flag
    (req as any).skipGatewayAuth = true;
  }

  next();
}

// Apply skip auth check before gateway middleware
router.use(skipAuthForPublicEndpoints);

// ============================================================================
// Gateway Middleware Stack
// ============================================================================

// Apply gateway middleware to all /api/v1 routes
router.use(
  '/api/v1',
  createGatewayMiddlewareStack({
    skipAuth: false,
    skipRateLimit: false,
    skipValidation: false,
    skipHipaa: true, // Enable HIPAA only for sensitive endpoints
    skipLogging: false,
  })
);

// ============================================================================
// Gateway Routes (Unified API Gateway)
// ============================================================================

/**
 * Mount gateway routes at /api/v1
 * All API requests are now routed through the unified gateway
 */
router.use('/api/v1', gatewayRoutes);

// ============================================================================
// Health Check Routes (Outside gateway middleware for reliability)
// ============================================================================

/**
 * GET /health
 * Simple health check endpoint (no auth required)
 */
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'localBrowser-api',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
  });
});

/**
 * GET /ready
 * Readiness check (includes dependency checks)
 */
router.get('/ready', (req, res) => {
  // Add dependency checks here (database, etc.)
  res.json({
    status: 'ready',
    service: 'localBrowser-api',
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Legacy Route Deprecation Notice
// ============================================================================

// Legacy routes have been migrated to the gateway command system.
// Access legacy functionality through gateway commands:
// - Browser commands: POST /api/v1 { command: 'browser.*' }
// - Chat commands: POST /api/v1 { command: 'chat.*' }
// - Job commands: POST /api/v1 { command: 'job.*' }
// - Page commands: POST /api/v1 { command: 'page.*' }
// - Cleanup commands: POST /api/v1 { command: 'cleanup.*' }
// - Cron commands: POST /api/v1 { command: 'cron.*' }
// - Error commands: POST /api/v1 { command: 'error.*' }
// - IAAPA commands: POST /api/v1 { command: 'iaapa.*' }
// - Internal commands: POST /api/v1 { command: 'internal.*' }

// ============================================================================
// API Documentation Endpoint
// ============================================================================

/**
 * GET /api-docs
 * Redirect to API documentation
 */
router.get('/api-docs', (req, res) => {
  res.json({
    message: 'API Documentation available at /docs/api-gateway-openapi.yaml',
    commands: '/api/v1/commands',
    health: '/health',
  });
});

// ============================================================================
// Error Handling for Unified Routes
// ============================================================================

router.use('/api/v1', gatewayErrorHandler);
router.use('/api/v1', notFoundHandler);

export = router;
