/**
 * Cron Routes - TypeScript migration
 */

import { Router } from 'express';
import cronController from '../controllers/cronController';

const router = Router();

// POST /cron/cleanup-pages
router.post('/cleanup-pages', cronController.cleanupPages);

// GET /cron/stats
router.get('/stats', cronController.getPageStats);

export = router;
