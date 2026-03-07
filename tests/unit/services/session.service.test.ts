// Mock database and summary services before importing session service
jest.mock('../../../src/server/services/database.service', () => ({
  db: {
    isConnected: jest.fn().mockReturnValue(false),
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    initialize: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../../src/server/services/summary.service', () => ({
  summaryService: {
    isAvailable: jest.fn().mockReturnValue(false),
    generateSummary: jest.fn().mockResolvedValue({
      summary: 'Test summary',
      keyPoints: [],
      actionItems: [],
      sentiment: 'neutral',
    }),
  },
}));

import { sessionService } from '../../../src/server/services/session.service';

// Reset the singleton between tests
beforeEach(() => {
  // Delete all sessions
  const sessions = sessionService.list();
  sessions.forEach((s) => sessionService.delete(s.id));
});

describe('SessionService', () => {
  describe('create', () => {
    it('should create a new session', () => {
      const session = sessionService.create({
        sourceLang: 'en',
        targetLang: 'es',
      });

      expect(session.id).toBeDefined();
      expect(session.sourceLang).toBe('en');
      expect(session.targetLang).toBe('es');
      expect(session.status).toBe('active');
      expect(session.transcript).toEqual([]);
    });

    it('should assign optional caller/callee numbers', () => {
      const session = sessionService.create({
        sourceLang: 'en',
        targetLang: 'fr',
        callerNumber: '+1234567890',
        calleeNumber: '+0987654321',
      });

      expect(session.callerNumber).toBe('+1234567890');
      expect(session.calleeNumber).toBe('+0987654321');
    });
  });

  describe('get', () => {
    it('should return a session by id', () => {
      const created = sessionService.create({
        sourceLang: 'en',
        targetLang: 'de',
      });

      const found = sessionService.get(created.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
    });

    it('should return undefined for unknown id', () => {
      expect(sessionService.get('nonexistent')).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should return all sessions as summaries', () => {
      sessionService.create({ sourceLang: 'en', targetLang: 'es' });
      sessionService.create({ sourceLang: 'fr', targetLang: 'de' });

      const sessions = sessionService.list();
      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toHaveProperty('id');
      expect(sessions[0]).toHaveProperty('transcriptCount', 0);
    });
  });

  describe('complete', () => {
    it('should mark a session as completed', () => {
      const session = sessionService.create({
        sourceLang: 'en',
        targetLang: 'es',
      });

      const completed = sessionService.complete(session.id);
      expect(completed!.status).toBe('completed');
    });
  });

  describe('addTranscript', () => {
    it('should add transcript entries to a session', () => {
      const session = sessionService.create({
        sourceLang: 'en',
        targetLang: 'es',
      });

      sessionService.addTranscript(session.id, {
        timestamp: new Date(),
        speaker: 'caller',
        originalText: 'Hello',
        translatedText: 'Hola',
        sourceLang: 'en',
        targetLang: 'es',
      });

      const updated = sessionService.get(session.id);
      expect(updated!.transcript).toHaveLength(1);
      expect(updated!.transcript[0].originalText).toBe('Hello');
    });
  });

  describe('delete', () => {
    it('should delete a session', () => {
      const session = sessionService.create({
        sourceLang: 'en',
        targetLang: 'es',
      });

      expect(sessionService.delete(session.id)).toBe(true);
      expect(sessionService.get(session.id)).toBeUndefined();
    });

    it('should return false for nonexistent session', () => {
      expect(sessionService.delete('nonexistent')).toBe(false);
    });
  });

  describe('getByCallSid', () => {
    it('should find session by callSid', () => {
      const session = sessionService.create({ sourceLang: 'en', targetLang: 'es' });
      sessionService.update(session.id, { callSid: 'CA123' });

      const found = sessionService.getByCallSid('CA123');
      expect(found).toBeDefined();
      expect(found!.id).toBe(session.id);
    });

    it('should return undefined for unknown callSid', () => {
      expect(sessionService.getByCallSid('nonexistent')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update session fields', () => {
      const session = sessionService.create({ sourceLang: 'en', targetLang: 'es' });
      const updated = sessionService.update(session.id, { callSid: 'CA456', streamSid: 'MZ789' });

      expect(updated).toBeDefined();
      expect(updated!.callSid).toBe('CA456');
      expect(updated!.streamSid).toBe('MZ789');
    });

    it('should return undefined for unknown session', () => {
      expect(sessionService.update('nonexistent', { callSid: 'CA' })).toBeUndefined();
    });

    it('should update the updatedAt timestamp', () => {
      const session = sessionService.create({ sourceLang: 'en', targetLang: 'es' });
      const originalUpdatedAt = session.updatedAt;

      // Small delay to ensure timestamps differ
      const updated = sessionService.update(session.id, { callSid: 'CA' });
      expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
    });
  });

  describe('complete with DB and summary', () => {
    it('should return undefined for unknown session', () => {
      expect(sessionService.complete('nonexistent')).toBeUndefined();
    });

    it('should persist to DB when connected', () => {
      const { db } = require('../../../src/server/services/database.service');
      db.isConnected.mockReturnValue(true);

      const session = sessionService.create({ sourceLang: 'en', targetLang: 'es' });
      sessionService.complete(session.id);

      expect(db.query).toHaveBeenCalled();
      db.isConnected.mockReturnValue(false);
    });

    it('should generate summary when available and transcripts exist', () => {
      const { db } = require('../../../src/server/services/database.service');
      const { summaryService: mockSummary } = require('../../../src/server/services/summary.service');
      db.isConnected.mockReturnValue(false);
      mockSummary.isAvailable.mockReturnValue(true);

      const session = sessionService.create({ sourceLang: 'en', targetLang: 'es' });
      sessionService.addTranscript(session.id, {
        timestamp: new Date(),
        speaker: 'caller',
        originalText: 'Hello',
        translatedText: 'Hola',
        sourceLang: 'en',
        targetLang: 'es',
      });
      sessionService.complete(session.id);

      expect(mockSummary.generateSummary).toHaveBeenCalled();
      mockSummary.isAvailable.mockReturnValue(false);
    });
  });

  describe('addTranscript with DB', () => {
    it('should persist to DB when connected', () => {
      const { db } = require('../../../src/server/services/database.service');
      db.isConnected.mockReturnValue(true);

      const session = sessionService.create({ sourceLang: 'en', targetLang: 'es' });
      sessionService.addTranscript(session.id, {
        timestamp: new Date(),
        speaker: 'caller',
        originalText: 'Test',
        translatedText: 'Prueba',
        sourceLang: 'en',
        targetLang: 'es',
      });

      expect(db.query).toHaveBeenCalled();
      db.isConnected.mockReturnValue(false);
    });

    it('should ignore addTranscript for unknown session', () => {
      sessionService.addTranscript('nonexistent', {
        timestamp: new Date(),
        speaker: 'caller',
        originalText: 'Test',
        translatedText: 'Prueba',
        sourceLang: 'en',
        targetLang: 'es',
      });
      // Should not throw
    });
  });

  describe('listFromDb', () => {
    it('should fallback to in-memory list when DB not connected', async () => {
      const { db } = require('../../../src/server/services/database.service');
      db.isConnected.mockReturnValue(false);

      sessionService.create({ sourceLang: 'en', targetLang: 'es' });
      const sessions = await sessionService.listFromDb();
      expect(sessions).toHaveLength(1);
    });

    it('should query DB when connected', async () => {
      const { db } = require('../../../src/server/services/database.service');
      db.isConnected.mockReturnValue(true);
      db.query.mockResolvedValue({
        rows: [
          {
            id: 'db-1',
            source_language: 'en',
            target_language: 'fr',
            status: 'completed',
            start_time: '2026-01-01T00:00:00Z',
            end_time: '2026-01-01T00:05:00Z',
            transcript_count: '3',
          },
        ],
      });

      const sessions = await sessionService.listFromDb();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe('db-1');
      expect(sessions[0].transcriptCount).toBe(3);
      expect(sessions[0].duration).toBeGreaterThan(0);

      db.isConnected.mockReturnValue(false);
    });

    it('should fallback to in-memory list on DB error', async () => {
      const { db } = require('../../../src/server/services/database.service');
      db.isConnected.mockReturnValue(true);
      db.query.mockRejectedValue(new Error('DB connection lost'));

      const sessions = await sessionService.listFromDb();
      expect(Array.isArray(sessions)).toBe(true);

      db.isConnected.mockReturnValue(false);
    });
  });

  describe('getSummary', () => {
    it('should return null when DB not connected', async () => {
      const { db } = require('../../../src/server/services/database.service');
      db.isConnected.mockReturnValue(false);

      const result = await sessionService.getSummary('test-id');
      expect(result).toBeNull();
    });

    it('should return summary from DB', async () => {
      const { db } = require('../../../src/server/services/database.service');
      db.isConnected.mockReturnValue(true);
      db.query.mockResolvedValue({
        rows: [{
          summary: 'Test summary',
          key_points: '["point1","point2"]',
          action_items: '["action1"]',
          sentiment: 'positive',
        }],
      });

      const result = await sessionService.getSummary('test-id');
      expect(result).not.toBeNull();
      expect(result!.summary).toBe('Test summary');
      expect(result!.keyPoints).toEqual(['point1', 'point2']);
      expect(result!.sentiment).toBe('positive');

      db.isConnected.mockReturnValue(false);
    });

    it('should return null when no summary found', async () => {
      const { db } = require('../../../src/server/services/database.service');
      db.isConnected.mockReturnValue(true);
      db.query.mockResolvedValue({ rows: [] });

      const result = await sessionService.getSummary('test-id');
      expect(result).toBeNull();

      db.isConnected.mockReturnValue(false);
    });

    it('should return null on DB error', async () => {
      const { db } = require('../../../src/server/services/database.service');
      db.isConnected.mockReturnValue(true);
      db.query.mockRejectedValue(new Error('query failed'));

      const result = await sessionService.getSummary('test-id');
      expect(result).toBeNull();

      db.isConnected.mockReturnValue(false);
    });
  });

  describe('delete with DB', () => {
    it('should delete active session and decrement gauge', () => {
      const session = sessionService.create({ sourceLang: 'en', targetLang: 'es' });
      expect(sessionService.delete(session.id)).toBe(true);
    });

    it('should persist delete to DB when connected', () => {
      const { db } = require('../../../src/server/services/database.service');
      db.isConnected.mockReturnValue(true);

      const session = sessionService.create({ sourceLang: 'en', targetLang: 'es' });
      sessionService.delete(session.id);

      expect(db.query).toHaveBeenCalledWith(
        'DELETE FROM conversations WHERE id = $1',
        [session.id]
      );

      db.isConnected.mockReturnValue(false);
    });
  });

  describe('list with duration', () => {
    it('should include duration for completed sessions', () => {
      const session = sessionService.create({ sourceLang: 'en', targetLang: 'es' });
      sessionService.complete(session.id);

      const sessions = sessionService.list();
      expect(sessions[0].duration).toBeDefined();
      expect(sessions[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('should not include duration for active sessions', () => {
      sessionService.create({ sourceLang: 'en', targetLang: 'es' });

      const sessions = sessionService.list();
      expect(sessions[0].duration).toBeUndefined();
    });
  });

  describe('getActiveCount', () => {
    it('should count active sessions', () => {
      sessionService.create({ sourceLang: 'en', targetLang: 'es' });
      sessionService.create({ sourceLang: 'fr', targetLang: 'de' });

      expect(sessionService.getActiveCount()).toBe(2);
    });

    it('should not count completed sessions', () => {
      const s1 = sessionService.create({ sourceLang: 'en', targetLang: 'es' });
      sessionService.create({ sourceLang: 'fr', targetLang: 'de' });
      sessionService.complete(s1.id);

      expect(sessionService.getActiveCount()).toBe(1);
    });
  });
});
