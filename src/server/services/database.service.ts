import { Pool, QueryResult } from 'pg';
import { config } from '../../config';
import { logger } from '../../utils/logger';

class DatabaseService {
  private pool: Pool;
  private connected: boolean = false;

  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.pool.on('error', (err: Error) => {
      logger.error('Unexpected database pool error', { error: err.message });
    });
  }

  async initialize(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.connected = true;
      logger.info('Database connection established');
    } catch (error) {
      this.connected = false;
      logger.warn('Database connection failed - running in memory-only mode', {
        error: (error as Error).message,
      });
    }
  }

  async query(text: string, params?: unknown[]): Promise<QueryResult> {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Database query executed', { text: text.substring(0, 80), duration, rows: result.rowCount });
      return result;
    } catch (error) {
      logger.error('Database query failed', { text: text.substring(0, 80), error: (error as Error).message });
      throw error;
    }
  }

  getPool(): Pool {
    return this.pool;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async close(): Promise<void> {
    await this.pool.end();
    this.connected = false;
    logger.info('Database connection closed');
  }
}

export const db = new DatabaseService();
