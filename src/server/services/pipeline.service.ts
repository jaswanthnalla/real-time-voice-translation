import { EventEmitter } from 'events';
import { STTService, STTAudioOptions } from './stt.service';
import { TranslationService } from './translation.service';
import { TTSService, TTSAudioOptions } from './tts.service';
import { logger } from '../../utils/logger';
import { translationDuration } from '../../utils/metrics';
import { PipelineConfig, STTResult } from '../../types';

export interface ExtendedPipelineConfig extends PipelineConfig {
  audioOptions?: STTAudioOptions;
  ttsAudioOptions?: TTSAudioOptions;
}

export class PipelineService extends EventEmitter {
  private sttService: STTService;
  private translationService: TranslationService;
  private ttsService: TTSService;
  private config: ExtendedPipelineConfig;
  private isProcessing: boolean = false;

  constructor(pipelineConfig: ExtendedPipelineConfig) {
    super();
    this.config = pipelineConfig;
    this.sttService = new STTService(pipelineConfig.sourceLang, pipelineConfig.audioOptions);
    this.translationService = new TranslationService();
    this.ttsService = new TTSService();

    this.setupSTTListener();
  }

  private setupSTTListener(): void {
    this.sttService.on('transcription', async (result: STTResult) => {
      // Emit interim results for real-time UI feedback
      if (!result.isFinal) {
        this.emit('interim', { transcript: result.transcript });
        return;
      }

      if (!result.transcript.trim()) return;

      try {
        this.isProcessing = true;
        const pipelineStart = Date.now();

        logger.debug('Pipeline processing', {
          transcript: result.transcript,
          sourceLang: this.config.sourceLang,
          targetLang: this.config.targetLang,
        });

        // Translate
        const translationResult = await this.translationService.translate(
          result.transcript,
          this.config.sourceLang,
          this.config.targetLang
        );

        // Synthesize with configurable audio options
        const ttsResult = await this.ttsService.synthesize(
          translationResult.translatedText,
          this.config.targetLang,
          this.config.ttsAudioOptions
        );

        const totalDurationMs = Date.now() - pipelineStart;
        translationDuration.observe({ stage: 'pipeline_total' }, totalDurationMs / 1000);

        logger.debug('Pipeline completed', { totalDurationMs });

        this.emit('translated-audio', {
          audioContent: ttsResult.audioContent,
          sttResult: result,
          translationResult,
          ttsResult,
          totalDurationMs,
        });

        this.emit('transcript', {
          originalText: result.transcript,
          translatedText: translationResult.translatedText,
          sourceLang: this.config.sourceLang,
          targetLang: this.config.targetLang,
        });
      } catch (error) {
        logger.error('Pipeline processing error', {
          error: (error as Error).message,
        });
        this.emit('error', error);
      } finally {
        this.isProcessing = false;
      }
    });

    this.sttService.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }

  start(): void {
    logger.info('Starting translation pipeline', {
      sourceLang: this.config.sourceLang,
      targetLang: this.config.targetLang,
    });
    this.sttService.startStream();
  }

  processAudio(audioChunk: Buffer): void {
    this.sttService.writeAudio(audioChunk);
  }

  stop(): void {
    logger.info('Stopping translation pipeline');
    this.sttService.destroy();
    this.removeAllListeners();
  }

  getIsProcessing(): boolean {
    return this.isProcessing;
  }
}
