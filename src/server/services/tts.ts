import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import NodeCache from 'node-cache';
import { createServiceLogger } from '../../utils/logger';
import { config } from '../../config';
import type { LanguageCode, TTSResult, TTSOptions, VoiceGender } from '../../types';
import { LANGUAGE_LOCALES } from '../../types';

const log = createServiceLogger('tts-service');

/** Mapping of languages to the best available WaveNet/Neural2 voices for natural speech */
const VOICE_MAP: Record<LanguageCode, Record<VoiceGender, string>> = {
  en: { MALE: 'en-US-Neural2-D', FEMALE: 'en-US-Neural2-F', NEUTRAL: 'en-US-Neural2-C' },
  es: { MALE: 'es-ES-Neural2-B', FEMALE: 'es-ES-Neural2-A', NEUTRAL: 'es-ES-Neural2-A' },
  fr: { MALE: 'fr-FR-Neural2-B', FEMALE: 'fr-FR-Neural2-A', NEUTRAL: 'fr-FR-Neural2-A' },
  de: { MALE: 'de-DE-Neural2-B', FEMALE: 'de-DE-Neural2-A', NEUTRAL: 'de-DE-Neural2-C' },
  it: { MALE: 'it-IT-Neural2-C', FEMALE: 'it-IT-Neural2-A', NEUTRAL: 'it-IT-Neural2-A' },
  pt: { MALE: 'pt-BR-Neural2-B', FEMALE: 'pt-BR-Neural2-A', NEUTRAL: 'pt-BR-Neural2-C' },
  ru: { MALE: 'ru-RU-Wavenet-B', FEMALE: 'ru-RU-Wavenet-A', NEUTRAL: 'ru-RU-Wavenet-C' },
  zh: { MALE: 'cmn-CN-Wavenet-B', FEMALE: 'cmn-CN-Wavenet-A', NEUTRAL: 'cmn-CN-Wavenet-C' },
  ja: { MALE: 'ja-JP-Neural2-C', FEMALE: 'ja-JP-Neural2-B', NEUTRAL: 'ja-JP-Neural2-B' },
  ko: { MALE: 'ko-KR-Neural2-C', FEMALE: 'ko-KR-Neural2-A', NEUTRAL: 'ko-KR-Neural2-A' },
  ar: { MALE: 'ar-XA-Wavenet-B', FEMALE: 'ar-XA-Wavenet-A', NEUTRAL: 'ar-XA-Wavenet-C' },
  hi: { MALE: 'hi-IN-Neural2-B', FEMALE: 'hi-IN-Neural2-A', NEUTRAL: 'hi-IN-Neural2-A' },
};

/**
 * Text-to-Speech service using Google Cloud TTS with Neural2/WaveNet voices.
 * Produces natural-sounding speech for the translated text, suitable for
 * injection back into phone calls or browser audio playback.
 */
export class TTSService {
  private client: TextToSpeechClient;
  private cache: NodeCache;

  constructor() {
    this.client = new TextToSpeechClient({
      projectId: config.google.projectId,
    });
    this.cache = new NodeCache({
      stdTTL: config.cache.ttl,
      checkperiod: 120,
      maxKeys: 5000,
    });
  }

  /**
   * Synthesize natural-sounding speech from text.
   * Uses Neural2 (or WaveNet fallback) voices for the most natural output.
   *
   * For phone calls (Twilio): outputs MULAW at 8kHz
   * For browser playback: outputs LINEAR16 at 24kHz (or MP3)
   */
  async synthesize(text: string, options: TTSOptions): Promise<TTSResult> {
    if (!text.trim()) {
      return { audioContent: '', encoding: 'MULAW', sampleRate: 8000, duration: 0 };
    }

    // Check cache
    const cacheKey = `tts:${options.language}:${options.voiceGender}:${options.audioEncoding || 'MULAW'}:${text.toLowerCase().trim()}`;
    const cached = this.cache.get<TTSResult>(cacheKey);
    if (cached && config.cache.enabled) {
      log.debug(`TTS cache hit for: "${text.substring(0, 40)}..."`);
      return cached;
    }

    const startTime = Date.now();

    const locale = LANGUAGE_LOCALES[options.language];
    const voiceName = this.getVoiceName(options.language, options.voiceGender);
    const encoding = options.audioEncoding || 'MULAW';

    // Map our encoding type to Google Cloud's enum
    const gcEncoding = this.mapEncoding(encoding);

    try {
      const [response] = await this.client.synthesizeSpeech({
        input: {
          // Use SSML for more natural prosody
          ssml: `<speak>${this.escapeSSML(text)}</speak>`,
        },
        voice: {
          languageCode: locale,
          name: voiceName,
          ssmlGender: options.voiceGender as 'MALE' | 'FEMALE' | 'NEUTRAL',
        },
        audioConfig: {
          audioEncoding: gcEncoding,
          sampleRateHertz: encoding === 'MULAW' ? 8000 : 24000,
          speakingRate: options.speakingRate || 1.0,
          pitch: options.pitch || 0,
          effectsProfileId: encoding === 'MULAW'
            ? ['telephony-class-application']
            : ['large-home-entertainment-class-device'],
        },
      });

      const audioContent = response.audioContent
        ? Buffer.from(response.audioContent as Uint8Array).toString('base64')
        : '';

      const latency = Date.now() - startTime;
      const sampleRate = encoding === 'MULAW' ? 8000 : 24000;
      // Estimate duration from audio size
      const audioBytes = audioContent ? Buffer.from(audioContent, 'base64').length : 0;
      const duration = audioBytes / sampleRate;

      log.debug(
        `TTS synthesized "${text.substring(0, 40)}..." → ${audioBytes} bytes, ${latency}ms (voice: ${voiceName})`,
      );

      const result: TTSResult = {
        audioContent,
        encoding,
        sampleRate,
        duration,
      };

      if (config.cache.enabled) {
        this.cache.set(cacheKey, result);
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'TTS synthesis failed';
      log.error(`TTS error: ${message}`);
      throw err;
    }
  }

  /**
   * Synthesize speech optimized for phone call injection (MULAW 8kHz).
   */
  async synthesizeForPhone(text: string, language: LanguageCode, gender: VoiceGender = 'FEMALE'): Promise<TTSResult> {
    return this.synthesize(text, {
      language,
      voiceGender: gender,
      audioEncoding: 'MULAW',
    });
  }

  /**
   * Synthesize speech optimized for browser playback (LINEAR16 24kHz).
   */
  async synthesizeForBrowser(text: string, language: LanguageCode, gender: VoiceGender = 'FEMALE'): Promise<TTSResult> {
    return this.synthesize(text, {
      language,
      voiceGender: gender,
      audioEncoding: 'LINEAR16',
    });
  }

  private getVoiceName(language: LanguageCode, gender: VoiceGender): string {
    return VOICE_MAP[language]?.[gender] || VOICE_MAP[language]?.FEMALE || `${LANGUAGE_LOCALES[language]}-Wavenet-A`;
  }

  private mapEncoding(encoding: string): 'MULAW' | 'LINEAR16' | 'MP3' | 'OGG_OPUS' {
    switch (encoding) {
      case 'MULAW': return 'MULAW';
      case 'LINEAR16': return 'LINEAR16';
      case 'OGG_OPUS': return 'OGG_OPUS';
      default: return 'MP3';
    }
  }

  private escapeSSML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// Singleton
export const ttsService = new TTSService();
