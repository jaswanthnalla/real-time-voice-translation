import { EventEmitter } from 'events';
import { handleMediaStream } from '../../../src/server/websocket/media-stream.handler';

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../src/utils/metrics', () => ({
  websocketConnectionsGauge: { inc: jest.fn(), dec: jest.fn() },
}));

const mockPipelineStart = jest.fn();
const mockPipelineStop = jest.fn();
const mockPipelineProcessAudio = jest.fn();

jest.mock('../../../src/server/services/pipeline.service', () => ({
  PipelineService: jest.fn().mockImplementation(() => {
    const emitter = new EventEmitter();
    return Object.assign(emitter, {
      start: mockPipelineStart,
      stop: mockPipelineStop,
      processAudio: mockPipelineProcessAudio,
    });
  }),
}));

jest.mock('../../../src/server/services/session.service', () => ({
  sessionService: {
    getByCallSid: jest.fn().mockReturnValue(null),
    create: jest.fn().mockReturnValue({ id: 'session-1' }),
    update: jest.fn(),
    addTranscript: jest.fn(),
    complete: jest.fn(),
  },
}));

class MockWebSocket extends EventEmitter {
  readyState = 1; // OPEN
  static OPEN = 1;
  send = jest.fn();
}

describe('Media Stream Handler', () => {
  let ws: MockWebSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    ws = new MockWebSocket();
    // Patch WebSocket.OPEN for the handler's comparison
    (ws as any).constructor.OPEN = 1;
  });

  it('increments connection gauge on connect', () => {
    const { websocketConnectionsGauge } = require('../../../src/utils/metrics');
    handleMediaStream(ws as any);
    expect(websocketConnectionsGauge.inc).toHaveBeenCalled();
  });

  it('decrements connection gauge on close', () => {
    const { websocketConnectionsGauge } = require('../../../src/utils/metrics');
    handleMediaStream(ws as any);
    ws.emit('close');
    expect(websocketConnectionsGauge.dec).toHaveBeenCalled();
  });

  it('handles connected event', () => {
    handleMediaStream(ws as any);
    ws.emit('message', JSON.stringify({ event: 'connected' }));
    // Should not throw
  });

  it('handles start event and creates pipeline', () => {
    const { sessionService } = require('../../../src/server/services/session.service');
    handleMediaStream(ws as any);

    ws.emit('message', JSON.stringify({
      event: 'start',
      start: {
        streamSid: 'MZ123',
        callSid: 'CA456',
        customParameters: { sourceLang: 'fr', targetLang: 'de' },
      },
    }));

    expect(sessionService.create).toHaveBeenCalledWith(
      expect.objectContaining({ sourceLang: 'fr', targetLang: 'de' })
    );
    expect(mockPipelineStart).toHaveBeenCalled();
  });

  it('handles media event and processes audio', () => {
    handleMediaStream(ws as any);

    // First start the stream
    ws.emit('message', JSON.stringify({
      event: 'start',
      start: {
        streamSid: 'MZ123',
        callSid: 'CA456',
        customParameters: {},
      },
    }));

    // Then send media
    const base64Audio = Buffer.from('test-audio').toString('base64');
    ws.emit('message', JSON.stringify({
      event: 'media',
      media: { payload: base64Audio },
    }));

    expect(mockPipelineProcessAudio).toHaveBeenCalled();
  });

  it('handles stop event and cleans up', () => {
    const { sessionService } = require('../../../src/server/services/session.service');
    handleMediaStream(ws as any);

    ws.emit('message', JSON.stringify({
      event: 'start',
      start: { streamSid: 'MZ123', callSid: 'CA456', customParameters: {} },
    }));

    ws.emit('message', JSON.stringify({ event: 'stop' }));

    expect(mockPipelineStop).toHaveBeenCalled();
    expect(sessionService.complete).toHaveBeenCalledWith('session-1');
  });

  it('handles invalid JSON messages gracefully', () => {
    handleMediaStream(ws as any);
    ws.emit('message', 'not-json');
    // Should not throw
  });

  it('ignores media events before start', () => {
    handleMediaStream(ws as any);
    ws.emit('message', JSON.stringify({
      event: 'media',
      media: { payload: 'dGVzdA==' },
    }));
    expect(mockPipelineProcessAudio).not.toHaveBeenCalled();
  });

  it('handles WebSocket error event', () => {
    handleMediaStream(ws as any);
    ws.emit('error', new Error('connection reset'));
    // Should not throw
  });
});
