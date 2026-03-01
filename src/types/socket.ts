import { DeepgramTranscript, LanguageDetectionResult } from './deepgram';
import { SubtitleEntry } from './subtitle';
import { CallState } from './call';

export interface ServerToClientEvents {
  translation_result: (data: {
    sessionId: string;
    originalText: string;
    translatedText: string;
    sourceLanguage: string;
    targetLanguage: string;
  }) => void;
  translated_audio: (data: {
    sessionId: string;
    audioData: string;
    format: string;
    participantId: string;
  }) => void;
  subtitle_update: (data: SubtitleEntry) => void;
  language_detected: (data: LanguageDetectionResult & { participantId: string }) => void;
  call_state_change: (data: { sessionId: string; state: CallState }) => void;
  participant_joined: (data: { participantId: string; sessionId: string }) => void;
  participant_left: (data: { participantId: string; sessionId: string }) => void;
  error: (data: { message: string; code: string }) => void;
  ice_servers: (data: { iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> }) => void;
  offer: (data: { senderId: string; payload: Record<string, unknown> }) => void;
  answer: (data: { senderId: string; payload: Record<string, unknown> }) => void;
  ice_candidate: (data: { senderId: string; payload: Record<string, unknown> }) => void;
}

export interface ClientToServerEvents {
  join_call: (data: {
    sessionId: string;
    preferredLanguage?: string;
  }, callback: (response: { success: boolean; error?: string }) => void) => void;
  leave_call: (data: { sessionId: string }) => void;
  audio_chunk: (data: {
    sessionId: string;
    audioData: string;
    format: string;
    sequenceNumber: number;
  }) => void;
  set_language: (data: {
    sessionId: string;
    language: string;
  }) => void;
  toggle_subtitles: (data: {
    sessionId: string;
    enabled: boolean;
  }) => void;
  offer: (data: { roomId: string; payload: Record<string, unknown> }) => void;
  answer: (data: { roomId: string; payload: Record<string, unknown> }) => void;
  ice_candidate: (data: { roomId: string; payload: Record<string, unknown> }) => void;
  create_room: (callback: (response: { roomId: string }) => void) => void;
  join_room: (data: { roomId: string }, callback: (response: { success: boolean; error?: string }) => void) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: string;
  sessionId?: string;
  participantId?: string;
}
