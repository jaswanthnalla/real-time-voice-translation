import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function optionalInt(key: string, defaultValue: number): number {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
}

function optionalBool(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value === 'true' || value === '1';
}

export const config = {
  server: {
    port: optionalInt('PORT', 3001),
    host: optionalEnv('HOST', '0.0.0.0'),
    nodeEnv: optionalEnv('NODE_ENV', 'development'),
    isProduction: optionalEnv('NODE_ENV', 'development') === 'production',
    corsOrigin: optionalEnv('CORS_ORIGIN', 'http://localhost:3000'),
  },

  database: {
    url: optionalEnv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/voicetranslation'),
    poolMin: optionalInt('DB_POOL_MIN', 2),
    poolMax: optionalInt('DB_POOL_MAX', 10),
  },

  redis: {
    url: optionalEnv('REDIS_URL', 'redis://localhost:6379'),
    password: process.env['REDIS_PASSWORD'] ?? undefined,
  },

  deepgram: {
    apiKey: optionalEnv('DEEPGRAM_API_KEY', ''),
    model: optionalEnv('DEEPGRAM_MODEL', 'nova-2'),
    detectDurationMs: optionalInt('DEEPGRAM_LANGUAGE_DETECT_DURATION_MS', 10000),
  },

  elevenlabs: {
    apiKey: optionalEnv('ELEVENLABS_API_KEY', ''),
    modelId: optionalEnv('ELEVENLABS_MODEL_ID', 'eleven_turbo_v2_5'),
  },

  googleTranslate: {
    projectId: process.env['GOOGLE_CLOUD_PROJECT_ID'] ?? undefined,
    credentials: process.env['GOOGLE_APPLICATION_CREDENTIALS'] ?? undefined,
  },

  twilio: {
    accountSid: optionalEnv('TWILIO_ACCOUNT_SID', ''),
    authToken: optionalEnv('TWILIO_AUTH_TOKEN', ''),
    phoneNumber: optionalEnv('TWILIO_PHONE_NUMBER', ''),
    mediaStreamUrl: optionalEnv('TWILIO_MEDIA_STREAM_URL', ''),
  },

  webrtc: {
    stunServer: optionalEnv('STUN_SERVER', 'stun:stun.l.google.com:19302'),
    turnServer: process.env['TURN_SERVER'] ?? undefined,
    turnUsername: process.env['TURN_USERNAME'] ?? undefined,
    turnCredential: process.env['TURN_CREDENTIAL'] ?? undefined,
  },

  auth: {
    jwtSecret: optionalEnv('JWT_SECRET', 'dev-secret-change-in-production'),
    jwtExpiry: optionalEnv('JWT_EXPIRY', '24h'),
    refreshTokenExpiry: optionalEnv('REFRESH_TOKEN_EXPIRY', '7d'),
    bcryptRounds: optionalInt('BCRYPT_ROUNDS', 12),
  },

  openai: {
    apiKey: optionalEnv('OPENAI_API_KEY', ''),
    model: optionalEnv('OPENAI_MODEL', 'gpt-4'),
  },

  features: {
    enableConversationSummary: optionalBool('ENABLE_CONVERSATION_SUMMARY', true),
    enableTranscriptStorage: optionalBool('ENABLE_TRANSCRIPT_STORAGE', true),
    enableCallRecording: optionalBool('ENABLE_CALL_RECORDING', false),
    enableRealTimeAnalytics: optionalBool('ENABLE_REAL_TIME_ANALYTICS', true),
  },

  audio: {
    sampleRate: optionalInt('AUDIO_SAMPLE_RATE', 16000),
    channels: optionalInt('AUDIO_CHANNELS', 1),
    chunkSize: optionalInt('AUDIO_CHUNK_SIZE', 1024),
    bufferSize: optionalInt('AUDIO_BUFFER_SIZE', 4096),
  },

  rateLimit: {
    windowMs: optionalInt('RATE_LIMIT_WINDOW_MS', 900000),
    maxRequests: optionalInt('RATE_LIMIT_MAX_REQUESTS', 100),
  },

  logging: {
    level: optionalEnv('LOG_LEVEL', 'debug'),
    format: optionalEnv('LOG_FORMAT', 'pretty'),
  },
} as const;

export type Config = typeof config;
export default config;
