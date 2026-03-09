import { EventEmitter } from 'events';
import { STTService } from '../../../src/server/services/stt.service';

const mockStream = new EventEmitter();
(mockStream as any).write = jest.fn();
(mockStream as any).end = jest.fn();
(mockStream as any).destroyed = false;

jest.mock('@google-cloud/speech', () => ({
  SpeechClient: jest.fn().mockImplementation(() => ({
    streamingRecognize: jest.fn().mockReturnValue(mockStream),
  })),
}));

describe('STTService', () => {
  let service: STTService;

  beforeEach(() => {
    service = new STTService('en-US');
  });

  afterEach(() => {
    service.destroy();
  });

  describe('startStream', () => {
    it('should create a new recognition stream', () => {
      service.startStream();
      // Stream should be active after start
      expect((mockStream as any).write).not.toHaveBeenCalled();
    });
  });

  describe('writeAudio', () => {
    it('should write audio to the stream', () => {
      service.startStream();
      const audioChunk = Buffer.from('test-audio-data');
      service.writeAudio(audioChunk);

      expect((mockStream as any).write).toHaveBeenCalledWith(audioChunk);
    });
  });

  describe('transcription events', () => {
    it('should emit transcription when STT returns results', (done) => {
      service.startStream();

      service.on('transcription', (result) => {
        expect(result.transcript).toBe('Hello world');
        expect(result.isFinal).toBe(true);
        expect(result.confidence).toBe(0.95);
        done();
      });

      mockStream.emit('data', {
        results: [
          {
            alternatives: [
              { transcript: 'Hello world', confidence: 0.95 },
            ],
            isFinal: true,
          },
        ],
      });
    });
  });
});
