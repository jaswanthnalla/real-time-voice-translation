export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  sessionId?: string;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence: number;
  latencyMs: number;
  cached: boolean;
}

export interface TranslationPipelineConfig {
  enableCache: boolean;
  cacheTtlSeconds: number;
  maxRetries: number;
  timeoutMs: number;
}
