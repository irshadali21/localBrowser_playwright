/**
 * IAAPA Routes - TypeScript migration
 */

import { Router } from 'express';
import iaapaController from '../controllers/iaapaController';

const router = Router();

// GET /iaapa/run-all?file=iaapaexpo25.json
router.get('/run-all', iaapaController.runAll);

// GET /iaapa/status?id=<jobId>
router.get('/status', iaapaController.status);

// GET /iaapa/download-csv?name=<csvName>
router.get('/download-csv', iaapaController.downloadCsv);

export = router;
