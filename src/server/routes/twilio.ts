import { Router, Request, Response } from 'express';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';
import { config } from '../../config';
import { validateTwilioSignature } from '../middleware/auth';
import logger from '../../utils/logger';

export const twilioRouter = Router();

const log = logger.child({ service: 'twilio-routes' });

/**
 * POST /api/twilio/voice
 * Twilio calls this when an incoming call arrives.
 * Returns TwiML to start a media stream and connect the call.
 */
twilioRouter.post('/voice', validateTwilioSignature, (req: Request, res: Response) => {
  const callSid = req.body.CallSid as string;
  const from = req.body.From as string;
  const to = req.body.To as string;

  log.info(`Incoming call: ${callSid} from ${from} to ${to}`);

  const response = new VoiceResponse();

  // Greet the caller
  response.say(
    { voice: 'Polly.Joanna', language: 'en-US' },
    'Welcome to real-time voice translation. Connecting your translated call now.',
  );

  // Start bidirectional media stream to our WebSocket server
  const wsUrl = `wss://${config.server.host}:${config.server.wsPort}/media-stream`;

  const start = response.start();
  start.stream({
    url: wsUrl,
    track: 'both_tracks',
  });

  // Connect to the other party (or conference)
  const dial = response.dial({
    callerId: config.twilio.phoneNumber,
  });
  dial.number(to);

  res.type('text/xml');
  res.send(response.toString());
});

/**
 * POST /api/twilio/voice/status
 * Twilio calls this when call status changes.
 */
twilioRouter.post('/voice/status', validateTwilioSignature, (req: Request, res: Response) => {
  const callSid = req.body.CallSid as string;
  const callStatus = req.body.CallStatus as string;

  log.info(`Call status update: ${callSid} → ${callStatus}`);

  res.sendStatus(200);
});

/**
 * POST /api/twilio/voice/outbound
 * Initiate an outbound translated call.
 */
twilioRouter.post('/voice/outbound', (req: Request, res: Response) => {
  const { to, sourceLanguage, targetLanguage } = req.body as {
    to: string;
    sourceLanguage: string;
    targetLanguage: string;
  };

  log.info(`Outbound call request: to=${to}, ${sourceLanguage} → ${targetLanguage}`);

  const response = new VoiceResponse();

  response.say(
    { voice: 'Polly.Joanna' },
    'Your translated call is being connected. Please wait.',
  );

  const wsUrl = `wss://${config.server.host}:${config.server.wsPort}/media-stream?sourceLang=${sourceLanguage}&targetLang=${targetLanguage}`;

  const start = response.start();
  start.stream({
    url: wsUrl,
    track: 'both_tracks',
  });

  const dial = response.dial({ callerId: config.twilio.phoneNumber });
  dial.number(to);

  res.type('text/xml');
  res.send(response.toString());
});
