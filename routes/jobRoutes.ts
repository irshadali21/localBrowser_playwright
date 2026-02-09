/**
 * Job Routes - TypeScript migration
 */

import { Router } from 'express';
import jobController from '../controllers/jobController';

const router = Router();

// POST /jobs
router.post('/', jobController.create);

export = router;
