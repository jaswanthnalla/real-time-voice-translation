import http from 'http';
import { app } from './app';
import { config } from '../config';
import { logger } from '../utils/logger';
import { setupWebSocketServer } from './websocket';

const server = http.createServer(app);

setupWebSocketServer(server);

function shutdown(signal: string): void {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

server.listen(config.port, config.host, () => {
  logger.info(`Server running on http://${config.host}:${config.port}`);
  logger.info(`Environment: ${config.env}`);
});

export { server };
