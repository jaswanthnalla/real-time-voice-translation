import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { logger } from '../../utils/logger';
import { translationDuration } from '../../utils/metrics';
import { AUDIO_CONFIG } from '../../shared/constants';
import { TTSResult } from '../../types';

export class TTSService {
  private client: TextToSpeechClient;

  constructor() {
    this.client = new TextToSpeechClient();
  }

  async synthesize(text: string, languageCode: string): Promise<TTSResult> {
    const startTime = Date.now();

    try {
      const [response] = await this.client.synthesizeSpeech({
        input: { text },
        voice: {
          languageCode,
          ssmlGender: 'NEUTRAL' as const,
        },
        audioConfig: {
          audioEncoding: 'MULAW' as const,
          sampleRateHertz: AUDIO_CONFIG.SAMPLE_RATE,
        },
      });

      const durationMs = Date.now() - startTime;
      translationDuration.observe({ stage: 'tts' }, durationMs / 1000);

      const audioContent = response.audioContent;
      if (!audioContent) {
        throw new Error('No audio content in TTS response');
      }

      const audioBuffer = Buffer.isBuffer(audioContent)
        ? audioContent
        : Buffer.from(audioContent as Uint8Array);

      logger.debug('TTS synthesis completed', { languageCode, durationMs });

      return {
        audioContent: audioBuffer,
        durationMs,
        encoding: AUDIO_CONFIG.ENCODING,
        sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
      };
    } catch (error) {
      logger.error('TTS synthesis failed', {
        error: (error as Error).message,
        languageCode,
      });
      throw error;
    }
  }
}
