import axios from 'axios';
import NodeCache from 'node-cache';
import { logger } from '../../utils/logger';

interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  durationMs: number;
}

/**
 * Free translation service with two providers:
 *
 * 1. Google Translate free API (primary) — fast, supports ALL languages
 *    including Telugu, Tamil, Kannada, Malayalam, etc. No API key needed.
 *    No strict daily limit for low-volume use (voice call between 2 people).
 *
 * 2. MyMemory API (fallback) — if Google's free endpoint is blocked.
 *    Limited to 5000 chars/day free, poor quality for Indian languages.
 *
 * Results are cached for 1 hour to reduce API calls for repeated phrases.
 */
export class FreeTranslationService {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({ stdTTL: 3600 });
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<TranslationResult> {
    const startTime = Date.now();
    const trimmed = text.trim();
    if (!trimmed) {
      return {
        originalText: text,
        translatedText: '',
        sourceLang,
        targetLang,
        durationMs: 0,
      };
    }

    const cacheKey = `tr:${sourceLang}:${targetLang}:${trimmed}`;
    const cached = this.cache.get<string>(cacheKey);
    if (cached) {
      return {
        originalText: text,
        translatedText: cached,
        sourceLang,
        targetLang,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      // Try Google Translate free API first (fast, all languages)
      const translatedText = await this.translateWithGoogle(trimmed, sourceLang, targetLang);
      this.cache.set(cacheKey, translatedText);

      return {
        originalText: text,
        translatedText,
        sourceLang,
        targetLang,
        durationMs: Date.now() - startTime,
      };
    } catch (googleError) {
      logger.warn('Google free translate failed, trying MyMemory', {
        error: (googleError as Error).message,
        sourceLang,
        targetLang,
      });

      try {
        // Fallback to MyMemory
        const translatedText = await this.translateWithMyMemory(trimmed, sourceLang, targetLang);
        this.cache.set(cacheKey, translatedText);

        return {
          originalText: text,
          translatedText,
          sourceLang,
          targetLang,
          durationMs: Date.now() - startTime,
        };
      } catch (mmError) {
        logger.error('All translation providers failed', {
          googleError: (googleError as Error).message,
          myMemoryError: (mmError as Error).message,
          sourceLang,
          targetLang,
        });
        // Return original text so the app doesn't break
        return {
          originalText: text,
          translatedText: text,
          sourceLang,
          targetLang,
          durationMs: Date.now() - startTime,
        };
      }
    }
  }

  /**
   * Google Translate free API — the same endpoint used by many open-source
   * translation libraries. Supports all languages, fast response times,
   * and no API key required. Works well for low-volume use cases.
   */
  private async translateWithGoogle(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    const url = 'https://translate.googleapis.com/translate_a/single';

    const response = await axios.get(url, {
      params: {
        client: 'gtx',
        sl: sourceLang,
        tl: targetLang,
        dt: 't',
        q: text,
      },
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    // Response is a nested array: [[["translated text","original text",...],...],...]
    const data = response.data;
    if (Array.isArray(data) && Array.isArray(data[0])) {
      let translated = '';
      for (const segment of data[0]) {
        if (Array.isArray(segment) && segment[0]) {
          translated += segment[0];
        }
      }
      if (translated.trim()) {
        return translated.trim();
      }
    }

    throw new Error('Unexpected Google Translate response format');
  }

  /**
   * MyMemory API — fallback provider. Free tier is limited to
   * 5000 chars/day, and quality is poor for many Indian languages.
   */
  private async translateWithMyMemory(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    const langPair = `${sourceLang}|${targetLang}`;
    const url = 'https://api.mymemory.translated.net/get';

    const response = await axios.get(url, {
      params: { q: text, langpair: langPair },
      timeout: 5000,
    });

    const data = response.data;
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const translated = data.responseData.translatedText;
      // MyMemory returns uppercase when it can't translate
      if (translated === text.toUpperCase()) {
        throw new Error('MyMemory returned untranslated uppercase text');
      }
      return translated;
    }

    throw new Error(`MyMemory API error: status ${data.responseStatus}`);
  }
}

// Singleton instance
export const freeTranslation = new FreeTranslationService();
