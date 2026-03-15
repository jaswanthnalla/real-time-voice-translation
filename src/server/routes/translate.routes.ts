import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { freeTranslation } from '../services/free-translation.service';
import { validate } from '../middleware/validation.middleware';
import { SUPPORTED_LANGUAGES } from '../../shared/constants';
import { ApiResponse } from '../../types';

const router = Router();

const languageCodes = Object.keys(SUPPORTED_LANGUAGES);

const translateSchema = Joi.object({
  text: Joi.string().min(1).max(5000).required(),
  sourceLang: Joi.string().valid(...languageCodes).required(),
  targetLang: Joi.string().valid(...languageCodes).required(),
  sessionId: Joi.string().optional(),
});

/**
 * @swagger
 * /api/translate:
 *   post:
 *     summary: Translate text between languages
 *     tags: [Translation]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TranslationRequest'
 *     responses:
 *       200:
 *         description: Translation result
 */
router.post(
  '/translate',
  validate(translateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { text, sourceLang, targetLang } = req.body;
      const result = await freeTranslation.translate(text, sourceLang, targetLang);

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
