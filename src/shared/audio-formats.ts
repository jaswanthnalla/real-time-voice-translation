import { AudioEncoding, AudioFormat } from '../types/audio';

export const TWILIO_AUDIO_FORMAT: AudioFormat = {
  encoding: AudioEncoding.MULAW,
  sampleRate: 8000,
  channels: 1,
  bitDepth: 8,
};

export const WEBRTC_AUDIO_FORMAT: AudioFormat = {
  encoding: AudioEncoding.OPUS,
  sampleRate: 48000,
  channels: 1,
};

export const DEEPGRAM_INPUT_FORMAT: AudioFormat = {
  encoding: AudioEncoding.LINEAR16,
  sampleRate: 16000,
  channels: 1,
  bitDepth: 16,
};

export const ELEVENLABS_OUTPUT_FORMAT_PHONE = 'ulaw_8000';
export const ELEVENLABS_OUTPUT_FORMAT_WEBRTC = 'mp3_44100_128';
export const ELEVENLABS_OUTPUT_FORMAT_DEFAULT = 'mp3_22050_32';
