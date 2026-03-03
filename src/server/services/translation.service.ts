import { TranslationServiceClient } from '@google-cloud/translate';
import NodeCache from 'node-cache';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { translationDuration, translationCounter } from '../../utils/metrics';
import { redis } from './redis.service';
import { TranslationResult } from '../../types';

export class TranslationService {
  private client: TranslationServiceClient;
  private localCache: NodeCache;
  private projectId: string;

  constructor() {
    this.client = new TranslationServiceClient();
    this.projectId = config.google.projectId;
    this.localCache = new NodeCache({ stdTTL: config.translation.cacheTtl });
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<TranslationResult> {
    const startTime = Date.now();
    const cacheKey = `translation:${sourceLang}:${targetLang}:${text}`;

    // L1: Check local in-memory cache
    const localCached = this.localCache.get<string>(cacheKey);
    if (localCached) {
      logger.debug('Translation L1 cache hit', { sourceLang, targetLang });
      return {
        originalText: text,
        translatedText: localCached,
        sourceLang,
        targetLang,
        durationMs: Date.now() - startTime,
      };
    }

    // L2: Check Redis cache
    const redisCached = await redis.get(cacheKey);
    if (redisCached) {
      logger.debug('Translation L2 (Redis) cache hit', { sourceLang, targetLang });
      this.localCache.set(cacheKey, redisCached);
      return {
        originalText: text,
        translatedText: redisCached,
        sourceLang,
        targetLang,
        durationMs: Date.now() - startTime,
      };
    }

    // L3: Call Google Translate API
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

      // Store in both cache tiers
      this.localCache.set(cacheKey, translatedText);
      await redis.set(cacheKey, translatedText, config.translation.cacheTtl);

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
