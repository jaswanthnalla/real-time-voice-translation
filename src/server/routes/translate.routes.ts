import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { TranslationService } from '../services/translation.service';
import { validate } from '../middleware/validation.middleware';
import { SUPPORTED_LANGUAGES } from '../../shared/constants';
import { ApiResponse } from '../../types';

const router = Router();
const translationService = new TranslationService();

const languageCodes = Object.keys(SUPPORTED_LANGUAGES);

const translateSchema = Joi.object({
  text: Joi.string().min(1).max(5000).required(),
  sourceLang: Joi.string().valid(...languageCodes).required(),
  targetLang: Joi.string().valid(...languageCodes).required(),
  sessionId: Joi.string().optional(),
});

router.post(
  '/translate',
  validate(translateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { text, sourceLang, targetLang } = req.body;
      const result = await translationService.translate(text, sourceLang, targetLang);

      const response: ApiResponse = {
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
);

export { router as translateRoutes };
