import { createClient, DeepgramClient } from '@deepgram/sdk';
import config from './index';
import { DeepgramStreamConfig } from '../types/deepgram';

let deepgramClient: DeepgramClient | null = null;

export function getDeepgramClient(): DeepgramClient {
  if (!deepgramClient) {
    deepgramClient = createClient(config.deepgram.apiKey);
  }
  return deepgramClient;
}

export function getDefaultStreamConfig(language?: string): DeepgramStreamConfig {
  return {
    model: config.deepgram.model,
    language: language,
    detectLanguage: !language,
    punctuate: true,
    interimResults: true,
    utteranceEndMs: 1000,
    encoding: 'linear16',
    sampleRate: 16000,
    channels: 1,
    smartFormat: true,
  };
}
