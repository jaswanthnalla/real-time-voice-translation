import OpenAI from 'openai';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { TranscriptEntry } from '../../types';

export interface ConversationSummary {
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  sentiment: string;
}

class SummaryService {
  private client: OpenAI | null = null;

  constructor() {
    if (config.openai.apiKey) {
      this.client = new OpenAI({ apiKey: config.openai.apiKey });
      logger.info('OpenAI summary service initialized');
    } else {
      logger.info('OpenAI API key not configured - summary generation disabled');
    }
  }

  isAvailable(): boolean {
    return this.client !== null;
  }

  async generateSummary(transcripts: TranscriptEntry[]): Promise<ConversationSummary> {
    if (!this.client) {
      throw new Error('OpenAI client not configured');
    }

    const formattedTranscripts = transcripts.map((t) =>
      `[${t.speaker}] (${t.sourceLang}→${t.targetLang}) Original: "${t.originalText}" | Translated: "${t.translatedText}"`
    ).join('\n');

    const completion = await this.client.chat.completions.create({
      model: config.openai.model,
      max_tokens: config.openai.maxTokens,
      messages: [
        {
          role: 'system',
          content: `You are an assistant that summarizes multilingual voice conversations.
Analyze the conversation transcript and return a JSON object with:
- "summary": A concise 2-3 sentence summary of the conversation
- "keyPoints": An array of key points discussed (max 5)
- "actionItems": An array of action items or follow-ups identified (empty array if none)
- "sentiment": Overall sentiment of the conversation (e.g., "positive", "neutral", "negative", "mixed")

Return ONLY valid JSON, no markdown formatting.`,
        },
        {
          role: 'user',
          content: `Summarize this multilingual conversation:\n\n${formattedTranscripts}`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content || '{}';

    try {
      const parsed = JSON.parse(content) as ConversationSummary;
      logger.info('Conversation summary generated', {
        transcriptCount: transcripts.length,
      });
      return {
        summary: parsed.summary || '',
        keyPoints: parsed.keyPoints || [],
        actionItems: parsed.actionItems || [],
        sentiment: parsed.sentiment || 'neutral',
      };
    } catch (error) {
      logger.error('Failed to parse summary response', { content });
      return {
        summary: content,
        keyPoints: [],
        actionItems: [],
        sentiment: 'unknown',
      };
    }
  }
}

export const summaryService = new SummaryService();
