export interface TranslationRequest {
  text: string;
  sourceLang: string;
  targetLang: string;
  sessionId?: string;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  confidence?: number;
  durationMs: number;
}

export interface STTResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
  languageCode: string;
}

export interface TTSResult {
  audioContent: Buffer;
  durationMs: number;
  encoding: string;
  sampleRate: number;
}

export interface PipelineResult {
  sttResult: STTResult;
  translationResult: TranslationResult;
  ttsResult: TTSResult;
  totalDurationMs: number;
}

export interface PipelineConfig {
  sourceLang: string;
  targetLang: string;
  sttConfig?: {
    model?: string;
    useEnhanced?: boolean;
  };
  ttsConfig?: {
    voiceName?: string;
    speakingRate?: number;
    pitch?: number;
  };
}
