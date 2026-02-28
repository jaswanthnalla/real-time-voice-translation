// ============================================================
// Core Types for the Real-Time Voice Translation System
// ============================================================

/** Supported language codes */
export type LanguageCode =
  | 'en' | 'es' | 'fr' | 'de' | 'it' | 'pt'
  | 'ru' | 'zh' | 'ja' | 'ko' | 'ar' | 'hi';

/** Mapping of language codes to display names */
export const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
};

/** BCP-47 locale codes for Google Cloud APIs */
export const LANGUAGE_LOCALES: Record<LanguageCode, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-BR',
  ru: 'ru-RU',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  ar: 'ar-SA',
  hi: 'hi-IN',
};

// ---- Audio Types ----

export type AudioEncoding = 'MULAW' | 'LINEAR16' | 'FLAC' | 'OGG_OPUS';

export interface AudioChunk {
  payload: string; // base64-encoded audio
  timestamp: number;
  sequenceNumber: number;
  encoding: AudioEncoding;
  sampleRate: number;
}

// ---- Twilio Media Stream Types ----

export type TwilioMediaEvent = 'connected' | 'start' | 'media' | 'stop' | 'mark';

export interface TwilioStreamMessage {
  event: TwilioMediaEvent;
  sequenceNumber: string;
  streamSid: string;
  media?: {
    track: 'inbound' | 'outbound';
    chunk: string;
    timestamp: string;
    payload: string; // base64 mulaw audio
  };
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
  };
  stop?: {
    accountSid: string;
    callSid: string;
  };
}

// ---- Session Types ----

export type SessionStatus = 'initializing' | 'active' | 'paused' | 'ended' | 'error';

export interface TranslationSession {
  id: string;
  callSid: string;
  streamSid: string;
  callerA: CallerInfo;
  callerB: CallerInfo;
  status: SessionStatus;
  startTime: Date;
  endTime?: Date;
  transcriptA: TranscriptEntry[];
  transcriptB: TranscriptEntry[];
}

export interface CallerInfo {
  phoneNumber: string;
  language: LanguageCode;
  displayName?: string;
}

export interface TranscriptEntry {
  timestamp: Date;
  speaker: 'A' | 'B';
  originalText: string;
  translatedText: string;
  confidence: number;
}

// ---- STT Types ----

export interface STTResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  language: LanguageCode;
  words?: WordInfo[];
}

export interface WordInfo {
  word: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

// ---- Translation Types ----

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  confidence: number;
}

// ---- TTS Types ----

export interface TTSResult {
  audioContent: string; // base64-encoded audio
  encoding: AudioEncoding;
  sampleRate: number;
  duration: number;
}

export type VoiceGender = 'MALE' | 'FEMALE' | 'NEUTRAL';

export interface TTSOptions {
  language: LanguageCode;
  voiceGender: VoiceGender;
  speakingRate?: number;
  pitch?: number;
  audioEncoding?: AudioEncoding;
}

// ---- Pipeline Types ----

export interface PipelineResult {
  stt: STTResult;
  translation: TranslationResult;
  tts: TTSResult;
  totalLatencyMs: number;
}

// ---- API Types ----

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface CallRequest {
  to: string;
  from?: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
}

export interface CallInfo {
  callSid: string;
  status: string;
  from: string;
  to: string;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  duration?: number;
  startTime: string;
}

// ---- Metrics Types ----

export interface SystemMetrics {
  activeSessions: number;
  avgLatencyMs: number;
  sttAccuracy: number;
  translationAccuracy: number;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
}
