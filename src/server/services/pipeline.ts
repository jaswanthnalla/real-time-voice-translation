import { EventEmitter } from 'events';
import { createServiceLogger } from '../../utils/logger';
import { STTService, type AudioEncoding } from './stt';
import { translationService } from './translation';
import { ttsService } from './tts';
import type {
  LanguageCode,
  STTResult,
  TranslationResult,
  TTSResult,
  PipelineResult,
  VoiceGender,
} from '../../types';

const log = createServiceLogger('translation-pipeline');

export interface PipelineEvents {
  /** Fired for every interim/final STT result (for live subtitles) */
  'subtitle': {
    speaker: 'A' | 'B';
    originalText: string;
    translatedText: string;
    isFinal: boolean;
    sourceLanguage: LanguageCode;
    targetLanguage: LanguageCode;
  };
  /** Fired when translated audio is ready to play */
  'audio': {
    speaker: 'A' | 'B';
    audioContent: string; // base64
    encoding: string;
    sampleRate: number;
    targetLanguage: LanguageCode;
  };
  /** Full pipeline result (only for final transcriptions) */
  'result': PipelineResult;
  'error': Error;
}

/**
 * Translation Pipeline Orchestrator
 *
 * Manages the full STT → Translation → TTS pipeline for one direction
 * of a call (e.g., Speaker A's English → Speaker B's Spanish).
 *
 * For bidirectional calls, create two pipelines (A→B and B→A).
 *
 * Emits 'subtitle' events for real-time captions and 'audio' events
 * when synthesized speech is ready for playback.
 */
export class TranslationPipeline extends EventEmitter {
  private stt: STTService;
  private sourceLanguage: LanguageCode;
  private targetLanguage: LanguageCode;
  private speaker: 'A' | 'B';
  private voiceGender: VoiceGender;
  private isRunning = false;

  // Buffer interim text to avoid translating every tiny update
  private interimBuffer = '';
  private interimTranslateTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(params: {
    sourceLanguage: LanguageCode;
    targetLanguage: LanguageCode;
    speaker: 'A' | 'B';
    voiceGender?: VoiceGender;
    /** Audio format from the source. Defaults to MULAW@8kHz (Twilio). Use LINEAR16@16kHz for browser. */
    audioEncoding?: AudioEncoding;
    sampleRateHertz?: number;
  }) {
    super();
    this.sourceLanguage = params.sourceLanguage;
    this.targetLanguage = params.targetLanguage;
    this.speaker = params.speaker;
    this.voiceGender = params.voiceGender || 'FEMALE';

    // Create STT service for this pipeline's source language
    this.stt = new STTService(params.sourceLanguage, {
      encoding: params.audioEncoding ?? 'MULAW',
      sampleRateHertz: params.sampleRateHertz ?? 8000,
    });

    // Wire up STT events
    this.stt.on('transcription', (result: STTResult) => {
      this.handleTranscription(result);
    });

    this.stt.on('error', (error: Error) => {
      log.error(`Pipeline STT error (${this.speaker}): ${error.message}`);
      this.emit('error', error);
    });
  }

  /** Start the pipeline - begins listening for audio */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.stt.startStream();
    log.info(
      `Pipeline started: ${this.speaker} | ${this.sourceLanguage} → ${this.targetLanguage}`,
    );
  }

  /** Feed raw audio data into the pipeline */
  processAudio(audioChunk: Buffer): void {
    if (!this.isRunning) return;
    this.stt.writeAudio(audioChunk);
  }

  /** Stop the pipeline */
  stop(): void {
    this.isRunning = false;
    this.stt.destroy();
    if (this.interimTranslateTimeout) {
      clearTimeout(this.interimTranslateTimeout);
    }
    log.info(`Pipeline stopped: ${this.speaker}`);
  }

  /**
   * Handle STT transcription results.
   *
   * - Interim results: translate and emit subtitle (debounced)
   * - Final results: translate → synthesize TTS → emit audio + subtitle
   */
  private async handleTranscription(sttResult: STTResult): Promise<void> {
    try {
      if (sttResult.isFinal) {
        // ── Final result: full pipeline ──
        await this.processFinalTranscription(sttResult);
      } else {
        // ── Interim result: live subtitle only (debounced) ──
        this.processInterimTranscription(sttResult);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Pipeline processing error';
      log.error(`Pipeline error (${this.speaker}): ${message}`);
      this.emit('error', err instanceof Error ? err : new Error(message));
    }
  }

  /**
   * Process final transcription: Translate + TTS + emit audio.
   * This is the full pipeline that produces the natural AI voice output.
   */
  private async processFinalTranscription(sttResult: STTResult): Promise<void> {
    const pipelineStart = Date.now();

    // 1. Translate
    const translation: TranslationResult = await translationService.translate(
      sttResult.transcript,
      this.sourceLanguage,
      this.targetLanguage,
    );

    // 2. Synthesize natural AI voice
    const tts: TTSResult = await ttsService.synthesizeForPhone(
      translation.translatedText,
      this.targetLanguage,
      this.voiceGender,
    );

    const totalLatency = Date.now() - pipelineStart;

    // 3. Emit subtitle (final)
    this.emit('subtitle', {
      speaker: this.speaker,
      originalText: sttResult.transcript,
      translatedText: translation.translatedText,
      isFinal: true,
      sourceLanguage: this.sourceLanguage,
      targetLanguage: this.targetLanguage,
    });

    // 4. Emit translated audio for playback
    if (tts.audioContent) {
      this.emit('audio', {
        speaker: this.speaker,
        audioContent: tts.audioContent,
        encoding: tts.encoding,
        sampleRate: tts.sampleRate,
        targetLanguage: this.targetLanguage,
      });
    }

    // 5. Emit full pipeline result
    const pipelineResult: PipelineResult = {
      stt: sttResult,
      translation,
      tts,
      totalLatencyMs: totalLatency,
    };
    this.emit('result', pipelineResult);

    log.info(
      `Pipeline complete (${this.speaker}): "${sttResult.transcript.substring(0, 40)}" → ` +
      `"${translation.translatedText.substring(0, 40)}" | ${totalLatency}ms`,
    );
  }

  /**
   * Process interim transcription: translate for live subtitle only.
   * Debounced to avoid excessive API calls for fast-changing interim text.
   */
  private processInterimTranscription(sttResult: STTResult): void {
    this.interimBuffer = sttResult.transcript;

    if (this.interimTranslateTimeout) {
      clearTimeout(this.interimTranslateTimeout);
    }

    // Debounce: translate interim text every 300ms
    this.interimTranslateTimeout = setTimeout(async () => {
      try {
        const translation = await translationService.translate(
          this.interimBuffer,
          this.sourceLanguage,
          this.targetLanguage,
        );

        this.emit('subtitle', {
          speaker: this.speaker,
          originalText: this.interimBuffer,
          translatedText: translation.translatedText,
          isFinal: false,
          sourceLanguage: this.sourceLanguage,
          targetLanguage: this.targetLanguage,
        });
      } catch {
        // Interim translation failures are non-critical
      }
    }, 300);
  }
}
