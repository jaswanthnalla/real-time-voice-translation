jest.mock('@google-cloud/translate', () => ({
  TranslationServiceClient: jest.fn().mockImplementation(() => ({
    translateText: jest.fn().mockResolvedValue([
      {
        translations: [{ translatedText: 'Hola, ¿cómo estás?' }],
      },
    ]),
  })),
}));

// Mock Redis service for two-tier caching
jest.mock('../../../src/server/services/redis.service', () => ({
  redis: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    isReady: jest.fn().mockReturnValue(false),
  },
}));

import { TranslationService } from '../../../src/server/services/translation.service';
import { redis } from '../../../src/server/services/redis.service';

describe('TranslationService', () => {
  let service: TranslationService;

  beforeEach(() => {
    service = new TranslationService();
    jest.clearAllMocks();
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

    it('should cache repeated translations in local cache', async () => {
      const result1 = await service.translate('Hello', 'en', 'es');
      const result2 = await service.translate('Hello', 'en', 'es');

      expect(result1.translatedText).toBe(result2.translatedText);
      // Second call should be faster due to L1 cache
      expect(result2.durationMs).toBeLessThanOrEqual(result1.durationMs + 5);
    });

    it('should store translations in Redis', async () => {
      await service.translate('Test', 'en', 'es');

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('translation:en:es:Test'),
        'Hola, ¿cómo estás?',
        expect.any(Number)
      );
    });

    it('should use Redis cache when available', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce('Cached translation');

      const result = await service.translate('Unique text', 'en', 'es');
      expect(result.translatedText).toBe('Cached translation');
    });
  });
});
