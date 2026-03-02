import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config';
import { AppError } from './error.middleware';
import { ERROR_CODES } from '../../shared/constants';

export interface AuthRequest extends Request {
  userId?: string;
}

export function authMiddleware(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'] as string | undefined;

  // Allow API key auth
  if (apiKey && config.apiKey && apiKey === config.apiKey) {
    next();
    return;
  }

  if (!authHeader?.startsWith('Bearer ')) {
    next(
      new AppError(401, ERROR_CODES.AUTHENTICATION_ERROR, 'Missing or invalid authorization header')
    );
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch {
    next(
      new AppError(401, ERROR_CODES.AUTHENTICATION_ERROR, 'Invalid or expired token')
    );
  }
}
