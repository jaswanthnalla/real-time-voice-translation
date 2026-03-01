import morgan from 'morgan';
import { createLogger } from '../../utils/logger';
import config from '../../config';

const logger = createLogger('http');

const stream = {
  write: (message: string) => {
    logger.info(message.trim());
  },
};

export const requestLogger = morgan(
  config.server.isProduction ? 'combined' : 'dev',
  { stream },
);
