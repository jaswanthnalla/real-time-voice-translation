import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { sessionService } from '../services/session.service';
import { validate } from '../middleware/validation.middleware';
import { AppError } from '../middleware/error.middleware';
import { SUPPORTED_LANGUAGES, ERROR_CODES } from '../../shared/constants';
import { ApiResponse } from '../../types';

const router = Router();

const languageCodes = Object.keys(SUPPORTED_LANGUAGES);

const createSessionSchema = Joi.object({
  sourceLang: Joi.string().valid(...languageCodes).required(),
  targetLang: Joi.string().valid(...languageCodes).required(),
  userId: Joi.string().optional(),
  callerNumber: Joi.string().optional(),
  calleeNumber: Joi.string().optional(),
});

/**
 * @swagger
 * /api/sessions:
 *   post:
 *     summary: Create a new translation session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sourceLang, targetLang]
 *             properties:
 *               sourceLang:
 *                 type: string
 *                 example: en
 *               targetLang:
 *                 type: string
 *                 example: es
 *     responses:
 *       201:
 *         description: Session created
 */
router.post(
  '/sessions',
  validate(createSessionSchema),
  (req: Request, res: Response) => {
    const session = sessionService.create(req.body);

    const response: ApiResponse = {
      success: true,
      data: session,
      timestamp: new Date().toISOString(),
    };

    res.status(201).json(response);
  }
);

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     summary: List all sessions
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of sessions
 */
router.get('/sessions', async (_req: Request, res: Response) => {
  const sessions = await sessionService.listFromDb();

  const response: ApiResponse = {
    success: true,
    data: sessions,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
});

/**
 * @swagger
 * /api/sessions/{id}:
 *   get:
 *     summary: Get session by ID
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session details
 *       404:
 *         description: Session not found
 */
router.get(
  '/sessions/:id',
  (req: Request, res: Response, next: NextFunction) => {
    const session = sessionService.get(req.params.id);

    if (!session) {
      next(new AppError(404, ERROR_CODES.SESSION_NOT_FOUND, 'Session not found'));
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: session,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  }
);

/**
 * @swagger
 * /api/sessions/{id}/summary:
 *   get:
 *     summary: Get AI-generated conversation summary
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Conversation summary
 *       404:
 *         description: Summary not found
 */
router.get(
  '/sessions/:id/summary',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await sessionService.getSummary(req.params.id);

      if (!summary) {
        next(new AppError(404, ERROR_CODES.SESSION_NOT_FOUND, 'Summary not found'));
        return;
      }

      const response: ApiResponse = {
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @swagger
 * /api/sessions/{id}:
 *   delete:
 *     summary: Delete a session
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session deleted
 *       404:
 *         description: Session not found
 */
router.delete(
  '/sessions/:id',
  (req: Request, res: Response, next: NextFunction) => {
    const deleted = sessionService.delete(req.params.id);

    if (!deleted) {
      next(new AppError(404, ERROR_CODES.SESSION_NOT_FOUND, 'Session not found'));
      return;
    }

    const response: ApiResponse = {
      success: true,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  }
);

export { router as sessionRoutes };
