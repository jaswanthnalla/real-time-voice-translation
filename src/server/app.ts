import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from '../config';
import { errorHandler } from './middleware/error.middleware';
import { routes } from './routes';

const app = express();

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
  app.use(morgan('combined'));
}

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

// Error handling (must be last)
app.use(errorHandler);

export { app };
