import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import path from 'path';

import { config } from '../config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import { healthRouter } from './routes/health';
import { twilioRouter } from './routes/twilio';
import { callsRouter } from './routes/calls';
import logger from '../utils/logger';

const app = express();

// ── Security ──
app.use(helmet({
  contentSecurityPolicy: config.isProd ? undefined : false,
}));
app.use(cors({
  origin: config.isDev ? '*' : [`http://${config.server.host}:${config.server.port}`],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

// ── Body parsing ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Compression ──
app.use(compression());

// ── Request logging ──
app.use(morgan('short', {
  stream: {
    write: (message: string) => logger.info(message.trim(), { service: 'http' }),
  },
}));

// ── Rate limiting ──
app.use('/api/', apiLimiter);

// ── Static files (React frontend) ──
app.use(express.static(path.join(__dirname, '../../dist/client')));

// ── API Routes ──
app.use('/api/health', healthRouter);
app.use('/api/twilio', twilioRouter);
app.use('/api/calls', callsRouter);

// ── SPA fallback - serve React app for non-API routes ──
app.get('*', (_req, res, next) => {
  // Only serve index.html for non-API requests
  if (_req.path.startsWith('/api/')) {
    next();
    return;
  }
  res.sendFile(path.join(__dirname, '../../dist/client/index.html'), (err) => {
    if (err) {
      next();
    }
  });
});

// ── Error handling ──
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
