import { SpeechClient } from '@google-cloud/speech';
import { EventEmitter } from 'events';
import { logger } from '../../utils/logger';
import { translationDuration } from '../../utils/metrics';
import { AUDIO_CONFIG, STT_STREAM_LIMIT_MS } from '../../shared/constants';
import { STTResult } from '../../types';

export interface STTAudioOptions {
  encoding?: string;
  sampleRateHertz?: number;
  model?: string;
}

export class STTService extends EventEmitter {
  private client: SpeechClient;
  private recognizeStream: ReturnType<SpeechClient['streamingRecognize']> | null = null;
  private streamStartTime: number = 0;
  private restartTimer: NodeJS.Timeout | null = null;
  private languageCode: string;
  private audioOptions: STTAudioOptions;

  constructor(languageCode: string, audioOptions?: STTAudioOptions) {
    super();
    this.client = new SpeechClient();
    this.languageCode = languageCode;
    this.audioOptions = audioOptions || {};
  }

  startStream(): void {
    this.stopStream();

    const encoding = this.audioOptions.encoding || AUDIO_CONFIG.ENCODING;
    const sampleRateHertz = this.audioOptions.sampleRateHertz || AUDIO_CONFIG.SAMPLE_RATE;
    const model = this.audioOptions.model || 'phone_call';

    const request = {
      config: {
        encoding: encoding as 'MULAW' | 'LINEAR16' | 'WEBM_OPUS',
        sampleRateHertz,
        languageCode: this.languageCode,
        enableAutomaticPunctuation: true,
        model,
      },
      interimResults: true,
    };

    this.recognizeStream = this.client.streamingRecognize(request);
    this.streamStartTime = Date.now();

    this.recognizeStream.on('data', (response: { results?: Array<{ alternatives?: Array<{ transcript?: string; confidence?: number }>; isFinal?: boolean }> }) => {
      const result = response.results?.[0];
      if (!result?.alternatives?.[0]) return;

      const alternative = result.alternatives[0];
      const sttResult: STTResult = {
        transcript: alternative.transcript || '',
        confidence: alternative.confidence || 0,
        isFinal: result.isFinal || false,
        languageCode: this.languageCode,
      };

      if (sttResult.isFinal) {
        const durationSec = (Date.now() - this.streamStartTime) / 1000;
        translationDuration.observe({ stage: 'stt' }, durationSec);
      }

      this.emit('transcription', sttResult);
    });

    this.recognizeStream.on('error', (error: Error) => {
      logger.error('STT stream error', { error: error.message });
      this.emit('error', error);
    });

    this.recognizeStream.on('end', () => {
      logger.debug('STT stream ended');
    });

    // Restart stream before Google's 5-minute limit
    this.restartTimer = setTimeout(() => {
      logger.debug('Restarting STT stream (approaching time limit)');
      this.startStream();
    }, STT_STREAM_LIMIT_MS);
  }

  writeAudio(audioChunk: Buffer): void {
    if (this.recognizeStream && !this.recognizeStream.destroyed) {
      this.recognizeStream.write(audioChunk);
    }
  }

  stopStream(): void {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (this.recognizeStream) {
      this.recognizeStream.end();
      this.recognizeStream = null;
    }
  }

  destroy(): void {
    this.stopStream();
    this.removeAllListeners();
  }
}
