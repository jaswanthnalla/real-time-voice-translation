import { TTSService } from '../../../src/server/services/tts.service';

jest.mock('@google-cloud/text-to-speech', () => ({
  TextToSpeechClient: jest.fn().mockImplementation(() => ({
    synthesizeSpeech: jest.fn().mockResolvedValue([
      {
        audioContent: Buffer.from('mock-audio-content'),
      },
    ]),
  })),
}));

describe('TTSService', () => {
  let service: TTSService;

  beforeEach(() => {
    service = new TTSService();
  });

  describe('synthesize', () => {
    it('should synthesize text to audio with default MULAW encoding', async () => {
      const result = await service.synthesize('Hello world', 'en-US');

      expect(result.audioContent).toBeInstanceOf(Buffer);
      expect(result.audioContent.length).toBeGreaterThan(0);
      expect(result.encoding).toBe('MULAW');
      expect(result.sampleRate).toBe(8000);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should synthesize with custom MP3 encoding for browser playback', async () => {
      const result = await service.synthesize('Hello world', 'en-US', {
        audioEncoding: 'MP3',
        sampleRateHertz: 24000,
      });

      expect(result.audioContent).toBeInstanceOf(Buffer);
      expect(result.encoding).toBe('MP3');
      expect(result.sampleRate).toBe(24000);
    });

    it('should synthesize with OGG_OPUS encoding', async () => {
      const result = await service.synthesize('Hello world', 'en-US', {
        audioEncoding: 'OGG_OPUS',
        sampleRateHertz: 48000,
      });

      expect(result.encoding).toBe('OGG_OPUS');
      expect(result.sampleRate).toBe(48000);
    });

    it('should throw if no audio content is returned', async () => {
      const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
      TextToSpeechClient.mockImplementationOnce(() => ({
        synthesizeSpeech: jest.fn().mockResolvedValue([{ audioContent: null }]),
      }));

      const emptyService = new TTSService();
      await expect(emptyService.synthesize('test', 'en-US')).rejects.toThrow(
        'No audio content in TTS response'
      );
    });
  });
});
