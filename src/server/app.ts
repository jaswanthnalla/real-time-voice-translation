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

// Security
app.use(helmet());
app.use(cors({ origin: config.cors.origin }));

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

// Serve static client files in production
if (config.env === 'production') {
  app.use(express.static(path.join(__dirname, '../client')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  });
}

// Error handling (must be last)
app.use(errorHandler);

export { app };
