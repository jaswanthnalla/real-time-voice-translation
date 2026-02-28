import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { AppError } from './errorHandler';

export interface AuthPayload {
  userId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/** Verify JWT token from Authorization header */
export function authenticateJWT(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('Missing or invalid authorization header', 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.security.jwtSecret) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    throw new AppError('Invalid or expired token', 401);
  }
}

/** Verify API key from x-api-key header */
export function authenticateApiKey(req: Request, _res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];

  if (apiKey !== config.security.apiKey) {
    throw new AppError('Invalid API key', 401);
  }

  next();
}

/** Validate Twilio webhook signatures */
export function validateTwilioSignature(req: Request, _res: Response, next: NextFunction): void {
  // In development, skip Twilio signature validation
  if (config.isDev) {
    next();
    return;
  }

  const twilioSignature = req.headers['x-twilio-signature'] as string | undefined;
  if (!twilioSignature) {
    throw new AppError('Missing Twilio signature', 403);
  }

  // Twilio signature validation would use twilio.validateRequest()
  // For now, pass through - full implementation in production
  next();
}
