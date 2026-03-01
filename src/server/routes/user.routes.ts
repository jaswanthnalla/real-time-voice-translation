import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticateJWT, requireAuth } from '../middleware/auth';

const router = Router();

router.get('/me', authenticateJWT, requireAuth, userController.getProfile);
router.put('/me', authenticateJWT, requireAuth, userController.updateProfile);

export default router;
