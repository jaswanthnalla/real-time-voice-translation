import express from 'express';
import request from 'supertest';
import { healthRoutes } from '../../../src/server/routes/health.routes';

const app = express();
app.use(healthRoutes);

describe('Health Routes', () => {
  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.version).toBe('1.0.0');
      expect(res.body.uptime).toBeGreaterThanOrEqual(0);
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.checks).toBeDefined();
      expect(res.body.checks.server.status).toBe('up');
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready status', async () => {
      const res = await request(app).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
    });
  });

  describe('GET /health/live', () => {
    it('should return alive status', async () => {
      const res = await request(app).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('alive');
    });
  });

  describe('GET /metrics', () => {
    it('should return prometheus metrics', async () => {
      const res = await request(app).get('/metrics');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text/);
    });
  });
});
