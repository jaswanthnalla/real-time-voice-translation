import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ioClient, Socket as ClientSocket } from 'socket.io-client';
import { setupSocketIOServer } from '../../../src/server/socketio';

jest.mock('@google-cloud/speech', () => {
  const { EventEmitter } = require('events');
  const mockStream = new EventEmitter();
  (mockStream as any).write = jest.fn();
  (mockStream as any).end = jest.fn();
  (mockStream as any).destroyed = false;
  return {
    SpeechClient: jest.fn().mockImplementation(() => ({
      streamingRecognize: jest.fn().mockReturnValue(mockStream),
    })),
    _mockStream: mockStream,
  };
});

jest.mock('@google-cloud/translate', () => ({
  TranslationServiceClient: jest.fn().mockImplementation(() => ({
    translateText: jest.fn().mockResolvedValue([
      { translations: [{ translatedText: 'Hola mundo' }] },
    ]),
  })),
}));

jest.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: jest.fn().mockImplementation(() => ({
    synthesizeSpeech: jest.fn().mockResolvedValue([
      { audioContent: Buffer.from('mock-audio') },
    ]),
  })),
}));

describe('Socket.IO Server', () => {
  let httpServer: http.Server;
  let ioServer: Server;
  let clientSocket: ClientSocket;
  let port: number;

  beforeAll((done) => {
    const app = express();
    httpServer = http.createServer(app);
    ioServer = setupSocketIOServer(httpServer);

    httpServer.listen(0, () => {
      const addr = httpServer.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      done();
    });
  });

  afterAll((done) => {
    if (clientSocket?.connected) clientSocket.disconnect();
    ioServer.close();
    httpServer.close(done);
  });

  afterEach(() => {
    if (clientSocket?.connected) clientSocket.disconnect();
  });

  it('should accept client connections', (done) => {
    clientSocket = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
    });

    clientSocket.on('connect', () => {
      expect(clientSocket.connected).toBe(true);
      done();
    });
  });

  it('should create a session on join_session', (done) => {
    clientSocket = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
    });

    clientSocket.on('connect', () => {
      clientSocket.emit('join_session', {
        sourceLang: 'en',
        targetLang: 'es',
      });
    });

    clientSocket.on('session_joined', (data) => {
      expect(data.sessionId).toBeDefined();
      expect(data.sourceLang).toBe('en');
      expect(data.targetLang).toBe('es');
      done();
    });
  });

  it('should reject unsupported languages', (done) => {
    clientSocket = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
    });

    clientSocket.on('connect', () => {
      clientSocket.emit('join_session', {
        sourceLang: 'xx',
        targetLang: 'yy',
      });
    });

    clientSocket.on('error_message', (data) => {
      expect(data.message).toBe('Unsupported language');
      done();
    });
  });

  it('should emit translation_result when pipeline completes', (done) => {
    clientSocket = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
    });

    clientSocket.on('connect', () => {
      clientSocket.emit('join_session', {
        sourceLang: 'en',
        targetLang: 'es',
      });
    });

    clientSocket.on('session_joined', () => {
      // Simulate sending audio (triggers STT mock)
      clientSocket.emit('audio_chunk', {
        audioData: Buffer.from('test-audio').toString('base64'),
        sourceLang: 'en',
        targetLang: 'es',
      });

      // Simulate STT returning a final transcript
      setTimeout(() => {
        const { _mockStream } = require('@google-cloud/speech');
        _mockStream.emit('data', {
          results: [
            {
              alternatives: [{ transcript: 'Hello world', confidence: 0.95 }],
              isFinal: true,
            },
          ],
        });
      }, 100);
    });

    clientSocket.on('translation_result', (data) => {
      expect(data.originalText).toBe('Hello world');
      expect(data.translatedText).toBe('Hola mundo');
      expect(data.audioData).toBeDefined();
      done();
    });
  });
});
