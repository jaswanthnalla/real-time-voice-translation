import express from 'express';
import request from 'supertest';
import { sessionRoutes } from '../../../src/server/routes/session.routes';
import { errorHandler } from '../../../src/server/middleware/error.middleware';
import { sessionService } from '../../../src/server/services/session.service';

const app = express();
app.use(express.json());
// Mount without auth middleware for unit testing
app.use('/api', sessionRoutes);
app.use(errorHandler);

beforeEach(() => {
  const sessions = sessionService.list();
  sessions.forEach((s) => sessionService.delete(s.id));
});

describe('Session Routes', () => {
  describe('POST /api/sessions', () => {
    it('should create a new session', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .send({ sourceLang: 'en', targetLang: 'es' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sourceLang).toBe('en');
      expect(res.body.data.targetLang).toBe('es');
      expect(res.body.data.status).toBe('active');
    });

    it('should reject invalid language codes', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .send({ sourceLang: 'xx', targetLang: 'es' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject missing fields', async () => {
      const res = await request(app)
        .post('/api/sessions')
        .send({ sourceLang: 'en' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/sessions', () => {
    it('should list all sessions', async () => {
      sessionService.create({ sourceLang: 'en', targetLang: 'es' });
      sessionService.create({ sourceLang: 'fr', targetLang: 'de' });

      const res = await request(app).get('/api/sessions');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/sessions/:id', () => {
    it('should return a session by id', async () => {
      const session = sessionService.create({ sourceLang: 'en', targetLang: 'es' });

      const res = await request(app).get(`/api/sessions/${session.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(session.id);
    });

    it('should return 404 for nonexistent session', async () => {
      const res = await request(app).get('/api/sessions/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    it('should delete a session', async () => {
      const session = sessionService.create({ sourceLang: 'en', targetLang: 'es' });

      const res = await request(app).delete(`/api/sessions/${session.id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for nonexistent session', async () => {
      const res = await request(app).delete('/api/sessions/nonexistent');

      expect(res.status).toBe(404);
    });
  });
});
