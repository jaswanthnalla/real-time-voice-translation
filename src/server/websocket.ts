import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Server as SocketIOServer } from 'socket.io';
import { createServiceLogger } from '../utils/logger';
import { sessionManager } from './services/session';
import { TranslationPipeline } from './services/pipeline';
import type { TwilioStreamMessage, LanguageCode } from '../types';

const log = createServiceLogger('websocket');

/**
 * WebSocket handler for the voice translation system.
 *
 * Two WebSocket servers:
 *
 * 1. **ws (raw WebSocket)** — Receives audio from Twilio Media Streams.
 *    Twilio sends mulaw 8kHz audio in real-time, which we feed into
 *    the translation pipeline (STT → Translate → TTS).
 *
 * 2. **Socket.IO** — Connects to the React frontend for:
 *    - Live subtitle streaming (both original and translated text)
 *    - Translated audio delivery for browser playback
 *    - Session status updates
 *    - Browser-based audio capture (for web-to-web calls)
 */

interface ActiveCall {
  sessionId: string;
  streamSid: string;
  pipelineAtoB: TranslationPipeline; // Speaker A's audio → translated for B
  pipelineBtoA: TranslationPipeline; // Speaker B's audio → translated for A
}

const activeCalls = new Map<string, ActiveCall>();

// ─────────────────────────────────────────────────────────
// 1. Twilio Media Stream WebSocket Server
// ─────────────────────────────────────────────────────────

export function createTwilioWSServer(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/media-stream' });

  wss.on('connection', (ws: WebSocket, req) => {
    log.info('Twilio media stream connected');

    // Parse language params from URL
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const sourceLang = (url.searchParams.get('sourceLang') || 'en') as LanguageCode;
    const targetLang = (url.searchParams.get('targetLang') || 'es') as LanguageCode;

    let callState: ActiveCall | null = null;

    ws.on('message', (data: Buffer) => {
      try {
        const msg: TwilioStreamMessage = JSON.parse(data.toString());
        handleTwilioMessage(ws, msg, sourceLang, targetLang, callState, (state) => {
          callState = state;
        });
      } catch (err) {
        log.error(`Failed to parse Twilio message: ${err}`);
      }
    });

    ws.on('close', () => {
      log.info('Twilio media stream disconnected');
      if (callState) {
        cleanupCall(callState);
      }
    });

    ws.on('error', (err) => {
      log.error(`Twilio WS error: ${err.message}`);
    });
  });

  log.info('Twilio WebSocket server created on /media-stream');
  return wss;
}

function handleTwilioMessage(
  ws: WebSocket,
  msg: TwilioStreamMessage,
  sourceLang: LanguageCode,
  targetLang: LanguageCode,
  callState: ActiveCall | null,
  setCallState: (state: ActiveCall) => void,
): void {
  switch (msg.event) {
    case 'connected':
      log.info('Twilio stream connected event');
      break;

    case 'start': {
      if (!msg.start) break;
      const { callSid, streamSid } = msg.start;
      log.info(`Stream started: call=${callSid}, stream=${streamSid}`);

      // Create translation session
      const session = sessionManager.createSession({
        callSid,
        streamSid,
        callerA: { phoneNumber: 'caller-a', language: sourceLang },
        callerB: { phoneNumber: 'caller-b', language: targetLang },
      });

      // Create bidirectional pipelines
      const pipelineAtoB = new TranslationPipeline({
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        speaker: 'A',
        voiceGender: 'FEMALE',
      });

      const pipelineBtoA = new TranslationPipeline({
        sourceLanguage: targetLang,
        targetLanguage: sourceLang,
        speaker: 'B',
        voiceGender: 'MALE',
      });

      const state: ActiveCall = {
        sessionId: session.id,
        streamSid,
        pipelineAtoB,
        pipelineBtoA,
      };

      // Wire pipeline audio output → inject back into Twilio call
      wirePhonePipelineOutput(ws, state);

      // Wire pipeline subtitles → Socket.IO clients
      wireSubtitleOutput(state);

      pipelineAtoB.start();
      pipelineBtoA.start();
      sessionManager.activateSession(session.id);

      activeCalls.set(streamSid, state);
      setCallState(state);
      break;
    }

    case 'media': {
      if (!msg.media || !callState) break;

      // Decode base64 mulaw audio from Twilio
      const audioBuffer = Buffer.from(msg.media.payload, 'base64');

      // Route to the correct pipeline based on track
      if (msg.media.track === 'inbound') {
        callState.pipelineAtoB.processAudio(audioBuffer);
      } else if (msg.media.track === 'outbound') {
        callState.pipelineBtoA.processAudio(audioBuffer);
      }
      break;
    }

    case 'stop':
      log.info(`Stream stopped: ${msg.streamSid}`);
      if (callState) {
        cleanupCall(callState);
      }
      break;

    case 'mark':
      // Audio playback mark - can be used for timing sync
      break;
  }
}

