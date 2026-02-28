import dotenv from 'dotenv';
import path from 'path';
import Joi from 'joi';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = Joi.object({
  // Server
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  WEBSOCKET_PORT: Joi.number().default(3002),
  HOST: Joi.string().default('localhost'),

  // Twilio
  TWILIO_ACCOUNT_SID: Joi.string().required(),
  TWILIO_AUTH_TOKEN: Joi.string().required(),
  TWILIO_PHONE_NUMBER: Joi.string().required(),

  // Google Cloud
  GOOGLE_APPLICATION_CREDENTIALS: Joi.string().optional(),
  GOOGLE_PROJECT_ID: Joi.string().optional(),

  // OpenAI
  OPENAI_API_KEY: Joi.string().optional(),

  // Database
  DATABASE_URL: Joi.string().default('postgresql://postgres:password@localhost:5432/voice_translation'),
  REDIS_URL: Joi.string().default('redis://localhost:6379'),

  // Security
  JWT_SECRET: Joi.string().required(),
  API_KEY: Joi.string().required(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),

  // Audio Processing
  AUDIO_CHUNK_SIZE: Joi.number().default(1024),
  AUDIO_SAMPLE_RATE: Joi.number().default(16000),
  AUDIO_ENCODING: Joi.string().default('LINEAR16'),

  // Translation Pipeline
  DEFAULT_SOURCE_LANGUAGE: Joi.string().default('en'),
  DEFAULT_TARGET_LANGUAGE: Joi.string().default('es'),
  TRANSLATION_CONFIDENCE_THRESHOLD: Joi.number().default(0.8),

  // Streaming
  STT_STREAMING_ENABLED: Joi.boolean().default(true),
  TTS_STREAMING_ENABLED: Joi.boolean().default(true),

  // Cache
  CACHE_ENABLED: Joi.boolean().default(true),
  CACHE_TTL: Joi.number().default(3600),

  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug', 'verbose').default('info'),
  LOG_FILE_PATH: Joi.string().default('./logs/app.log'),
}).unknown(true);

const { error, value: envVars } = envSchema.validate(process.env, {
  abortEarly: false,
  stripUnknown: false,
});

if (error) {
  const missingVars = error.details.map((d) => d.message).join('\n');
  console.error(`Config validation error:\n${missingVars}`);
  // Don't crash in development with demo values
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

export const config = {
  env: (envVars.NODE_ENV as string) || 'development',
  isDev: envVars.NODE_ENV === 'development',
  isProd: envVars.NODE_ENV === 'production',
  isTest: envVars.NODE_ENV === 'test',

  server: {
    port: envVars.PORT as number,
    wsPort: envVars.WEBSOCKET_PORT as number,
    host: envVars.HOST as string,
  },

  twilio: {
    accountSid: envVars.TWILIO_ACCOUNT_SID as string,
    authToken: envVars.TWILIO_AUTH_TOKEN as string,
    phoneNumber: envVars.TWILIO_PHONE_NUMBER as string,
  },

  google: {
    credentials: envVars.GOOGLE_APPLICATION_CREDENTIALS as string | undefined,
    projectId: envVars.GOOGLE_PROJECT_ID as string | undefined,
  },

  openai: {
    apiKey: envVars.OPENAI_API_KEY as string | undefined,
  },

  database: {
    url: envVars.DATABASE_URL as string,
    redis: envVars.REDIS_URL as string,
  },

  security: {
    jwtSecret: envVars.JWT_SECRET as string,
    apiKey: envVars.API_KEY as string,
  },

  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS as number,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS as number,
  },

  audio: {
    chunkSize: envVars.AUDIO_CHUNK_SIZE as number,
    sampleRate: envVars.AUDIO_SAMPLE_RATE as number,
    encoding: envVars.AUDIO_ENCODING as string,
  },

  translation: {
    defaultSourceLang: envVars.DEFAULT_SOURCE_LANGUAGE as string,
    defaultTargetLang: envVars.DEFAULT_TARGET_LANGUAGE as string,
    confidenceThreshold: envVars.TRANSLATION_CONFIDENCE_THRESHOLD as number,
  },

  streaming: {
    sttEnabled: envVars.STT_STREAMING_ENABLED as boolean,
    ttsEnabled: envVars.TTS_STREAMING_ENABLED as boolean,
  },

  cache: {
    enabled: envVars.CACHE_ENABLED as boolean,
    ttl: envVars.CACHE_TTL as number,
  },

  logging: {
    level: envVars.LOG_LEVEL as string,
    filePath: envVars.LOG_FILE_PATH as string,
  },
} as const;

export type Config = typeof config;
