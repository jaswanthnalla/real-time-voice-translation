import http from 'http';
import { Server, Socket } from 'socket.io';
import { logger } from '../../utils/logger';
import { websocketConnectionsGauge } from '../../utils/metrics';
import { sessionService } from '../services/session.service';
import { PipelineService } from '../services/pipeline.service';
import { SUPPORTED_LANGUAGES } from '../../shared/constants';

interface JoinSessionPayload {
  sourceLang: string;
  targetLang: string;
}

interface AudioChunkPayload {
  audioData: string; // base64
  sourceLang: string;
  targetLang: string;
}

export function setupSocketIOServer(server: http.Server): Server {
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    websocketConnectionsGauge.inc();
    logger.info('Socket.IO client connected', { socketId: socket.id });

    let pipeline: PipelineService | null = null;
    let sessionId: string = '';

    socket.on('join_session', (payload: JoinSessionPayload) => {
      const { sourceLang, targetLang } = payload;

      if (!SUPPORTED_LANGUAGES[sourceLang] || !SUPPORTED_LANGUAGES[targetLang]) {
        socket.emit('error_message', { message: 'Unsupported language' });
        return;
      }

      // Clean up any existing pipeline
      if (pipeline) {
        pipeline.stop();
        pipeline = null;
      }
      if (sessionId) {
        sessionService.complete(sessionId);
      }

      // Create session
      const session = sessionService.create({ sourceLang, targetLang });
      sessionId = session.id;

      // Create pipeline for browser audio (WEBM_OPUS from MediaRecorder)
      pipeline = new PipelineService({
        sourceLang,
        targetLang,
        audioOptions: {
          encoding: 'WEBM_OPUS',
          sampleRateHertz: 48000,
          model: 'latest_long',
        },
        ttsAudioOptions: {
          audioEncoding: 'MP3',
          sampleRateHertz: 24000,
        },
      });

      pipeline.on('interim', (data: { transcript: string }) => {
        socket.emit('translation_interim', {
          interimText: data.transcript,
          sourceLang,
        });
      });

      pipeline.on('translated-audio', (result) => {
        const base64Audio = result.audioContent.toString('base64');
        socket.emit('translation_result', {
          originalText: result.sttResult.transcript,
          translatedText: result.translationResult.translatedText,
          sourceLang,
          targetLang,
          audioData: base64Audio,
        });
      });

      pipeline.on('transcript', (entry) => {
        sessionService.addTranscript(sessionId, {
          timestamp: new Date(),
          speaker: 'caller',
          ...entry,
        });
      });

      pipeline.on('error', (error: Error) => {
        logger.error('Browser pipeline error', {
          error: error.message,
          sessionId,
        });
        socket.emit('error_message', { message: 'Translation error' });
      });

      pipeline.start();

      socket.emit('session_joined', {
        sessionId: session.id,
        sourceLang,
        targetLang,
      });

      logger.info('Browser session started', { sessionId, sourceLang, targetLang });
    });

    socket.on('audio_chunk', (payload: AudioChunkPayload) => {
      if (!pipeline) return;

      try {
        const audioBuffer = Buffer.from(payload.audioData, 'base64');
        pipeline.processAudio(audioBuffer);
      } catch (error) {
        logger.error('Error processing audio chunk', {
          error: (error as Error).message,
        });
      }
    });

    socket.on('leave_session', () => {
      cleanup();
      logger.info('Client left session', { sessionId });
    });

    socket.on('disconnect', () => {
      websocketConnectionsGauge.dec();
      cleanup();
      logger.info('Socket.IO client disconnected', { socketId: socket.id });
    });

    function cleanup(): void {
      if (pipeline) {
        pipeline.stop();
        pipeline = null;
      }
      if (sessionId) {
        sessionService.complete(sessionId);
        sessionId = '';
      }
    }
  });

  logger.info('Socket.IO server attached');
  return io;
}
