import express from 'express';
import request from 'supertest';
import Joi from 'joi';
import { validate } from '../../../src/server/middleware/validation.middleware';
import { errorHandler } from '../../../src/server/middleware/error.middleware';

const testSchema = Joi.object({
  name: Joi.string().required(),
  age: Joi.number().min(0).required(),
});

const app = express();
app.use(express.json());

app.post('/test', validate(testSchema), (_req, res) => {
  res.json({ success: true, data: _req.body });
});

app.use(errorHandler);

describe('Validation Middleware', () => {
  it('should pass valid requests', async () => {
    const res = await request(app)
      .post('/test')
      .send({ name: 'Alice', age: 30 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should reject requests with missing fields', async () => {
    const res = await request(app)
      .post('/test')
      .send({ name: 'Alice' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject requests with invalid values', async () => {
    const res = await request(app)
      .post('/test')
      .send({ name: 'Alice', age: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should strip unknown fields', async () => {
    const res = await request(app)
      .post('/test')
      .send({ name: 'Alice', age: 25, extra: 'field' });

    expect(res.status).toBe(200);
    expect(res.body.data).not.toHaveProperty('extra');
  });
});
