import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, json, errors, colorize, simple } = winston.format;

const logger = winston.createLogger({
  level: config.logging.level,
  defaultMeta: { service: 'voice-translation' },
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    json()
  ),
  transports: [
    new winston.transports.Console({
      format: config.env === 'development'
        ? combine(colorize(), simple())
        : combine(timestamp(), json()),
    }),
  ],
});

export { logger };
