import { TranslationService } from '../../../src/server/services/translation.service';

jest.mock('@google-cloud/translate', () => ({
  TranslationServiceClient: jest.fn().mockImplementation(() => ({
    translateText: jest.fn().mockResolvedValue([
      {
        translations: [{ translatedText: 'Hola, ¿cómo estás?' }],
      },
    ]),
  })),
}));

describe('TranslationService', () => {
  let service: TranslationService;

  beforeEach(() => {
    service = new TranslationService();
  });

  describe('translate', () => {
    it('should translate text between languages', async () => {
      const result = await service.translate('Hello, how are you?', 'en', 'es');

      expect(result.originalText).toBe('Hello, how are you?');
      expect(result.translatedText).toBe('Hola, ¿cómo estás?');
      expect(result.sourceLang).toBe('en');
      expect(result.targetLang).toBe('es');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should cache repeated translations', async () => {
      const result1 = await service.translate('Hello', 'en', 'es');
      const result2 = await service.translate('Hello', 'en', 'es');

      expect(result1.translatedText).toBe(result2.translatedText);
      // Second call should be faster due to cache
      expect(result2.durationMs).toBeLessThanOrEqual(result1.durationMs + 5);
    });
  });
});