/**
 * Send translated audio back to Twilio to be played to the other caller.
 * This is how the natural AI voice is heard by both parties.
 */
function wirePhonePipelineOutput(ws: WebSocket, call: ActiveCall): void {
  // When pipeline A→B produces audio, send it to Twilio for Speaker B to hear
  call.pipelineAtoB.on('audio', (audioEvent) => {
    if (ws.readyState === WebSocket.OPEN) {
      const mediaMsg = JSON.stringify({
        event: 'media',
        streamSid: call.streamSid,
        media: {
          payload: audioEvent.audioContent,
        },
      });
      ws.send(mediaMsg);
    }
  });

  // When pipeline B→A produces audio, send it to Twilio for Speaker A to hear
  call.pipelineBtoA.on('audio', (audioEvent) => {
    if (ws.readyState === WebSocket.OPEN) {
      const mediaMsg = JSON.stringify({
        event: 'media',
        streamSid: call.streamSid,
        media: {
          payload: audioEvent.audioContent,
        },
      });
      ws.send(mediaMsg);
    }
  });
}

/**
 * Forward subtitle events from pipelines to Socket.IO for the frontend.
 */
function wireSubtitleOutput(call: ActiveCall): void {
  const emitSubtitle = (subtitleData: unknown): void => {
    if (ioServer) {
      ioServer.to(`session:${call.sessionId}`).emit('subtitle', subtitleData);
    }
  };

  call.pipelineAtoB.on('subtitle', emitSubtitle);
  call.pipelineBtoA.on('subtitle', emitSubtitle);

  // Also forward full results for transcript building
  call.pipelineAtoB.on('result', (result) => {
    sessionManager.addTranscript(
      call.sessionId, 'A',
      result.stt.transcript,
      result.translation.translatedText,
      result.stt.confidence,
    );
    if (ioServer) {
      ioServer.to(`session:${call.sessionId}`).emit('pipeline:result', {
        speaker: 'A',
        ...result,
      });
    }
  });

  call.pipelineBtoA.on('result', (result) => {
    sessionManager.addTranscript(
      call.sessionId, 'B',
      result.stt.transcript,
      result.translation.translatedText,
      result.stt.confidence,
    );
    if (ioServer) {
      ioServer.to(`session:${call.sessionId}`).emit('pipeline:result', {
        speaker: 'B',
        ...result,
      });
    }
  });
}

function cleanupCall(call: ActiveCall): void {
  call.pipelineAtoB.stop();
  call.pipelineBtoA.stop();
  sessionManager.endSession(call.sessionId);
  activeCalls.delete(call.streamSid);
  log.info(`Call cleaned up: ${call.sessionId}`);
}

// ─────────────────────────────────────────────────────────
// 2. Socket.IO Server (Frontend Communication)
// ─────────────────────────────────────────────────────────

let ioServer: SocketIOServer | null = null;

