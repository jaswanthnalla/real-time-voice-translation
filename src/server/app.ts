import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { config } from '../config';
import { errorHandler } from './middleware/error.middleware';
import { correlationMiddleware } from './middleware/correlation.middleware';
import { routes } from './routes';
import { swaggerSpec } from './swagger';

const app = express();

// Correlation IDs for request tracing
app.use(correlationMiddleware);

// Security — allow inline scripts/styles for React and speech APIs
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
// Sanitize CORS origin — strip quotes, whitespace, and invalid chars
const rawOrigin = config.cors.origin.trim().replace(/^["']|["']$/g, '');
const corsOrigin = rawOrigin && /^https?:\/\//.test(rawOrigin) ? rawOrigin : true;
app.use(cors({ origin: corsOrigin }));

// Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Compression
app.use(compression());

// Request logging
if (config.env !== 'test') {
  app.use(morgan(':method :url :status :response-time ms - :req[x-correlation-id]'));
}

// API documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Voice Translation API Docs',
}));

// Rate limiting
app.use(
  '/api/',
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Routes
app.use(routes);

// Serve static client files
const clientDir = path.join(__dirname, '../client');
// JS/CSS have content hashes — cache forever. HTML must never be cached
// so the browser always gets the latest index.html pointing to new bundles.
app.use(express.static(clientDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(path.join(clientDir, 'index.html'));
});

// Error handling (must be last)
app.use(errorHandler);

export { app };
