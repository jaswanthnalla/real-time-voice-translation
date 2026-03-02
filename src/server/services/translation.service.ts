import { TranslationServiceClient } from '@google-cloud/translate';
import NodeCache from 'node-cache';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { translationDuration, translationCounter } from '../../utils/metrics';
import { TranslationResult } from '../../types';

export class TranslationService {
  private client: TranslationServiceClient;
  private cache: NodeCache;
  private projectId: string;

  constructor() {
    this.client = new TranslationServiceClient();
    this.projectId = config.google.projectId;
    this.cache = new NodeCache({ stdTTL: config.translation.cacheTtl });
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<TranslationResult> {
    const startTime = Date.now();
    const cacheKey = `${sourceLang}:${targetLang}:${text}`;

    const cached = this.cache.get<string>(cacheKey);
    if (cached) {
      logger.debug('Translation cache hit', { sourceLang, targetLang });
      return {
        originalText: text,
        translatedText: cached,
        sourceLang,
        targetLang,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const parent = `projects/${this.projectId}/locations/global`;

      const [response] = await this.client.translateText({
        parent,
        contents: [text],
        sourceLanguageCode: sourceLang,
        targetLanguageCode: targetLang,
        mimeType: 'text/plain',
      });

      const translatedText = response.translations?.[0]?.translatedText || '';
      const durationMs = Date.now() - startTime;

      this.cache.set(cacheKey, translatedText);

      translationDuration.observe({ stage: 'translation' }, durationMs / 1000);
      translationCounter.inc({ source_lang: sourceLang, target_lang: targetLang, status: 'success' });

      logger.debug('Translation completed', { sourceLang, targetLang, durationMs });

      return {
        originalText: text,
        translatedText,
        sourceLang,
        targetLang,
        durationMs,
      };
    } catch (error) {
      translationCounter.inc({ source_lang: sourceLang, target_lang: targetLang, status: 'error' });
      logger.error('Translation failed', {
        error: (error as Error).message,
        sourceLang,
        targetLang,
      });
      throw error;
    }
  }
}
