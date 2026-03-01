import config from './index';
import { SUPPORTED_LANGUAGES } from '../shared/language-codes';
import { ElevenLabsVoiceConfig } from '../types/elevenlabs';

export function getElevenLabsApiKey(): string {
  return config.elevenlabs.apiKey;
}

export function getElevenLabsModelId(): string {
  return config.elevenlabs.modelId;
}

export function getVoiceConfigForLanguage(languageCode: string): ElevenLabsVoiceConfig {
  const envKey = `ELEVENLABS_DEFAULT_VOICE_${languageCode.toUpperCase()}`;
  const envVoiceId = process.env[envKey];
  const langConfig = SUPPORTED_LANGUAGES[languageCode];
  const voiceId = envVoiceId ?? langConfig?.elevenLabsDefaultVoiceId ?? SUPPORTED_LANGUAGES['en'].elevenLabsDefaultVoiceId;

  return {
    voiceId,
    modelId: config.elevenlabs.modelId,
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0.5,
    useSpeakerBoost: true,
  };
}

export function getOutputFormatForCallType(callType: 'twilio' | 'webrtc'): string {
  return callType === 'twilio' ? 'ulaw_8000' : 'mp3_44100_128';
}
