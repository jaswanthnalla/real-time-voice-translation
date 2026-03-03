import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
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

// Add file transports for non-test environments
if (config.env !== 'test') {
  // General application logs
  logger.add(new DailyRotateFile({
    filename: 'logs/app-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    format: combine(timestamp(), json()),
  }));

  // Error-only logs
  logger.add(new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    level: 'error',
    format: combine(timestamp(), json()),
  }));
}

export { logger };
