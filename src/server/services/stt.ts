import { SpeechClient } from '@google-cloud/speech';
import type { google } from '@google-cloud/speech/build/protos/protos';
import { EventEmitter } from 'events';
import { Writable } from 'stream';
import { createServiceLogger } from '../../utils/logger';
import { config } from '../../config';
import type { LanguageCode, STTResult } from '../../types';
import { LANGUAGE_LOCALES } from '../../types';

const log = createServiceLogger('stt-service');

type IStreamingRecognizeResponse = google.cloud.speech.v1.IStreamingRecognizeResponse;
type IWordInfo = google.cloud.speech.v1.IWordInfo;

/**
 * Speech-to-Text service using Google Cloud Streaming Recognition.
 * Converts real-time audio into text with interim and final results.
 */
export type AudioEncoding = 'MULAW' | 'LINEAR16';

export interface STTServiceOptions {
  encoding?: AudioEncoding;
  sampleRateHertz?: number;
}

export class STTService extends EventEmitter {
  private client: SpeechClient;
  private recognizeStream: Writable | null = null;
  private language: LanguageCode;
  private encoding: AudioEncoding;
  private sampleRateHertz: number;
  private restartTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(language: LanguageCode, options: STTServiceOptions = {}) {
    super();
    this.language = language;
    // Default: MULAW@8kHz for Twilio; override to LINEAR16@16kHz for browser
    this.encoding = options.encoding ?? 'MULAW';
    this.sampleRateHertz = options.sampleRateHertz ?? 8000;
    this.client = new SpeechClient({
      projectId: config.google.projectId,
    });
  }

  /** Start a new streaming recognition session */
  startStream(): void {
    const locale = LANGUAGE_LOCALES[this.language];
    const isBrowser = this.encoding === 'LINEAR16';

    log.info(`Starting STT stream for language: ${this.language} (${locale}), encoding: ${this.encoding}@${this.sampleRateHertz}Hz`);

    const request = {
      config: {
        encoding: this.encoding as 'MULAW' | 'LINEAR16',
        sampleRateHertz: this.sampleRateHertz,
        languageCode: locale,
        model: isBrowser ? 'latest_long' : 'phone_call',
        useEnhanced: true,
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: true,
        maxAlternatives: 1,
      },
      interimResults: true, // Stream partial results for live captions
    };

    this.recognizeStream = this.client
      .streamingRecognize(request)
      .on('data', (data: IStreamingRecognizeResponse) => {
        if (!data.results || data.results.length === 0) return;

        const result = data.results[0];
        if (!result.alternatives || result.alternatives.length === 0) return;

        const alternative = result.alternatives[0];

        const sttResult: STTResult = {
          transcript: alternative.transcript || '',
          confidence: alternative.confidence || 0,
          isFinal: result.isFinal || false,
          language: this.language,
          words: alternative.words?.map((w: IWordInfo) => ({
            word: w.word || '',
            startTime: Number(w.startTime?.seconds || 0),
            endTime: Number(w.endTime?.seconds || 0),
            confidence: w.confidence || 0,
          })),
        };

        if (sttResult.transcript.trim()) {
          this.emit('transcription', sttResult);

          if (sttResult.isFinal) {
            log.debug(`Final transcript: "${sttResult.transcript}" (confidence: ${sttResult.confidence.toFixed(2)})`);
          }
        }
      })
      .on('error', (error: Error) => {
        log.error(`STT stream error: ${error.message}`);
        this.emit('error', error);
        this.scheduleRestart();
      })
      .on('end', () => {
        log.info('STT stream ended');
        this.emit('end');
      });

    // Google Cloud STT has a ~5 minute streaming limit, auto-restart before that
    this.restartTimeout = setTimeout(() => {
      log.info('Restarting STT stream (approaching time limit)');
      this.restartStream();
    }, 4.5 * 60 * 1000); // 4.5 minutes
  }

  /** Write audio data to the recognition stream */
  writeAudio(audioChunk: Buffer): void {
    if (this.recognizeStream && !this.recognizeStream.destroyed) {
      this.recognizeStream.write({ audioContent: audioChunk });
    }
  }

  /** Restart the stream (for long-running calls) */
  private restartStream(): void {
    this.stopStream();
    this.startStream();
  }

  private scheduleRestart(): void {
    setTimeout(() => {
      this.restartStream();
    }, 1000);
  }

  /** Stop the streaming recognition */
  stopStream(): void {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
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
