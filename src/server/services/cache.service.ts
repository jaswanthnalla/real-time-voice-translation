import { getRedisClient } from '../../config/redis';
import { createLogger } from '../../utils/logger';
import crypto from 'crypto';

const logger = createLogger('cache');

export async function get<T>(key: string): Promise<T | null> {
  try {
    const redis = await getRedisClient();
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch (error) {
    logger.warn('Cache get failed', { key, error });
    return null;
  }
}

export async function set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    logger.warn('Cache set failed', { key, error });
  }
}

export async function del(key: string): Promise<void> {
  try {
    const redis = await getRedisClient();
    await redis.del(key);
  } catch (error) {
    logger.warn('Cache delete failed', { key, error });
  }
}

function translationCacheKey(sourceText: string, sourceLang: string, targetLang: string): string {
  const hash = crypto.createHash('md5').update(sourceText).digest('hex');
  return `translate:${sourceLang}:${targetLang}:${hash}`;
}

export async function getTranslationCache(
  sourceText: string,
  sourceLang: string,
  targetLang: string,
): Promise<string | null> {
  const key = translationCacheKey(sourceText, sourceLang, targetLang);
  return get<string>(key);
}

export async function setTranslationCache(
  sourceText: string,
  sourceLang: string,
  targetLang: string,
  result: string,
  ttlSeconds = 3600,
): Promise<void> {
  const key = translationCacheKey(sourceText, sourceLang, targetLang);
  await set(key, result, ttlSeconds);
}
