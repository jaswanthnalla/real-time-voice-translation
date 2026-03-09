import request from 'supertest';

jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../src/server/services/database.service', () => ({
  db: {
    query: jest.fn(),
    isConnected: jest.fn().mockReturnValue(true),
    initialize: jest.fn(),
    close: jest.fn(),
  },
}));

jest.mock('../../src/server/services/redis.service', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    isReady: jest.fn().mockReturnValue(true),
    connect: jest.fn(),
    disconnect: jest.fn(),
  },
}));

jest.mock('../../src/server/services/session.service');
jest.mock('../../src/server/services/translation.service');

import { app } from '../../src/server/app';

describe('Express App', () => {
  it('serves health check at /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBeDefined();
  });

  it('sets security headers via helmet', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('enables CORS', async () => {
    const res = await request(app)
      .options('/health')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  it('parses JSON request bodies', async () => {
    const res = await request(app)
      .post('/api/webhook/status')
      .send({ CallSid: 'CA123', CallStatus: 'completed' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
  });

  it('serves Swagger docs at /api-docs', async () => {
    const res = await request(app).get('/api-docs/');
    // Swagger UI returns HTML
    expect(res.status).toBe(200);
    expect(res.type).toMatch(/html/);
  });

  it('applies rate limiting on /api/ routes', async () => {
    // Make enough requests to verify rate limiter headers
    const res = await request(app).get('/api/sessions/test');
    expect(res.headers['ratelimit-limit']).toBeDefined();
  });

  it('returns 401 for unauthenticated API routes', async () => {
    const res = await request(app)
      .post('/api/translate')
      .send({ text: 'test', sourceLang: 'en', targetLang: 'es' });
    expect(res.status).toBe(401);
  });

  it('handles errors with error middleware', async () => {
    const res = await request(app).get('/api/sessions/nonexistent');
    // Should get 401 (auth middleware) rather than crash
    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/nonexistent-path');
    // Express returns 404 for unmatched routes
    expect(res.status).toBe(404);
  });
});
