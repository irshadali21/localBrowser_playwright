/**
 * Error Routes - TypeScript migration
 */

import { Router } from 'express';
import errorController from '../controllers/errorController';

const router = Router();

// POST /error/report
router.post('/report', errorController.reportError);

export = router;
