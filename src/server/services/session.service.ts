import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { activeSessionsGauge } from '../../utils/metrics';
import { db } from './database.service';
import { summaryService } from './summary.service';
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

    // Persist to database asynchronously
    if (db.isConnected()) {
      db.query(
        `INSERT INTO conversations (id, call_sid, source_language, target_language, status, start_time)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [session.id, session.callSid, session.sourceLang, session.targetLang, session.status, session.createdAt]
      ).catch((err) => logger.error('Failed to persist session to DB', { error: (err as Error).message }));
    }

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

    // Persist updates to DB asynchronously
    if (db.isConnected()) {
      db.query(
        `UPDATE conversations SET call_sid = $1, status = $2, updated_at = NOW() WHERE id = $3`,
        [session.callSid, session.status, id]
      ).catch((err) => logger.error('Failed to update session in DB', { error: (err as Error).message }));
    }

    return session;
  }

  addTranscript(id: string, entry: TranscriptEntry): void {
    const session = this.sessions.get(id);
    if (session) {
      session.transcript.push(entry);
      session.updatedAt = new Date();

      // Persist transcript entry to DB asynchronously
      if (db.isConnected()) {
        db.query(
          `INSERT INTO transcripts (id, conversation_id, speaker, original_text, translated_text, source_language, target_language, timestamp)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [uuidv4(), id, entry.speaker, entry.originalText, entry.translatedText, entry.sourceLang, entry.targetLang, entry.timestamp]
        ).catch((err) => logger.error('Failed to persist transcript to DB', { error: (err as Error).message }));
      }
    }
  }

  complete(id: string): Session | undefined {
    const session = this.sessions.get(id);
    if (session) {
      session.status = 'completed';
      session.updatedAt = new Date();
      activeSessionsGauge.dec();
      logger.info('Session completed', { sessionId: id });

      // Persist completion to DB
      if (db.isConnected()) {
        db.query(
          `UPDATE conversations SET status = 'completed', end_time = NOW() WHERE id = $1`,
          [id]
        ).catch((err) => logger.error('Failed to complete session in DB', { error: (err as Error).message }));
      }

      // Generate AI summary asynchronously (fire-and-forget)
      if (summaryService.isAvailable() && session.transcript.length > 0) {
        summaryService.generateSummary(session.transcript)
          .then((summary) => {
            if (db.isConnected()) {
              return db.query(
                `INSERT INTO conversation_summaries (id, conversation_id, summary, key_points, action_items, sentiment)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [uuidv4(), id, summary.summary, JSON.stringify(summary.keyPoints), JSON.stringify(summary.actionItems), summary.sentiment]
              );
            }
            return undefined;
          })
          .catch((err) => logger.error('Summary generation failed', { error: (err as Error).message, sessionId: id }));
      }
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

      if (db.isConnected()) {
        db.query('DELETE FROM conversations WHERE id = $1', [id])
          .catch((err) => logger.error('Failed to delete session from DB', { error: (err as Error).message }));
      }
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

  async listFromDb(): Promise<SessionSummary[]> {
    if (!db.isConnected()) return this.list();

    try {
      const result = await db.query(
        `SELECT id, source_language, target_language, status, start_time, end_time,
                (SELECT COUNT(*) FROM transcripts WHERE conversation_id = c.id) as transcript_count
         FROM conversations c ORDER BY start_time DESC LIMIT 100`
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return result.rows.map((row: any) => ({
        id: row.id as string,
        sourceLang: row.source_language as string,
        targetLang: row.target_language as string,
        status: row.status as Session['status'],
        createdAt: new Date(row.start_time as string),
        duration: row.end_time
          ? new Date(row.end_time as string).getTime() - new Date(row.start_time as string).getTime()
          : undefined,
        transcriptCount: parseInt(row.transcript_count as string, 10),
      }));
    } catch (error) {
      logger.error('Failed to list sessions from DB', { error: (error as Error).message });
      return this.list();
    }
  }

  async getSummary(sessionId: string): Promise<{ summary: string; keyPoints: string[]; actionItems: string[]; sentiment: string } | null> {
    if (!db.isConnected()) return null;

    try {
      const result = await db.query(
        'SELECT summary, key_points, action_items, sentiment FROM conversation_summaries WHERE conversation_id = $1',
        [sessionId]
      );

      if (result.rows.length === 0) return null;

      const row = result.rows[0];
      return {
        summary: row.summary,
        keyPoints: typeof row.key_points === 'string' ? JSON.parse(row.key_points) : row.key_points,
        actionItems: typeof row.action_items === 'string' ? JSON.parse(row.action_items) : row.action_items,
        sentiment: row.sentiment,
      };
    } catch (error) {
      logger.error('Failed to get summary from DB', { error: (error as Error).message });
      return null;
    }
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
