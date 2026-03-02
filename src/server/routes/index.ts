import { Router } from 'express';
import { healthRoutes } from './health.routes';
import { webhookRoutes } from './webhook.routes';
import { sessionRoutes } from './session.routes';
import { translateRoutes } from './translate.routes';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Public routes (no auth)
router.use(healthRoutes);
router.use('/api', webhookRoutes);

// Authenticated routes
router.use('/api', authMiddleware, sessionRoutes);
router.use('/api', authMiddleware, translateRoutes);

export { router as routes };