export function createSocketIOServer(server: HttpServer): SocketIOServer {
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  ioServer = io;

  io.on('connection', (socket) => {
    log.info(`Client connected: ${socket.id}`);

    // ── Join a session room to receive subtitles and audio ──
    socket.on('join:session', (sessionId: string) => {
      socket.join(`session:${sessionId}`);
      log.info(`Client ${socket.id} joined session: ${sessionId}`);

      const session = sessionManager.getSession(sessionId);
      if (session) {
        socket.emit('session:info', {
          id: session.id,
          status: session.status,
          callerA: session.callerA,
          callerB: session.callerB,
          startTime: session.startTime,
        });
      }
    });

    // ── Browser-based audio capture (web-to-web calls) ──
    socket.on('audio:chunk', (data: {
      sessionId: string;
      speaker: 'A' | 'B';
      audio: string; // base64 audio
    }) => {
      const call = findCallBySessionId(data.sessionId);
      if (!call) return;

      const audioBuffer = Buffer.from(data.audio, 'base64');

      if (data.speaker === 'A') {
        call.pipelineAtoB.processAudio(audioBuffer);
      } else {
        call.pipelineBtoA.processAudio(audioBuffer);
      }
    });

    // ── Start a browser-based translation session ──
    socket.on('session:start', (params: {
      sourceLanguage: LanguageCode;
      targetLanguage: LanguageCode;
    }) => {
      const session = sessionManager.createSession({
        callSid: `web-${socket.id}`,
        streamSid: `ws-${socket.id}`,
        callerA: { phoneNumber: 'browser-user-a', language: params.sourceLanguage },
        callerB: { phoneNumber: 'browser-user-b', language: params.targetLanguage },
      });

      const pipelineAtoB = new TranslationPipeline({
        sourceLanguage: params.sourceLanguage,
        targetLanguage: params.targetLanguage,
        speaker: 'A',
      });

      const pipelineBtoA = new TranslationPipeline({
        sourceLanguage: params.targetLanguage,
        targetLanguage: params.sourceLanguage,
        speaker: 'B',
      });

      const call: ActiveCall = {
        sessionId: session.id,
        streamSid: `ws-${socket.id}`,
        pipelineAtoB,
        pipelineBtoA,
      };

      // Wire audio output → Socket.IO (for browser playback)
      wireBrowserPipelineOutput(socket, call);
      wireSubtitleOutput(call);

      pipelineAtoB.start();
      pipelineBtoA.start();
      sessionManager.activateSession(session.id);
      activeCalls.set(call.streamSid, call);

      socket.join(`session:${session.id}`);
      socket.emit('session:created', {
        sessionId: session.id,
        sourceLanguage: params.sourceLanguage,
        targetLanguage: params.targetLanguage,
      });

      log.info(`Browser session created: ${session.id}`);
    });

    socket.on('session:end', (sessionId: string) => {
      const call = findCallBySessionId(sessionId);
      if (call) {
        cleanupCall(call);
      }
      socket.emit('session:ended', { sessionId });
    });

    socket.on('disconnect', () => {
      log.info(`Client disconnected: ${socket.id}`);
    });
  });

  log.info('Socket.IO server created');
  return io;
}

/**
 * Send translated audio to the browser client for playback.
 * The frontend will play this through the Web Audio API.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wireBrowserPipelineOutput(socket: { id: string; emit: (event: string, data: any) => void }, call: ActiveCall): void {
  call.pipelineAtoB.on('audio', (audioEvent) => {
    socket.emit('audio:translated', {
      speaker: 'A',
      audioContent: audioEvent.audioContent,
      encoding: audioEvent.encoding,
      sampleRate: audioEvent.sampleRate,
      targetLanguage: audioEvent.targetLanguage,
    });
  });

  call.pipelineBtoA.on('audio', (audioEvent) => {
    socket.emit('audio:translated', {
      speaker: 'B',
      audioContent: audioEvent.audioContent,
      encoding: audioEvent.encoding,
      sampleRate: audioEvent.sampleRate,
      targetLanguage: audioEvent.targetLanguage,
    });
  });
}

function findCallBySessionId(sessionId: string): ActiveCall | undefined {
  for (const call of activeCalls.values()) {
    if (call.sessionId === sessionId) return call;
  }
  return undefined;
}

export function getActiveCallCount(): number {
  return activeCalls.size;
}
