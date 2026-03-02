import { Router, Request, Response } from 'express';
import { metricsRegistry } from '../../utils/metrics';
import { sessionService } from '../services/session.service';
import { HealthCheckResponse } from '../../types';

const router = Router();
const startTime = Date.now();

router.get('/health', (_req: Request, res: Response) => {
  const response: HealthCheckResponse = {
    status: 'healthy',
    version: '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    checks: {
      server: { status: 'up' },
      activeSessions: {
        status: 'up',
        message: `${sessionService.getActiveCount()} active sessions`,
      },
    },
  };

  res.json(response);
});

router.get('/health/ready', (_req: Request, res: Response) => {
  res.json({ status: 'ready', timestamp: new Date().toISOString() });
});

router.get('/health/live', (_req: Request, res: Response) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

router.get('/metrics', async (_req: Request, res: Response) => {
  try {
    const metrics = await metricsRegistry.metrics();
    res.set('Content-Type', metricsRegistry.contentType);
    res.send(metrics);
  } catch (error) {
    res.status(500).send('Error collecting metrics');
  }
});

export { router as healthRoutes };
