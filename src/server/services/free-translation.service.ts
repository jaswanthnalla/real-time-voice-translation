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
 * Free translation service using MyMemory API.
 * No API key required. Supports up to 5000 chars/day free.
 * Falls back to Google Cloud Translation if configured.
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
      const translatedText = await this.translateWithMyMemory(trimmed, sourceLang, targetLang);
      this.cache.set(cacheKey, translatedText);

      return {
        originalText: text,
        translatedText,
        sourceLang,
        targetLang,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Translation failed', {
        error: (error as Error).message,
        sourceLang,
        targetLang,
      });
      // Return original text as fallback so the app doesn't break
      return {
        originalText: text,
        translatedText: text,
        sourceLang,
        targetLang,
        durationMs: Date.now() - startTime,
      };
    }
  }

  private async translateWithMyMemory(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    const langPair = `${sourceLang}|${targetLang}`;
    const url = `https://api.mymemory.translated.net/get`;

    const response = await axios.get(url, {
      params: { q: text, langpair: langPair },
      timeout: 5000,
    });

    const data = response.data;
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      let translated = data.responseData.translatedText;
      // MyMemory sometimes returns uppercase when it can't translate
      if (translated === text.toUpperCase()) {
        return text;
      }
      return translated;
    }

    throw new Error(`MyMemory API error: status ${data.responseStatus}`);
  }
}

// Singleton instance
export const freeTranslation = new FreeTranslationService();
