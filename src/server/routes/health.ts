import { Router, Request, Response } from 'express';
import { sessionManager } from '../services/session';

export const healthRouter = Router();

const startTime = Date.now();

healthRouter.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
    },
    timestamp: new Date().toISOString(),
  });
});

healthRouter.get('/detailed', (_req: Request, res: Response) => {
  const memUsage = process.memoryUsage();
  const sessions = sessionManager.getActiveSessions();

  res.json({
    success: true,
    data: {
      status: 'healthy',
      uptime: Math.floor((Date.now() - startTime) / 1000),
      activeSessions: sessions.length,
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
        rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
      },
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    },
    timestamp: new Date().toISOString(),
  });
});
