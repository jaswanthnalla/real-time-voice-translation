import express from 'express';
import request from 'supertest';

jest.mock('../../../src/server/services/translation.service');

import { TranslationService } from '../../../src/server/services/translation.service';

const mockTranslate = jest.fn();
(TranslationService as jest.Mock).mockImplementation(() => ({
  translate: mockTranslate,
}));

import { translateRoutes } from '../../../src/server/routes/translate.routes';
import { errorHandler } from '../../../src/server/middleware/error.middleware';

const app = express();
app.use(express.json());
app.use('/api', translateRoutes);
app.use(errorHandler);

describe('Translate Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /api/translate returns translated text', async () => {
    mockTranslate.mockResolvedValue({
      translatedText: 'Hola mundo',
      sourceLang: 'en',
      targetLang: 'es',
      confidence: 0.95,
    });

    const res = await request(app)
      .post('/api/translate')
      .send({ text: 'Hello world', sourceLang: 'en', targetLang: 'es' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.translatedText).toBe('Hola mundo');
    expect(mockTranslate).toHaveBeenCalledWith('Hello world', 'en', 'es');
  });

  it('POST /api/translate rejects missing text', async () => {
    const res = await request(app)
      .post('/api/translate')
      .send({ sourceLang: 'en', targetLang: 'es' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/translate rejects invalid language code', async () => {
    const res = await request(app)
      .post('/api/translate')
      .send({ text: 'Hello', sourceLang: 'xx', targetLang: 'es' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/translate rejects empty text', async () => {
    const res = await request(app)
      .post('/api/translate')
      .send({ text: '', sourceLang: 'en', targetLang: 'es' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/translate handles service errors', async () => {
    mockTranslate.mockRejectedValue(new Error('Translation API down'));

    const app2 = express();
    app2.use(express.json());
    app2.use('/api', translateRoutes);
    app2.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ success: false, error: { message: err.message } });
    });

    const res = await request(app2)
      .post('/api/translate')
      .send({ text: 'Hello', sourceLang: 'en', targetLang: 'es' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
