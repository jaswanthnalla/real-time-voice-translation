export interface TwilioMediaStreamEvent {
  event: 'connected' | 'start' | 'media' | 'stop' | 'mark';
  sequenceNumber?: string;
  streamSid?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
    customParameters?: Record<string, string>;
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string;
  };
  stop?: {
    accountSid: string;
    callSid: string;
  };
}

export interface TwilioCallEvent {
  callSid: string;
  from: string;
  to: string;
  callStatus: string;
  direction: string;
  accountSid: string;
}

export interface TwiMLStreamConfig {
  url: string;
  track: 'inbound_track' | 'outbound_track' | 'both_tracks';
}
