import { Router, Request, Response } from 'express';
import { getMetricsRegistry } from '../../utils/metrics';

const router = Router();

router.get('/metrics', async (_req: Request, res: Response) => {
  const registry = getMetricsRegistry();
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
});

export default router;
