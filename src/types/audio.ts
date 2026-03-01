export enum AudioEncoding {
  LINEAR16 = 'linear16',
  MULAW = 'mulaw',
  OPUS = 'opus',
  WEBM_OPUS = 'webm-opus',
  MP3 = 'mp3',
}

export interface AudioFormat {
  encoding: AudioEncoding;
  sampleRate: number;
  channels: number;
  bitDepth?: number;
}

export interface AudioChunk {
  data: Buffer;
  timestamp: number;
  format: AudioFormat;
  sequenceNumber: number;
  participantId: string;
}

export type AudioStreamState = 'idle' | 'streaming' | 'paused' | 'ended';

export interface AudioStreamConfig {
  format: AudioFormat;
  chunkDurationMs: number;
  bufferSize: number;
}
