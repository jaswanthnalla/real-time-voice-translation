import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../shared/errors';
import { createLogger } from '../../utils/logger';
import config from '../../config';

const logger = createLogger('error-handler');

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    logger.warn(`${err.code}: ${err.message}`, { statusCode: err.statusCode });
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(config.server.isProduction ? {} : { stack: err.stack }),
      },
    });
    return;
  }

  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: config.server.isProduction ? 'Internal server error' : err.message,
    },
  });
}
