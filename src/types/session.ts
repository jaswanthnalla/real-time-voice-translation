import { CallType } from './call';

export interface TranscriptEntry {
  id?: string;
  speakerId: string;
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  isFinal: boolean;
  timestamp: Date;
}

export interface TranslationSession {
  id: string;
  userId: string;
  callType: CallType;
  participantALanguage: string | null;
  participantBLanguage: string | null;
  state: string;
  startedAt: Date;
  endedAt: Date | null;
  summary: string | null;
  metadata: Record<string, unknown>;
}

export interface SessionWithTranscript extends TranslationSession {
  transcriptEntries: TranscriptEntry[];
}

export interface CreateSessionInput {
  userId: string;
  callType: CallType;
}
