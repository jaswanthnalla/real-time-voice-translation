export const SUPPORTED_LANGUAGES: Record<string, string> = {
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

export const AUDIO_CONFIG = {
  SAMPLE_RATE: 8000,
  CHANNELS: 1,
  ENCODING: 'MULAW' as const,
  CHUNK_DURATION_MS: 20,
  BYTES_PER_SAMPLE: 1,
};

export const STT_STREAM_LIMIT_MS = 290_000; // ~4:50, restart before 5-min Google limit

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  TRANSLATION_ERROR: 'TRANSLATION_ERROR',
  STT_ERROR: 'STT_ERROR',
  TTS_ERROR: 'TTS_ERROR',
  PIPELINE_ERROR: 'PIPELINE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export const DEFAULT_SOURCE_LANG = 'en';
export const DEFAULT_TARGET_LANG = 'es';
