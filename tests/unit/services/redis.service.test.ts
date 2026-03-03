const mockRedisClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  setEx: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  quit: jest.fn().mockResolvedValue(undefined),
  on: jest.fn(),
};

jest.mock('redis', () => ({
  createClient: jest.fn().mockReturnValue(mockRedisClient),
}));

// Must import after mock
import { redis } from '../../../src/server/services/redis.service';

describe('RedisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should connect successfully', async () => {
      await redis.connect();
      expect(mockRedisClient.connect).toHaveBeenCalled();
    });

    it('should handle connection failure gracefully', async () => {
      mockRedisClient.connect.mockRejectedValueOnce(new Error('Connection refused'));
      await redis.connect();
      // Should not throw
      expect(redis.isReady()).toBe(false);
    });
  });

  describe('get', () => {
    it('should return null when not connected', async () => {
      // redis.connected is false initially (before connect succeeds)
      const result = await redis.get('key');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should do nothing when not connected', async () => {
      await redis.set('key', 'value');
      // Should not call client.set when not connected
      expect(mockRedisClient.set).not.toHaveBeenCalled();
    });
  });

  describe('del', () => {
    it('should do nothing when not connected', async () => {
      await redis.del('key');
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });
  });

  describe('isReady', () => {
    it('should return connection status', () => {
      expect(typeof redis.isReady()).toBe('boolean');
    });
  });

  describe('disconnect', () => {
    it('should handle disconnect when not connected', async () => {
      await redis.disconnect();
      // Should not throw when not connected
    });
  });
});
