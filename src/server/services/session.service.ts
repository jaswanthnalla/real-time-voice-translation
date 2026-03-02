import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { activeSessionsGauge } from '../../utils/metrics';
import {
  Session,
  CreateSessionRequest,
  SessionSummary,
  TranscriptEntry,
} from '../../types';

class SessionStore {
  private sessions: Map<string, Session> = new Map();

  create(request: CreateSessionRequest): Session {
    const session: Session = {
      id: uuidv4(),
      callSid: '',
      streamSid: '',
      sourceLang: request.sourceLang,
      targetLang: request.targetLang,
      callerNumber: request.callerNumber,
      calleeNumber: request.calleeNumber,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      transcript: [],
    };

    this.sessions.set(session.id, session);
    activeSessionsGauge.inc();
    logger.info('Session created', { sessionId: session.id });
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  getByCallSid(callSid: string): Session | undefined {
    for (const session of this.sessions.values()) {
      if (session.callSid === callSid) return session;
    }
    return undefined;
  }

  update(id: string, updates: Partial<Session>): Session | undefined {
    const session = this.sessions.get(id);
    if (!session) return undefined;

    Object.assign(session, updates, { updatedAt: new Date() });
    return session;
  }

  addTranscript(id: string, entry: TranscriptEntry): void {
    const session = this.sessions.get(id);
    if (session) {
      session.transcript.push(entry);
      session.updatedAt = new Date();
    }
  }

  complete(id: string): Session | undefined {
    const session = this.sessions.get(id);
    if (session) {
      session.status = 'completed';
      session.updatedAt = new Date();
      activeSessionsGauge.dec();
      logger.info('Session completed', { sessionId: id });
    }
    return session;
  }

  delete(id: string): boolean {
    const session = this.sessions.get(id);
    if (session?.status === 'active') {
      activeSessionsGauge.dec();
    }
    const deleted = this.sessions.delete(id);
    if (deleted) {
      logger.info('Session deleted', { sessionId: id });
    }
    return deleted;
  }

  list(): SessionSummary[] {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      sourceLang: s.sourceLang,
      targetLang: s.targetLang,
      status: s.status,
      createdAt: s.createdAt,
      duration: s.status === 'completed'
        ? s.updatedAt.getTime() - s.createdAt.getTime()
        : undefined,
      transcriptCount: s.transcript.length,
    }));
  }

  getActiveCount(): number {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.status === 'active') count++;
    }
    return count;
  }
}

export const sessionService = new SessionStore();
