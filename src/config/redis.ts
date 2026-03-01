import { createClient, RedisClientType } from 'redis';
import config from './index';

let client: RedisClientType | null = null;

export async function getRedisClient(): Promise<RedisClientType> {
  if (!client) {
    client = createClient({
      url: config.redis.url,
      password: config.redis.password,
      socket: {
        reconnectStrategy: (retries: number) => {
          if (retries > 10) return new Error('Redis max retries reached');
          return Math.min(retries * 100, 3000);
        },
      },
    });

    client.on('error', (err) => {
      console.error('Redis client error:', err);
    });

    client.on('connect', () => {
      console.log('Redis client connected');
    });

    client.on('reconnecting', () => {
      console.log('Redis client reconnecting...');
    });

    await client.connect();
  }
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}
