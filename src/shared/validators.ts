import Joi from 'joi';
import { SUPPORTED_LANGUAGES } from './language-codes';

const languageCodes = Object.keys(SUPPORTED_LANGUAGES);

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(128).required(),
});

export const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).max(128).required(),
  name: Joi.string().min(1).max(255).required(),
});

export const languageCodeSchema = Joi.string()
  .valid(...languageCodes)
  .messages({ 'any.only': `Language must be one of: ${languageCodes.join(', ')}` });

export const callInitiateSchema = Joi.object({
  type: Joi.string().valid('twilio', 'webrtc').required(),
  targetNumber: Joi.string().pattern(/^\+[1-9]\d{1,14}$/).when('type', {
    is: 'twilio',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  roomId: Joi.string().uuid().when('type', {
    is: 'webrtc',
    then: Joi.optional(),
    otherwise: Joi.forbidden(),
  }),
  preferredLanguage: languageCodeSchema.optional(),
});

export const translateTextSchema = Joi.object({
  text: Joi.string().min(1).max(5000).required(),
  sourceLanguage: languageCodeSchema.required(),
  targetLanguage: languageCodeSchema.required(),
});

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export function validate<T>(schema: Joi.ObjectSchema, data: unknown): { value: T; error?: string } {
  const { value, error } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) {
    const message = error.details.map((d) => d.message).join('; ');
    return { value: value as T, error: message };
  }
  return { value: value as T };
}
