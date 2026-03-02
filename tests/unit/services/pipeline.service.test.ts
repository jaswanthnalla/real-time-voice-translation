import { PipelineService } from '../../../src/server/services/pipeline.service';

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
      { audioContent: Buffer.from('translated-audio') },
    ]),
  })),
}));

describe('PipelineService', () => {
  let pipeline: PipelineService;

  beforeEach(() => {
    pipeline = new PipelineService({
      sourceLang: 'en',
      targetLang: 'es',
    });
  });

  afterEach(() => {
    pipeline.stop();
  });

  it('should create a pipeline with correct config', () => {
    expect(pipeline).toBeDefined();
    expect(pipeline.getIsProcessing()).toBe(false);
  });

  it('should process audio through the full pipeline', (done) => {
    pipeline.start();

    pipeline.on('translated-audio', (result) => {
      expect(result.audioContent).toBeInstanceOf(Buffer);
      expect(result.translationResult.translatedText).toBe('Hola mundo');
      expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
      done();
    });

    // Simulate STT emitting a final transcription
    const { _mockStream } = require('@google-cloud/speech');
    _mockStream.emit('data', {
      results: [
        {
          alternatives: [{ transcript: 'Hello world', confidence: 0.95 }],
          isFinal: true,
        },
      ],
    });
  });
});
