import { createClient, RedisClientType } from 'redis';
import { config } from '../../config';
import { logger } from '../../utils/logger';

class RedisService {
  private client: RedisClientType;
  private connected: boolean = false;

  constructor() {
    this.client = createClient({
      url: config.redis.url,
    }) as RedisClientType;

    this.client.on('error', (err: Error) => {
      logger.error('Redis client error', { error: err.message });
      this.connected = false;
    });

    this.client.on('ready', () => {
      this.connected = true;
      logger.info('Redis client ready');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.connected = true;
      logger.info('Redis connection established');
    } catch (error) {
      this.connected = false;
      logger.warn('Redis connection failed - using in-memory cache only', {
        error: (error as Error).message,
      });
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.connected) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.warn('Redis get failed', { key, error: (error as Error).message });
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.connected) return;
    try {
      if (ttl) {
        await this.client.setEx(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.warn('Redis set failed', { key, error: (error as Error).message });
    }
  }

  async del(key: string): Promise<void> {
    if (!this.connected) return;
    try {
      await this.client.del(key);
    } catch (error) {
      logger.warn('Redis del failed', { key, error: (error as Error).message });
    }
  }

  isReady(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
      this.connected = false;
      logger.info('Redis connection closed');
    }
  }
}

export const redis = new RedisService();
