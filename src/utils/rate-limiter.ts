import { getRedisClient } from '../config/redis';

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; remaining: number; resetMs: number }> {
  try {
    const redis = await getRedisClient();
    const fullKey = `ratelimit:${key}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    await redis.zRemRangeByScore(fullKey, '-inf', windowStart.toString());

    const count = await redis.zCard(fullKey);

    if (count >= limit) {
      const oldest = await redis.zRange(fullKey, 0, 0, { REV: false });
      const resetMs = oldest.length > 0 ? parseInt(oldest[0]) + windowMs - now : windowMs;
      return { allowed: false, remaining: 0, resetMs };
    }

    await redis.zAdd(fullKey, { score: now, value: `${now}:${Math.random()}` });
    await redis.expire(fullKey, Math.ceil(windowMs / 1000));

    return { allowed: true, remaining: limit - count - 1, resetMs: windowMs };
  } catch {
    // If Redis fails, allow the request (fail open)
    return { allowed: true, remaining: limit, resetMs: 0 };
  }
}
