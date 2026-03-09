import http from 'http';
import WebSocket from 'ws';
import { logger } from '../../utils/logger';
import { handleMediaStream } from './media-stream.handler';

export function setupWebSocketServer(server: http.Server): WebSocket.Server {
  const wss = new WebSocket.Server({
    server,
    path: '/media-stream',
  });

  wss.on('connection', (ws: WebSocket) => {
    handleMediaStream(ws);
  });

  wss.on('error', (error: Error) => {
    logger.error('WebSocket server error', { error: error.message });
  });

  logger.info('WebSocket server attached at /media-stream');
  return wss;
}
