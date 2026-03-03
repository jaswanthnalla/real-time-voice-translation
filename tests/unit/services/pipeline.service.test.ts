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

const mockSynthesizeSpeech = jest.fn().mockResolvedValue([
  { audioContent: Buffer.from('translated-audio') },
]);

jest.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: jest.fn().mockImplementation(() => ({
    synthesizeSpeech: mockSynthesizeSpeech,
  })),
}));

describe('PipelineService', () => {
  let pipeline: PipelineService;

  afterEach(() => {
    if (pipeline) {
      pipeline.stop();
    }
  });

  it('should create a pipeline with correct config', () => {
    pipeline = new PipelineService({
      sourceLang: 'en',
      targetLang: 'es',
    });
    expect(pipeline).toBeDefined();
    expect(pipeline.getIsProcessing()).toBe(false);
  });

  it('should process audio through the full pipeline', (done) => {
    pipeline = new PipelineService({
      sourceLang: 'en',
      targetLang: 'es',
    });
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

  it('should pass ttsAudioOptions to TTS synthesize', (done) => {
    mockSynthesizeSpeech.mockClear();

    pipeline = new PipelineService({
      sourceLang: 'en',
      targetLang: 'es',
      ttsAudioOptions: {
        audioEncoding: 'MP3',
        sampleRateHertz: 24000,
      },
    });
    pipeline.start();

    pipeline.on('translated-audio', () => {
      // Verify that synthesizeSpeech was called with the right encoding
      expect(mockSynthesizeSpeech).toHaveBeenCalled();
      const callArgs = mockSynthesizeSpeech.mock.calls[0][0];
      expect(callArgs.audioConfig.audioEncoding).toBe('MP3');
      expect(callArgs.audioConfig.sampleRateHertz).toBe(24000);
      done();
    });

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

  it('should use default MULAW encoding when no ttsAudioOptions provided', (done) => {
    mockSynthesizeSpeech.mockClear();

    pipeline = new PipelineService({
      sourceLang: 'en',
      targetLang: 'es',
    });
    pipeline.start();

    pipeline.on('translated-audio', () => {
      expect(mockSynthesizeSpeech).toHaveBeenCalled();
      const callArgs = mockSynthesizeSpeech.mock.calls[0][0];
      // Default is MULAW when no ttsAudioOptions provided
      expect(callArgs.audioConfig.audioEncoding).toBe('MULAW');
      done();
    });

    const { _mockStream } = require('@google-cloud/speech');
    _mockStream.emit('data', {
      results: [
        {
          alternatives: [{ transcript: 'Hello', confidence: 0.9 }],
          isFinal: true,
        },
      ],
    });
  });

  it('should emit interim results for non-final transcriptions', (done) => {
    pipeline = new PipelineService({
      sourceLang: 'en',
      targetLang: 'es',
    });
    pipeline.start();

    pipeline.on('interim', (data) => {
      expect(data.transcript).toBe('Hello wor');
      done();
    });

    const { _mockStream } = require('@google-cloud/speech');
    _mockStream.emit('data', {
      results: [
        {
          alternatives: [{ transcript: 'Hello wor', confidence: 0.5 }],
          isFinal: false,
        },
      ],
    });
  });

  it('should not process empty transcripts', (done) => {
    pipeline = new PipelineService({
      sourceLang: 'en',
      targetLang: 'es',
    });
    pipeline.start();

    const translatedAudioHandler = jest.fn();
    pipeline.on('translated-audio', translatedAudioHandler);

    const { _mockStream } = require('@google-cloud/speech');
    // Emit empty final transcript
    _mockStream.emit('data', {
      results: [
        {
          alternatives: [{ transcript: '   ', confidence: 0.9 }],
          isFinal: true,
        },
      ],
    });

    // Wait a bit and check no translation happened
    setTimeout(() => {
      expect(translatedAudioHandler).not.toHaveBeenCalled();
      done();
    }, 200);
  });
});
