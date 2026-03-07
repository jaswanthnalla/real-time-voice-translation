import express from 'express';
import request from 'supertest';

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../src/server/services/database.service', () => ({
  db: {
    query: jest.fn(),
    isConnected: jest.fn().mockReturnValue(true),
    initialize: jest.fn(),
    close: jest.fn(),
  },
}));

jest.mock('../../../src/server/services/redis.service', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    isReady: jest.fn().mockReturnValue(true),
    connect: jest.fn(),
    disconnect: jest.fn(),
  },
}));

jest.mock('../../../src/server/services/session.service');
jest.mock('../../../src/server/services/translation.service');

import { routes } from '../../../src/server/routes';
import { errorHandler } from '../../../src/server/middleware/error.middleware';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(routes);
  app.use(errorHandler);
  return app;
}

describe('Routes Index', () => {
  it('mounts health routes at root (public, no auth)', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  it('mounts health readiness at root (public, no auth)', async () => {
    const app = createApp();
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(200);
  });

  it('mounts webhook routes at /api (public, no auth)', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/webhook/status')
      .send({ CallSid: 'CA123', CallStatus: 'completed' });
    expect(res.status).toBe(200);
  });

  it('requires auth for session routes at /api', async () => {
    const app = createApp();
    const res = await request(app).get('/api/sessions/test-id');
    // Should get 401 since no auth header is provided
    expect(res.status).toBe(401);
  });

  it('requires auth for translate routes at /api', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/api/translate')
      .send({ text: 'Hello', sourceLang: 'en', targetLang: 'es' });
    expect(res.status).toBe(401);
  });
});
