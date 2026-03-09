export interface Session {
  id: string;
  callSid: string;
  streamSid: string;
  sourceLang: string;
  targetLang: string;
  callerNumber?: string | undefined;
  calleeNumber?: string | undefined;
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;
  transcript: TranscriptEntry[];
}

export type SessionStatus = 'active' | 'paused' | 'completed' | 'error';

export interface TranscriptEntry {
  timestamp: Date;
  speaker: 'caller' | 'callee';
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
}

export interface CreateSessionRequest {
  sourceLang: string;
  targetLang: string;
  userId?: string;
  callerNumber?: string | undefined;
  calleeNumber?: string | undefined;
}

export interface SessionSummary {
  id: string;
  sourceLang: string;
  targetLang: string;
  status: SessionStatus;
  createdAt: Date;
  duration?: number | undefined;
  transcriptCount: number;
}
