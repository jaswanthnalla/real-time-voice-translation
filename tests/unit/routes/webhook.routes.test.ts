import express from 'express';
import request from 'supertest';

jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../../../src/config', () => ({
  config: {
    twilio: {
      webhookUrl: '',
    },
  },
}));

import { webhookRoutes } from '../../../src/server/routes/webhook.routes';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', webhookRoutes);

describe('Webhook Routes', () => {
  it('POST /api/webhook/voice returns TwiML response', async () => {
    const res = await request(app)
      .post('/api/webhook/voice')
      .send({ From: '+1111111111', To: '+2222222222', CallSid: 'CA123' });

    expect(res.status).toBe(200);
    expect(res.type).toContain('xml');
    expect(res.text).toContain('<Response>');
    expect(res.text).toContain('<Stream');
    expect(res.text).toContain('<Say>');
  });

  it('POST /api/webhook/voice uses query param languages', async () => {
    const res = await request(app)
      .post('/api/webhook/voice?sourceLang=fr&targetLang=de')
      .send({ From: '+1111111111', To: '+2222222222', CallSid: 'CA456' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('value="fr"');
    expect(res.text).toContain('value="de"');
  });

  it('POST /api/webhook/voice defaults to en/es when no lang params', async () => {
    const res = await request(app)
      .post('/api/webhook/voice')
      .send({});

    expect(res.status).toBe(200);
    expect(res.text).toContain('value="en"');
    expect(res.text).toContain('value="es"');
  });

  it('POST /api/webhook/status returns 200', async () => {
    const res = await request(app)
      .post('/api/webhook/status')
      .send({ CallSid: 'CA789', CallStatus: 'completed' });

    expect(res.status).toBe(200);
  });
});
