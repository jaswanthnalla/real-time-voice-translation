import winston from 'winston';
import config from '../config';

const { combine, timestamp, printf, colorize, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  printf(({ timestamp, level, message, service, ...meta }) => {
    const svc = service ? `[${service}]` : '';
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level} ${svc} ${message}${metaStr}`;
  }),
);

const prodFormat = combine(timestamp(), json());

const logger = winston.createLogger({
  level: config.logging.level,
  format: config.server.isProduction ? prodFormat : devFormat,
  defaultMeta: { service: 'voice-translate' },
  transports: [
    new winston.transports.Console(),
  ],
});

if (config.server.isProduction) {
  logger.add(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error', maxsize: 5242880, maxFiles: 5 }),
  );
  logger.add(
    new winston.transports.File({ filename: 'logs/combined.log', maxsize: 5242880, maxFiles: 5 }),
  );
}

export function createLogger(service: string): winston.Logger {
  return logger.child({ service });
}

export default logger;
