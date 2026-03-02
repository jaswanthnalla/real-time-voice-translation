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
    it('should synthesize text to audio', async () => {
      const result = await service.synthesize('Hello world', 'en-US');

      expect(result.audioContent).toBeInstanceOf(Buffer);
      expect(result.audioContent.length).toBeGreaterThan(0);
      expect(result.encoding).toBe('MULAW');
      expect(result.sampleRate).toBe(8000);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
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
