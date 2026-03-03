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
