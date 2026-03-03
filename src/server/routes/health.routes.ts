import { Router, Request, Response } from 'express';
import { metricsRegistry } from '../../utils/metrics';
import { sessionService } from '../services/session.service';
import { db } from '../services/database.service';
import { redis } from '../services/redis.service';
import { HealthCheckResponse } from '../../types';

const router = Router();
const startTime = Date.now();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Full health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service health status
 */
router.get('/health', (_req: Request, res: Response) => {
  const response: HealthCheckResponse = {
    status: 'healthy',
    version: '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    checks: {
      server: { status: 'up' },
      database: {
        status: db.isConnected() ? 'up' : 'down',
        message: db.isConnected() ? 'connected' : 'disconnected (in-memory mode)',
      },
      redis: {
        status: redis.isReady() ? 'up' : 'down',
        message: redis.isReady() ? 'connected' : 'disconnected (local cache only)',
      },
      activeSessions: {
        status: 'up',
        message: `${sessionService.getActiveCount()} active sessions`,
      },
    },
  };

  res.json(response);
});

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Kubernetes readiness probe
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 */
router.get('/health/ready', (_req: Request, res: Response) => {
  res.json({ status: 'ready', timestamp: new Date().toISOString() });
});

/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: Kubernetes liveness probe
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get('/health/live', (_req: Request, res: Response) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Prometheus metrics endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Prometheus metrics
 */
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
