import WebSocket from 'ws';
import { logger } from '../../utils/logger';
import { websocketConnectionsGauge } from '../../utils/metrics';
import { PipelineService } from '../services/pipeline.service';
import { sessionService } from '../services/session.service';
import {
  TwilioMediaMessage,
  TwilioOutboundMessage,
  TwilioStreamStart,
} from '../../types';
import { DEFAULT_SOURCE_LANG, DEFAULT_TARGET_LANG } from '../../shared/constants';

export function handleMediaStream(ws: WebSocket): void {
  let streamSid: string = '';
  let callSid: string = '';
  let pipeline: PipelineService | null = null;
  let sessionId: string = '';

  websocketConnectionsGauge.inc();
  logger.info('New media stream connection');

  ws.on('message', (data: WebSocket.Data) => {
    let message: TwilioMediaMessage;
    try {
      message = JSON.parse(data.toString());
    } catch {
      logger.warn('Invalid WebSocket message received');
      return;
    }

    switch (message.event) {
      case 'connected':
        logger.info('Twilio media stream connected');
        break;

      case 'start':
        handleStart(message.start!);
        break;

      case 'media':
        handleMedia(message.media!.payload);
        break;

      case 'stop':
        handleStop();
        break;

      default:
        logger.debug('Unhandled media stream event', { event: message.event });
    }
  });

  ws.on('close', () => {
    websocketConnectionsGauge.dec();
    cleanup();
    logger.info('Media stream disconnected', { streamSid });
  });

  ws.on('error', (error: Error) => {
    logger.error('Media stream WebSocket error', { error: error.message });
    cleanup();
  });

  function handleStart(start: TwilioStreamStart): void {
    streamSid = start.streamSid;
    callSid = start.callSid;

    const sourceLang = start.customParameters?.sourceLang || DEFAULT_SOURCE_LANG;
    const targetLang = start.customParameters?.targetLang || DEFAULT_TARGET_LANG;

    logger.info('Media stream started', {
      streamSid,
      callSid,
      sourceLang,
      targetLang,
    });

    // Create or find session
    const existingSession = sessionService.getByCallSid(callSid);
    if (existingSession) {
      sessionId = existingSession.id;
      sessionService.update(sessionId, { streamSid });
    } else {
      const session = sessionService.create({
        sourceLang,
        targetLang,
      });
      sessionId = session.id;
      sessionService.update(sessionId, { callSid, streamSid });
    }

    // Create and start translation pipeline
    pipeline = new PipelineService({ sourceLang, targetLang });

    pipeline.on('translated-audio', (result: { audioContent: Buffer }) => {
      sendAudio(result.audioContent);
    });

    pipeline.on('transcript', (entry: {
      originalText: string;
      translatedText: string;
      sourceLang: string;
      targetLang: string;
    }) => {
      sessionService.addTranscript(sessionId, {
        timestamp: new Date(),
        speaker: 'caller',
        ...entry,
      });
    });

    pipeline.on('error', (error: Error) => {
      logger.error('Pipeline error during call', {
        error: error.message,
        callSid,
      });
    });

    pipeline.start();
  }

  function handleMedia(payload: string): void {
    if (!pipeline) return;

    const audioBuffer = Buffer.from(payload, 'base64');
    pipeline.processAudio(audioBuffer);
  }

  function sendAudio(audioContent: Buffer): void {
    if (ws.readyState !== WebSocket.OPEN || !streamSid) return;

    const payload = audioContent.toString('base64');
    const message: TwilioOutboundMessage = {
      event: 'media',
      streamSid,
      media: { payload },
    };

    ws.send(JSON.stringify(message));
  }

  function handleStop(): void {
    logger.info('Media stream stopped', { streamSid, callSid });
    cleanup();
  }

  function cleanup(): void {
    if (pipeline) {
      pipeline.stop();
      pipeline = null;
    }
    if (sessionId) {
      sessionService.complete(sessionId);
    }
  }
}
