export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate';
  roomId: string;
  senderId: string;
  payload: Record<string, unknown>;
}

export type PeerConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

export interface ICEServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface WebRTCRoom {
  id: string;
  creatorId: string;
  participants: string[];
  createdAt: Date;
  sessionId?: string;
}
