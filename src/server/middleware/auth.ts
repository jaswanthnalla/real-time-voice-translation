import { Request, Response, NextFunction } from 'express';
import { verifyJWT } from '../../utils/crypto';
import { AuthenticationError } from '../../shared/errors';

export interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string };
}

export function authenticateJWT(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AuthenticationError('No token provided'));
  }

  const token = authHeader.substring(7);

  try {
    const payload = verifyJWT(token);
    req.user = { userId: payload.userId, email: payload.email };
    next();
  } catch {
    next(new AuthenticationError('Invalid or expired token'));
  }
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(new AuthenticationError('Authentication required'));
  }
  next();
}
