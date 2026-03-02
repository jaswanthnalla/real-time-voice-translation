import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function env(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function envInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : defaultValue;
}

function envBool(key: string, defaultValue: boolean): boolean {
  const val = process.env[key];
  if (!val) return defaultValue;
  return val === 'true' || val === '1';
}

export const config = {
  env: env('NODE_ENV', 'development'),
  port: envInt('PORT', 3001),
  wsPort: envInt('WEBSOCKET_PORT', 3001),
  host: env('HOST', '0.0.0.0'),

  jwt: {
    secret: env('JWT_SECRET', 'dev-secret-change-in-production'),
    expiresIn: env('JWT_EXPIRES_IN', '24h'),
  },

  apiKey: env('API_KEY', ''),

  twilio: {
    accountSid: env('TWILIO_ACCOUNT_SID', ''),
    authToken: env('TWILIO_AUTH_TOKEN', ''),
    phoneNumber: env('TWILIO_PHONE_NUMBER', ''),
    webhookUrl: env('TWILIO_WEBHOOK_URL', ''),
  },

  google: {
    projectId: env('GOOGLE_CLOUD_PROJECT_ID', ''),
    credentials: env('GOOGLE_APPLICATION_CREDENTIALS', ''),
  },

  database: {
    url: env('DATABASE_URL', 'postgresql://localhost:5432/voice_translation'),
  },

  redis: {
    url: env('REDIS_URL', 'redis://localhost:6379'),
  },

  translation: {
    defaultSourceLang: env('DEFAULT_SOURCE_LANGUAGE', 'en'),
    defaultTargetLang: env('DEFAULT_TARGET_LANGUAGE', 'es'),
    cacheTtl: envInt('TRANSLATION_CACHE_TTL', 3600),
  },

  audio: {
    sampleRate: envInt('AUDIO_SAMPLE_RATE', 8000),
    channels: envInt('AUDIO_CHANNELS', 1),
    encoding: env('AUDIO_ENCODING', 'MULAW'),
  },

  logging: {
    level: env('LOG_LEVEL', 'info'),
  },

  metrics: {
    enabled: envBool('ENABLE_METRICS', true),
    port: envInt('PROMETHEUS_PORT', 9090),
  },

  rateLimit: {
    windowMs: envInt('RATE_LIMIT_WINDOW_MS', 60000),
    max: envInt('RATE_LIMIT_MAX', 100),
  },

  cors: {
    origin: env('CORS_ORIGIN', '*'),
  },
} as const;

export type Config = typeof config;
