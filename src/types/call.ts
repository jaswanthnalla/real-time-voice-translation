export enum CallType {
  TWILIO = 'twilio',
  WEBRTC = 'webrtc',
}

export enum CallState {
  INITIATING = 'initiating',
  RINGING = 'ringing',
  CONNECTED = 'connected',
  TRANSLATING = 'translating',
  ENDED = 'ended',
  FAILED = 'failed',
}

export interface CallParticipant {
  id: string;
  socketId?: string;
  language: string | null;
  isLanguageDetected: boolean;
  isMuted: boolean;
  joinedAt: Date;
}

export interface CallSession {
  id: string;
  type: CallType;
  participants: CallParticipant[];
  state: CallState;
  startedAt: Date;
  endedAt?: Date;
  twilioCallSid?: string;
  twilioStreamSid?: string;
  roomId?: string;
}

export interface InitiateCallInput {
  type: CallType;
  targetNumber?: string;
  roomId?: string;
  preferredLanguage?: string;
}
