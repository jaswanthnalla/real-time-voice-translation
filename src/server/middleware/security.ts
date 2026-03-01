import helmet from 'helmet';
import compression from 'compression';
import { RequestHandler } from 'express';

export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
});

export const compressionMiddleware: RequestHandler = compression();
