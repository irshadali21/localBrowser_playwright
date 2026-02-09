/**
 * Cleanup Routes - TypeScript migration
 */

import { Router } from 'express';
import cleanupController from '../controllers/cleanupController';

const router = Router();

// POST /cleanup
router.post('/', cleanupController.cleanup);

// GET /cleanup/stats
router.get('/stats', cleanupController.stats);

export = router;
