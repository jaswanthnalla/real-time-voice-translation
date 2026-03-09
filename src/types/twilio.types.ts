export interface TwilioMediaMessage {
  event: 'connected' | 'start' | 'media' | 'stop' | 'mark';
  sequenceNumber?: string;
  streamSid?: string;
  start?: TwilioStreamStart;
  media?: TwilioMediaPayload;
  stop?: TwilioStreamStop;
  mark?: TwilioMark;
}

export interface TwilioStreamStart {
  streamSid: string;
  accountSid: string;
  callSid: string;
  tracks: string[];
  customParameters: Record<string, string>;
  mediaFormat: {
    encoding: string;
    sampleRate: number;
    channels: number;
  };
}

export interface TwilioMediaPayload {
  track: 'inbound' | 'outbound';
  chunk: string;
  timestamp: string;
  payload: string; // base64-encoded audio
}

export interface TwilioStreamStop {
  accountSid: string;
  callSid: string;
}

export interface TwilioMark {
  name: string;
}

export interface TwilioOutboundMessage {
  event: 'media' | 'mark' | 'clear';
  streamSid: string;
  media?: {
    payload: string; // base64-encoded audio
  };
  mark?: {
    name: string;
  };
}
