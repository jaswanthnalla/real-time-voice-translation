import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../../../src/server/middleware/auth.middleware';
import { errorHandler } from '../../../src/server/middleware/error.middleware';
import { config } from '../../../src/config';

const app = express();
app.use(express.json());

app.get('/protected', authMiddleware, (_req, res) => {
  res.json({ success: true });
});

app.use(errorHandler);

describe('Auth Middleware', () => {
  it('should reject requests without authorization', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
  });

  it('should accept valid JWT tokens', async () => {
    const token = jwt.sign({ userId: 'user-1' }, config.jwt.secret);

    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should reject invalid JWT tokens', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalid-token');

    expect(res.status).toBe(401);
  });

  it('should accept valid API keys', async () => {
    const res = await request(app)
      .get('/protected')
      .set('x-api-key', 'test-api-key');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
