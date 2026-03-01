import { getPool, initializeDatabase, query, closePool } from '../../config/database';
import { createLogger } from '../../utils/logger';

const logger = createLogger('database');

export async function initialize(): Promise<void> {
  try {
    await initializeDatabase();
    logger.info('Database initialized');
  } catch (error) {
    logger.error('Database initialization failed', { error });
    throw error;
  }
}

export async function healthCheck(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

export async function shutdown(): Promise<void> {
  await closePool();
  logger.info('Database pool closed');
}

export { query, getPool, closePool };
