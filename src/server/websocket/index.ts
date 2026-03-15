import http from 'http';
import WebSocket from 'ws';
import { logger } from '../../utils/logger';
import { config } from '../../config';

export function setupWebSocketServer(server: http.Server): WebSocket.Server {
  const wss = new WebSocket.Server({
    server,
    path: '/media-stream',
  });

  wss.on('connection', (ws: WebSocket) => {
    // Only load the Twilio media stream handler if Google Cloud is configured
    // This prevents Google Cloud SDK from crashing the server at import time
    if (config.google.projectId) {
      import('./media-stream.handler').then(({ handleMediaStream }) => {
        handleMediaStream(ws);
      }).catch((err) => {
        logger.error('Failed to load media stream handler', { error: (err as Error).message });
        ws.close();
      });
    } else {
      logger.warn('Twilio media stream connection rejected — Google Cloud not configured');
      ws.close();
    }
  });

  wss.on('error', (error: Error) => {
    logger.error('WebSocket server error', { error: error.message });
  });

  logger.info('WebSocket server attached at /media-stream');
  return wss;
}
