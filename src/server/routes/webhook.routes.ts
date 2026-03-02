import { Router, Request, Response } from 'express';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { DEFAULT_SOURCE_LANG, DEFAULT_TARGET_LANG } from '../../shared/constants';

const router = Router();

router.post('/webhook/voice', (req: Request, res: Response) => {
  const sourceLang = (req.query.sourceLang as string) || DEFAULT_SOURCE_LANG;
  const targetLang = (req.query.targetLang as string) || DEFAULT_TARGET_LANG;

  logger.info('Incoming call webhook', {
    from: req.body?.From,
    to: req.body?.To,
    callSid: req.body?.CallSid,
    sourceLang,
    targetLang,
  });

  const wsUrl = config.twilio.webhookUrl
    ? config.twilio.webhookUrl.replace(/^http/, 'ws') + '/media-stream'
    : `wss://${req.headers.host}/media-stream`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connecting your translated call. Please wait.</Say>
  <Start>
    <Stream url="${wsUrl}">
      <Parameter name="sourceLang" value="${sourceLang}" />
      <Parameter name="targetLang" value="${targetLang}" />
    </Stream>
  </Start>
  <Pause length="3600" />
</Response>`;

  res.type('text/xml');
  res.send(twiml);
});

router.post('/webhook/status', (req: Request, res: Response) => {
  logger.info('Call status update', {
    callSid: req.body?.CallSid,
    callStatus: req.body?.CallStatus,
  });
  res.sendStatus(200);
});

export { router as webhookRoutes };
