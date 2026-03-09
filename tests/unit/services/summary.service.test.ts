jest.mock('openai', () => {
  const mockCreate = jest.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            summary: 'A brief conversation about greetings.',
            keyPoints: ['Exchanged greetings', 'Discussed weather'],
            actionItems: [],
            sentiment: 'positive',
          }),
        },
      },
    ],
  });

  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
    _mockCreate: mockCreate,
  };
});

// Set API key before importing (so constructor picks it up)
process.env.OPENAI_API_KEY = 'test-openai-key';

import { summaryService, ConversationSummary } from '../../../src/server/services/summary.service';
import { TranscriptEntry } from '../../../src/types';

const { _mockCreate } = require('openai');

describe('SummaryService', () => {
  const mockTranscripts: TranscriptEntry[] = [
    {
      timestamp: new Date(),
      speaker: 'caller',
      originalText: 'Hello',
      translatedText: 'Hola',
      sourceLang: 'en',
      targetLang: 'es',
    },
    {
      timestamp: new Date(),
      speaker: 'callee',
      originalText: 'Hola, cómo estás',
      translatedText: 'Hello, how are you',
      sourceLang: 'es',
      targetLang: 'en',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isAvailable', () => {
    it('should return true when API key is configured', () => {
      expect(summaryService.isAvailable()).toBe(true);
    });
  });

  describe('generateSummary', () => {
    it('should generate a summary from transcripts', async () => {
      const result = await summaryService.generateSummary(mockTranscripts);

      expect(result.summary).toBe('A brief conversation about greetings.');
      expect(result.keyPoints).toEqual(['Exchanged greetings', 'Discussed weather']);
      expect(result.actionItems).toEqual([]);
      expect(result.sentiment).toBe('positive');
    });

    it('should call OpenAI with formatted transcripts', async () => {
      await summaryService.generateSummary(mockTranscripts);

      expect(_mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = _mockCreate.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(2);
      expect(callArgs.messages[0].role).toBe('system');
      expect(callArgs.messages[1].role).toBe('user');
      expect(callArgs.messages[1].content).toContain('Hello');
      expect(callArgs.messages[1].content).toContain('Hola');
    });

    it('should handle malformed JSON response gracefully', async () => {
      _mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: 'Not valid JSON' } }],
      });

      const result = await summaryService.generateSummary(mockTranscripts);

      // Should fall back to raw content
      expect(result.summary).toBe('Not valid JSON');
      expect(result.keyPoints).toEqual([]);
      expect(result.actionItems).toEqual([]);
      expect(result.sentiment).toBe('unknown');
    });

    it('should handle empty choices response', async () => {
      _mockCreate.mockResolvedValueOnce({
        choices: [{ message: { content: null } }],
      });

      const result = await summaryService.generateSummary(mockTranscripts);
      expect(result).toBeDefined();
    });
  });
});
