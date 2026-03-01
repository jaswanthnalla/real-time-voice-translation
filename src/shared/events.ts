export const EVENTS = {
  // Client -> Server
  JOIN_CALL: 'join_call',
  LEAVE_CALL: 'leave_call',
  AUDIO_CHUNK: 'audio_chunk',
  SET_LANGUAGE: 'set_language',
  TOGGLE_SUBTITLES: 'toggle_subtitles',
  CREATE_ROOM: 'create_room',
  JOIN_ROOM: 'join_room',

  // WebRTC Signaling
  OFFER: 'offer',
  ANSWER: 'answer',
  ICE_CANDIDATE: 'ice_candidate',

  // Server -> Client
  TRANSLATION_RESULT: 'translation_result',
  TRANSLATED_AUDIO: 'translated_audio',
  SUBTITLE_UPDATE: 'subtitle_update',
  LANGUAGE_DETECTED: 'language_detected',
  CALL_STATE_CHANGE: 'call_state_change',
  PARTICIPANT_JOINED: 'participant_joined',
  PARTICIPANT_LEFT: 'participant_left',
  ICE_SERVERS: 'ice_servers',
  ERROR: 'error',

  // Internal pipeline events
  PIPELINE_READY: 'pipeline_ready',
  PIPELINE_ENDED: 'pipeline_ended',
  TRANSCRIPT: 'transcript',
} as const;
