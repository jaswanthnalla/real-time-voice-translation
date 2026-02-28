import { TranslationServiceClient } from '@google-cloud/translate';
import NodeCache from 'node-cache';
import { createServiceLogger } from '../../utils/logger';
import { config } from '../../config';
import type { LanguageCode, TranslationResult } from '../../types';

const log = createServiceLogger('translation-service');

/**
 * Neural Machine Translation service using Google Cloud Translation AI.
 * Translates text between supported language pairs with caching.
 */
export class TranslationService {
  private client: TranslationServiceClient;
  private cache: NodeCache;
  private projectId: string;

  constructor() {
    this.client = new TranslationServiceClient();
    this.projectId = config.google.projectId || '';
    this.cache = new NodeCache({
      stdTTL: config.cache.ttl,
      checkperiod: 120,
      maxKeys: 10000,
    });
  }

  /**
   * Translate text from source to target language.
   * Uses caching to minimize API calls for repeated phrases.
   */
  async translate(
    text: string,
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
  ): Promise<TranslationResult> {
    if (!text.trim()) {
      return {
        originalText: text,
        translatedText: '',
        sourceLanguage,
        targetLanguage,
        confidence: 1,
      };
    }

    // Check cache first
    const cacheKey = `${sourceLanguage}:${targetLanguage}:${text.toLowerCase().trim()}`;
    const cached = this.cache.get<TranslationResult>(cacheKey);
    if (cached && config.cache.enabled) {
      log.debug(`Cache hit for translation: "${text.substring(0, 50)}..."`);
      return cached;
    }

    const startTime = Date.now();

    try {
      const parent = `projects/${this.projectId}/locations/global`;

      const [response] = await this.client.translateText({
        parent,
        contents: [text],
        mimeType: 'text/plain',
        sourceLanguageCode: sourceLanguage,
        targetLanguageCode: targetLanguage,
      });

      const translatedText = response.translations?.[0]?.translatedText || '';
      const latency = Date.now() - startTime;

      log.debug(
        `Translated "${text.substring(0, 50)}" → "${translatedText.substring(0, 50)}" (${latency}ms)`,
      );

      const result: TranslationResult = {
        originalText: text,
        translatedText,
        sourceLanguage,
        targetLanguage,
        confidence: 0.95, // Google Translation doesn't return confidence directly
      };

      // Cache the result
      if (config.cache.enabled) {
        this.cache.set(cacheKey, result);
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Translation failed';
      log.error(`Translation error: ${message}`);
      throw err;
    }
  }

  /**
   * Batch translate multiple texts in one API call.
   */
  async translateBatch(
    texts: string[],
    sourceLanguage: LanguageCode,
    targetLanguage: LanguageCode,
  ): Promise<TranslationResult[]> {
    if (texts.length === 0) return [];

    const parent = `projects/${this.projectId}/locations/global`;

    try {
      const [response] = await this.client.translateText({
        parent,
        contents: texts,
        mimeType: 'text/plain',
        sourceLanguageCode: sourceLanguage,
        targetLanguageCode: targetLanguage,
      });

      return (response.translations || []).map((t, i) => ({
        originalText: texts[i],
        translatedText: t.translatedText || '',
        sourceLanguage,
        targetLanguage,
        confidence: 0.95,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Batch translation failed';
      log.error(`Batch translation error: ${message}`);
      throw err;
    }
  }

  /** Get cache statistics */
  getCacheStats(): { hits: number; misses: number; keys: number } {
    const stats = this.cache.getStats();
    return {
      hits: stats.hits,
      misses: stats.misses,
      keys: this.cache.keys().length,
    };
  }
}

// Singleton instance
export const translationService = new TranslationService();
