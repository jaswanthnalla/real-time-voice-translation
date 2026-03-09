import http from 'http';
import { app } from './app';
import { config } from '../config';
import { logger } from '../utils/logger';
import { setupWebSocketServer } from './websocket';
import { setupSocketIOServer } from './socketio';
import { validateEnvironment } from './startup/validate-env';
import { db } from './services/database.service';
import { redis } from './services/redis.service';

// Validate environment configuration
validateEnvironment();

const server = http.createServer(app);

// Twilio Media Streams (raw WebSocket at /media-stream)
setupWebSocketServer(server);

// Browser-based sessions (Socket.IO)
setupSocketIOServer(server);

async function startServer(): Promise<void> {
  // Initialize database connection (graceful - won't crash if unavailable)
  await db.initialize();

  // Initialize Redis connection (graceful - won't crash if unavailable)
  await redis.connect();

  server.listen(config.port, config.host, () => {
    logger.info(`Server running on http://${config.host}:${config.port}`);
    logger.info(`Environment: ${config.env}`);
    logger.info(`Database: ${db.isConnected() ? 'connected' : 'disconnected (in-memory mode)'}`);
    logger.info(`Redis: ${redis.isReady() ? 'connected' : 'disconnected (local cache only)'}`);
  });
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  server.close(async () => {
    await redis.disconnect();
    await db.close();
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

startServer().catch((err) => {
  logger.error('Failed to start server', { error: (err as Error).message });
  process.exit(1);
});

export { server };
