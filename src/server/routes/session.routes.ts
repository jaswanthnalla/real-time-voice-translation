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

router.get('/sessions', (_req: Request, res: Response) => {
  const sessions = sessionService.list();

  const response: ApiResponse = {
    success: true,
    data: sessions,
    timestamp: new Date().toISOString(),
  };

  res.json(response);
});

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
