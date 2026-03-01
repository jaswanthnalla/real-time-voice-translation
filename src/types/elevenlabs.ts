export interface ElevenLabsVoiceConfig {
  voiceId: string;
  modelId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
}

export interface TTSRequest {
  text: string;
  voiceConfig: ElevenLabsVoiceConfig;
  outputFormat: string;
}

export interface TTSStreamChunk {
  audioData: Buffer;
  isFinal: boolean;
}

export interface ElevenLabsStreamEvents {
  audio: (chunk: TTSStreamChunk) => void;
  error: (error: Error) => void;
  done: () => void;
}

export type ElevenLabsOutputFormat =
  | 'mp3_22050_32'
  | 'mp3_44100_128'
  | 'pcm_16000'
  | 'pcm_22050'
  | 'pcm_24000'
  | 'ulaw_8000';
