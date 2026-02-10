/**
 * Gateway Routes
 * Routes for the Unified API Gateway
 */

import { Router } from 'express';
import gatewayController from '../controllers/gatewayController';
import { optionalApiKeyAuth } from '../middleware/gatewayAuth';

const router = Router();

/**
 * POST /api/v1/gateway
 * Main gateway endpoint for executing commands
 * Requires API key authentication
 */
router.post('/', gatewayController.handleGatewayCommand);

/**
 * GET /api/v1/gateway/commands
 * List all registered commands
 * Public endpoint - no authentication required
 */
router.get('/commands', optionalApiKeyAuth, gatewayController.getAllCommands);

/**
 * GET /api/v1/gateway/health
 * Health check endpoint
 * Public endpoint - no authentication required
 */
router.get('/health', optionalApiKeyAuth, gatewayController.healthCheck);

/**
 * GET /api/v1/gateway/metrics
 * Metrics endpoint
 * Public endpoint - no authentication required
 */
router.get('/metrics', optionalApiKeyAuth, gatewayController.getMetrics);

/**
 * GET /api/v1/commands
 * Alias for /gateway/commands (lists available commands)
 * Public endpoint - no authentication required
 */
router.get('/commands', optionalApiKeyAuth, gatewayController.getAllCommands);

/**
 * GET /api/v1/health
 * Alias for /gateway/health (health check)
 * Public endpoint - no authentication required
 */
router.get('/health', optionalApiKeyAuth, gatewayController.healthCheck);

export = router;
