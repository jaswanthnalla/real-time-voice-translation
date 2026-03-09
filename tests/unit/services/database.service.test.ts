jest.mock('pg', () => {
  const mockClient = {
    query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
    release: jest.fn(),
  };
  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    end: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  };
  return {
    Pool: jest.fn().mockImplementation(() => mockPool),
    _mockPool: mockPool,
    _mockClient: mockClient,
  };
});

// Must import after mock
import { db } from '../../../src/server/services/database.service';

const { _mockPool, _mockClient } = require('pg');

describe('DatabaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initialize', () => {
    it('should connect successfully and set connected state', async () => {
      await db.initialize();
      expect(_mockPool.connect).toHaveBeenCalled();
      expect(_mockClient.query).toHaveBeenCalledWith('SELECT 1');
      expect(_mockClient.release).toHaveBeenCalled();
      expect(db.isConnected()).toBe(true);
    });

    it('should handle connection failure gracefully', async () => {
      _mockPool.connect.mockRejectedValueOnce(new Error('Connection refused'));
      await db.initialize();
      expect(db.isConnected()).toBe(false);
    });
  });

  describe('query', () => {
    it('should execute query and return result', async () => {
      const mockResult = { rows: [{ id: 1 }], rowCount: 1 };
      _mockPool.query.mockResolvedValueOnce(mockResult);

      const result = await db.query('SELECT * FROM sessions WHERE id = $1', ['123']);
      expect(result).toEqual(mockResult);
      expect(_mockPool.query).toHaveBeenCalledWith('SELECT * FROM sessions WHERE id = $1', ['123']);
    });

    it('should throw on query failure', async () => {
      _mockPool.query.mockRejectedValueOnce(new Error('Query failed'));
      await expect(db.query('INVALID SQL')).rejects.toThrow('Query failed');
    });
  });

  describe('getPool', () => {
    it('should return the pool instance', () => {
      expect(db.getPool()).toBeDefined();
    });
  });

  describe('close', () => {
    it('should close the pool and set connected to false', async () => {
      await db.close();
      expect(_mockPool.end).toHaveBeenCalled();
      expect(db.isConnected()).toBe(false);
    });
  });
});
