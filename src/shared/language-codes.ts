export interface LanguageConfig {
  code: string;
  bcp47: string;
  name: string;
  nativeName: string;
  deepgramCode: string;
  googleTranslateCode: string;
  elevenLabsDefaultVoiceId: string;
}

export const SUPPORTED_LANGUAGES: Record<string, LanguageConfig> = {
  en: {
    code: 'en',
    bcp47: 'en-US',
    name: 'English',
    nativeName: 'English',
    deepgramCode: 'en-US',
    googleTranslateCode: 'en',
    elevenLabsDefaultVoiceId: '21m00Tcm4TlvDq8ikWAM',
  },
  es: {
    code: 'es',
    bcp47: 'es-ES',
    name: 'Spanish',
    nativeName: 'Espanol',
    deepgramCode: 'es',
    googleTranslateCode: 'es',
    elevenLabsDefaultVoiceId: 'AZnzlk1XvdvUeBnXmlld',
  },
  fr: {
    code: 'fr',
    bcp47: 'fr-FR',
    name: 'French',
    nativeName: 'Francais',
    deepgramCode: 'fr',
    googleTranslateCode: 'fr',
    elevenLabsDefaultVoiceId: 'MF3mGyEYCl7XYWbV9V6O',
  },
  de: {
    code: 'de',
    bcp47: 'de-DE',
    name: 'German',
    nativeName: 'Deutsch',
    deepgramCode: 'de',
    googleTranslateCode: 'de',
    elevenLabsDefaultVoiceId: 'ErXwobaYiN019PkySvjV',
  },
  it: {
    code: 'it',
    bcp47: 'it-IT',
    name: 'Italian',
    nativeName: 'Italiano',
    deepgramCode: 'it',
    googleTranslateCode: 'it',
    elevenLabsDefaultVoiceId: 'VR6AewLTigWG4xSOukaG',
  },
  pt: {
    code: 'pt',
    bcp47: 'pt-BR',
    name: 'Portuguese',
    nativeName: 'Portugues',
    deepgramCode: 'pt-BR',
    googleTranslateCode: 'pt',
    elevenLabsDefaultVoiceId: 'GBv7mTt0atIp3Br8iCZE',
  },
  ru: {
    code: 'ru',
    bcp47: 'ru-RU',
    name: 'Russian',
    nativeName: 'Russkiy',
    deepgramCode: 'ru',
    googleTranslateCode: 'ru',
    elevenLabsDefaultVoiceId: 'pNInz6obpgDQGcFmaJgB',
  },
  zh: {
    code: 'zh',
    bcp47: 'zh-CN',
    name: 'Chinese',
    nativeName: 'Zhongwen',
    deepgramCode: 'zh-CN',
    googleTranslateCode: 'zh',
    elevenLabsDefaultVoiceId: 'Yko7PKs4P8MHn3TK2xCp',
  },
  ja: {
    code: 'ja',
    bcp47: 'ja-JP',
    name: 'Japanese',
    nativeName: 'Nihongo',
    deepgramCode: 'ja',
    googleTranslateCode: 'ja',
    elevenLabsDefaultVoiceId: 'onwK4e9ZLuTAKqWW03F9',
  },
  ko: {
    code: 'ko',
    bcp47: 'ko-KR',
    name: 'Korean',
    nativeName: 'Hangugeo',
    deepgramCode: 'ko',
    googleTranslateCode: 'ko',
    elevenLabsDefaultVoiceId: 'TX3LPaxmHKxFdv7VOQHJ',
  },
  ar: {
    code: 'ar',
    bcp47: 'ar-SA',
    name: 'Arabic',
    nativeName: 'Al-Arabiyya',
    deepgramCode: 'ar',
    googleTranslateCode: 'ar',
    elevenLabsDefaultVoiceId: 'iP95p4xoKVk53GoZ742B',
  },
  hi: {
    code: 'hi',
    bcp47: 'hi-IN',
    name: 'Hindi',
    nativeName: 'Hindi',
    deepgramCode: 'hi',
    googleTranslateCode: 'hi',
    elevenLabsDefaultVoiceId: 'bIHbv24MWmeRgasZH58o',
  },
};

export function isLanguageSupported(code: string): boolean {
  return code in SUPPORTED_LANGUAGES;
}

export function getLanguageConfig(code: string): LanguageConfig | undefined {
  return SUPPORTED_LANGUAGES[code];
}

export function getDeepgramLanguageCode(code: string): string {
  return SUPPORTED_LANGUAGES[code]?.deepgramCode ?? code;
}

export function getGoogleTranslateCode(code: string): string {
  return SUPPORTED_LANGUAGES[code]?.googleTranslateCode ?? code;
}

export function getElevenLabsVoiceId(code: string): string {
  return SUPPORTED_LANGUAGES[code]?.elevenLabsDefaultVoiceId ?? SUPPORTED_LANGUAGES['en'].elevenLabsDefaultVoiceId;
}

export function getSupportedLanguageList(): LanguageConfig[] {
  return Object.values(SUPPORTED_LANGUAGES);
}
