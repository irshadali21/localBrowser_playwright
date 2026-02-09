/**
 * Chat Routes - TypeScript migration
 */

import { Router } from 'express';
import chatController from '../controllers/chatController';

const router = Router();

// POST /chat/prepare
router.post('/prepare', chatController.prepare);

// POST /chat/message
router.post('/message', chatController.message);

// POST /chat/messageGPT
router.post('/messageGPT', chatController.messageGPT);

export = router;
