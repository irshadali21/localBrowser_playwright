/**
 * Page Routes - TypeScript migration
 */

import { Router } from 'express';
import pageController from '../controllers/pageController';

const router = Router();

// GET /pages
router.get('/', pageController.list);

// POST /pages/request
router.post('/request', pageController.request);

// POST /pages/close
router.post('/close', pageController.close);

export = router;
