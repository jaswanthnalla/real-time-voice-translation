import { SUPPORTED_LANGUAGES, LanguageConfig, getSupportedLanguageList } from '../shared/language-codes';

export function getLanguageConfig(code: string): LanguageConfig | undefined {
  return SUPPORTED_LANGUAGES[code];
}

export function getAllLanguages(): LanguageConfig[] {
  return getSupportedLanguageList();
}

export function getVoiceIdForLanguage(languageCode: string): string {
  const envKey = `ELEVENLABS_DEFAULT_VOICE_${languageCode.toUpperCase()}`;
  const envVoiceId = process.env[envKey];
  if (envVoiceId) return envVoiceId;
  return SUPPORTED_LANGUAGES[languageCode]?.elevenLabsDefaultVoiceId
    ?? SUPPORTED_LANGUAGES['en'].elevenLabsDefaultVoiceId;
}
