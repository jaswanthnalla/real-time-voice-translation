import http from 'http';
import { EventEmitter } from 'events';

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/server/websocket/media-stream.handler', () => ({
  handleMediaStream: jest.fn(),
}));

const mockWssInstance = new EventEmitter();
const MockWebSocketServer = jest.fn().mockImplementation(() => mockWssInstance);

jest.mock('ws', () => ({
  __esModule: true,
  default: { Server: MockWebSocketServer },
  Server: MockWebSocketServer,
}));

import { setupWebSocketServer } from '../../../src/server/websocket';
import { handleMediaStream } from '../../../src/server/websocket/media-stream.handler';
import { logger } from '../../../src/utils/logger';

describe('WebSocket Server Setup', () => {
  let server: http.Server;

  beforeEach(() => {
    jest.clearAllMocks();
    server = http.createServer();
  });

  afterEach(() => {
    server.close();
  });

  it('creates WebSocket server with correct path', () => {
    setupWebSocketServer(server);

    expect(MockWebSocketServer).toHaveBeenCalledWith({
      server,
      path: '/media-stream',
    });
  });

  it('returns the WebSocket server instance', () => {
    const wss = setupWebSocketServer(server);
    expect(wss).toBe(mockWssInstance);
  });

  it('logs that WebSocket server is attached', () => {
    setupWebSocketServer(server);
    expect(logger.info).toHaveBeenCalledWith('WebSocket server attached at /media-stream');
  });

  it('calls handleMediaStream on new connection', () => {
    setupWebSocketServer(server);

    const fakeWs = { id: 'test' };
    mockWssInstance.emit('connection', fakeWs);

    expect(handleMediaStream).toHaveBeenCalledWith(fakeWs);
  });

  it('logs errors from WebSocket server', () => {
    setupWebSocketServer(server);

    mockWssInstance.emit('error', new Error('bind failed'));

    expect(logger.error).toHaveBeenCalledWith('WebSocket server error', {
      error: 'bind failed',
    });
  });
});
