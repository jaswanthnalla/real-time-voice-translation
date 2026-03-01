import rateLimit from 'express-rate-limit';
import config from '../../config';

export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_ERROR',
      message: 'Too many requests, please try again later.',
    },
  },
});

export const webhookLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
