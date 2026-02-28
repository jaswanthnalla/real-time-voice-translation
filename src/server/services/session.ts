import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { createServiceLogger } from '../../utils/logger';
import type {
  TranslationSession,
  SessionStatus,
  LanguageCode,
  TranscriptEntry,
  CallerInfo,
} from '../../types';

const log = createServiceLogger('session-manager');

/**
 * Manages active translation sessions.
 * Tracks call state, participants, language pairs, and transcripts.
 */
export class SessionManager extends EventEmitter {
  private sessions: Map<string, TranslationSession> = new Map();
  /** Map from Twilio streamSid → sessionId for fast lookup */
  private streamToSession: Map<string, string> = new Map();

  /**
   * Create a new translation session for a call.
   */
  createSession(params: {
    callSid: string;
    streamSid: string;
    callerA: CallerInfo;
    callerB: CallerInfo;
  }): TranslationSession {
    const session: TranslationSession = {
      id: uuidv4(),
      callSid: params.callSid,
      streamSid: params.streamSid,
      callerA: params.callerA,
      callerB: params.callerB,
      status: 'initializing',
      startTime: new Date(),
      transcriptA: [],
      transcriptB: [],
    };

    this.sessions.set(session.id, session);
    this.streamToSession.set(params.streamSid, session.id);

    log.info(
      `Session created: ${session.id} | Call: ${params.callSid} | ` +
      `${params.callerA.language} ↔ ${params.callerB.language}`,
    );

    this.emit('session:created', session);
    return session;
  }

  /**
   * Mark session as active (audio streaming started).
   */
  activateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'active';
      this.emit('session:active', session);
      log.info(`Session activated: ${sessionId}`);
    }
  }

  /**
   * End a translation session.
   */
  endSession(sessionId: string): TranslationSession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    session.status = 'ended';
    session.endTime = new Date();

    this.streamToSession.delete(session.streamSid);
    this.emit('session:ended', session);

    const duration = Math.floor((session.endTime.getTime() - session.startTime.getTime()) / 1000);
    log.info(
      `Session ended: ${sessionId} | Duration: ${duration}s | ` +
      `Transcripts: ${session.transcriptA.length + session.transcriptB.length}`,
    );

    // Keep ended sessions in memory for a while for transcript retrieval
    setTimeout(() => {
      this.sessions.delete(sessionId);
      log.debug(`Session cleaned up: ${sessionId}`);
    }, 30 * 60 * 1000); // Keep for 30 minutes

    return session;
  }

  /**
   * Add a transcript entry to a session.
   */
  addTranscript(
    sessionId: string,
    speaker: 'A' | 'B',
    originalText: string,
    translatedText: string,
    confidence: number,
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const entry: TranscriptEntry = {
      timestamp: new Date(),
      speaker,
      originalText,
      translatedText,
      confidence,
    };

    if (speaker === 'A') {
      session.transcriptA.push(entry);
    } else {
      session.transcriptB.push(entry);
    }

    this.emit('transcript:added', { sessionId, entry });
  }

  getSession(sessionId: string): TranslationSession | undefined {
    return this.sessions.get(sessionId);
  }

  getSessionByStreamSid(streamSid: string): TranslationSession | undefined {
    const sessionId = this.streamToSession.get(streamSid);
    return sessionId ? this.sessions.get(sessionId) : undefined;
  }

  getActiveSessions(): TranslationSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === 'active' || s.status === 'initializing',
    );
  }

  updateStatus(sessionId: string, status: SessionStatus): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = status;
      this.emit('session:status', { sessionId, status });
    }
  }

  getLanguages(sessionId: string): { sourceLanguage: LanguageCode; targetLanguage: LanguageCode } | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;
    return {
      sourceLanguage: session.callerA.language,
      targetLanguage: session.callerB.language,
    };
  }
}

// Singleton
export const sessionManager = new SessionManager();
