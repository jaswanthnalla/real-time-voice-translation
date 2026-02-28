import { Router, Request, Response } from 'express';
import twilio from 'twilio';
import { config } from '../../config';
import { sessionManager } from '../services/session';
import { AppError } from '../middleware/errorHandler';
import logger from '../../utils/logger';
import type { LanguageCode } from '../../types';

export const callsRouter = Router();

const log = logger.child({ service: 'calls-routes' });

/**
 * POST /api/calls/initiate
 * Start a new translated call between two parties.
 */
callsRouter.post('/initiate', async (req: Request, res: Response) => {
  const { to, sourceLanguage, targetLanguage } = req.body as {
    to: string;
    sourceLanguage: LanguageCode;
    targetLanguage: LanguageCode;
  };

  if (!to || !sourceLanguage || !targetLanguage) {
    throw new AppError('Missing required fields: to, sourceLanguage, targetLanguage', 400);
  }

  log.info(`Initiating call to ${to}: ${sourceLanguage} → ${targetLanguage}`);

  try {
    const client = twilio(config.twilio.accountSid, config.twilio.authToken);

    const call = await client.calls.create({
      to,
      from: config.twilio.phoneNumber,
      url: `https://${config.server.host}:${config.server.port}/api/twilio/voice/outbound`,
      statusCallback: `https://${config.server.host}:${config.server.port}/api/twilio/voice/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    });

    log.info(`Call created: ${call.sid}`);

    res.json({
      success: true,
      data: {
        callSid: call.sid,
        status: call.status,
        from: config.twilio.phoneNumber,
        to,
        sourceLanguage,
        targetLanguage,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to initiate call';
    log.error(`Call initiation failed: ${message}`);
    throw new AppError(message, 500);
  }
});

/**
 * GET /api/calls/active
 * List all active translation sessions.
 */
callsRouter.get('/active', (_req: Request, res: Response) => {
  const sessions = sessionManager.getActiveSessions();

  res.json({
    success: true,
    data: sessions.map((s) => ({
      id: s.id,
      callSid: s.callSid,
      callerA: s.callerA,
      callerB: s.callerB,
      status: s.status,
      startTime: s.startTime,
      duration: Math.floor((Date.now() - s.startTime.getTime()) / 1000),
    })),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/calls/:sessionId
 * Get details of a specific translation session.
 */
callsRouter.get('/:sessionId', (req: Request, res: Response) => {
  const session = sessionManager.getSession(req.params.sessionId);

  if (!session) {
    throw new AppError('Session not found', 404);
  }

  res.json({
    success: true,
    data: {
      ...session,
      duration: Math.floor((Date.now() - session.startTime.getTime()) / 1000),
      transcriptCount: session.transcriptA.length + session.transcriptB.length,
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/calls/:sessionId/end
 * End a translation session.
 */
callsRouter.post('/:sessionId/end', (req: Request, res: Response) => {
  const session = sessionManager.getSession(req.params.sessionId);

  if (!session) {
    throw new AppError('Session not found', 404);
  }

  sessionManager.endSession(req.params.sessionId);

  res.json({
    success: true,
    data: { message: 'Session ended', sessionId: req.params.sessionId },
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/calls/:sessionId/transcript
 * Get the full transcript for a session.
 */
callsRouter.get('/:sessionId/transcript', (req: Request, res: Response) => {
  const session = sessionManager.getSession(req.params.sessionId);

  if (!session) {
    throw new AppError('Session not found', 404);
  }

  const allEntries = [...session.transcriptA, ...session.transcriptB]
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  res.json({
    success: true,
    data: {
      sessionId: session.id,
      entries: allEntries,
      totalEntries: allEntries.length,
    },
    timestamp: new Date().toISOString(),
  });
});
