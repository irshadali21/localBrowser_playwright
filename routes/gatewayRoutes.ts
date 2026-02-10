/**
 * Gateway Routes
 * Routes for the Unified API Gateway
 */

import { Router } from 'express';
import gatewayController from '../controllers/gatewayController';

const router = Router();

/**
 * POST /api/v1/gateway
 * Main gateway endpoint for executing commands
 */
router.post('/', gatewayController.handleGatewayCommand);

/**
 * GET /api/v1/gateway/commands
 * List all registered commands
 */
router.get('/commands', gatewayController.getAllCommands);

/**
 * GET /api/v1/gateway/health
 * Health check endpoint
 */
router.get('/health', gatewayController.healthCheck);

/**
 * GET /api/v1/gateway/metrics
 * Metrics endpoint
 */
router.get('/metrics', gatewayController.getMetrics);

export = router;
