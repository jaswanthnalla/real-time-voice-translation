import { Router, Request, Response } from 'express';
import * as databaseService from '../services/database.service';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  const dbHealthy = await databaseService.healthCheck();
  const status = dbHealthy ? 'healthy' : 'degraded';
  const statusCode = dbHealthy ? 200 : 503;

  res.status(statusCode).json({
    status,
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'connected' : 'disconnected',
    },
  });
});

router.get('/health/ready', async (_req: Request, res: Response) => {
  const dbHealthy = await databaseService.healthCheck();
  if (dbHealthy) {
    res.json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready' });
  }
});

router.get('/health/live', (_req: Request, res: Response) => {
  res.json({ status: 'alive' });
});

export default router;
