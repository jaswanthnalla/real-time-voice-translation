import http from 'http';
import { config } from '../config';
import app from './app';
import { createTwilioWSServer, createSocketIOServer } from './websocket';
import logger from '../utils/logger';

const log = logger.child({ service: 'server' });

async function startServer(): Promise<void> {
  // Create HTTP server from Express app
  const server = http.createServer(app);

  // Attach WebSocket servers
  createTwilioWSServer(server);   // Twilio media stream on /media-stream
  createSocketIOServer(server);   // Socket.IO for frontend on default path

  // Start listening
  server.listen(config.server.port, () => {
    log.info('═══════════════════════════════════════════════════');
    log.info('  Real-Time Voice Translation Server');
    log.info('═══════════════════════════════════════════════════');
    log.info(`  Environment : ${config.env}`);
    log.info(`  HTTP Server : http://${config.server.host}:${config.server.port}`);
    log.info(`  WebSocket   : ws://${config.server.host}:${config.server.port}/media-stream`);
    log.info(`  Socket.IO   : ws://${config.server.host}:${config.server.port}`);
    log.info(`  Health      : http://${config.server.host}:${config.server.port}/api/health`);
    log.info('═══════════════════════════════════════════════════');
    log.info(`  Default translation: ${config.translation.defaultSourceLang} → ${config.translation.defaultTargetLang}`);
    log.info(`  STT streaming: ${config.streaming.sttEnabled}`);
    log.info(`  Cache enabled: ${config.cache.enabled}`);
    log.info('═══════════════════════════════════════════════════');
  });

  // Graceful shutdown
  const shutdown = (signal: string): void => {
    log.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      log.info('Server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      log.warn('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    log.error('Unhandled rejection', { reason });
  });

  process.on('uncaughtException', (error) => {
    log.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });
}

startServer().catch((err) => {
  log.error('Failed to start server', { error: err });
  process.exit(1);
});
