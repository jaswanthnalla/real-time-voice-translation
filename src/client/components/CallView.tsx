import React, { useRef, useEffect } from 'react';
import { SUPPORTED_LANGUAGES } from '../../shared/constants';
import { TranscriptEntry, Participant } from '../hooks/useTranslation';
import { AudioWaveform } from './AudioWaveform';

interface Props {
  roomCode: string;
  myId: string;
  participants: Participant[];
  isListening: boolean;
  interimText: string | null;
  interimSender: string | null;
  transcript: TranscriptEntry[];
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
  onStartListening: () => void;
  onStopListening: () => void;
  onLeaveRoom: () => void;
  onClearTranscript: () => void;
}

export const CallView: React.FC<Props> = ({
  roomCode,
  myId,
  participants,
  isListening,
  interimText,
  interimSender,
  transcript,
  autoSpeak,
  onToggleAutoSpeak,
  onStartListening,
  onStopListening,
  onLeaveRoom,
  onClearTranscript,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const partner = participants[0];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimText]);

  const langName = (code: string) => SUPPORTED_LANGUAGES[code] || code.toUpperCase();

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode).catch(() => {});
  };

  return (
    <main className="app-main">
      {/* Room info bar */}
      <div className="call-header">
        <div className="room-info">
          <span className="room-label">Room</span>
          <button className="room-code-btn" onClick={copyCode} title="Click to copy room code">
            {roomCode}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>
        </div>

        <div className="call-participants">
          {partner ? (
            <div className="participant-badge connected-badge">
              <span className="participant-dot connected-dot" />
              {partner.nickname} ({langName(partner.language)})
            </div>
          ) : (
            <div className="participant-badge waiting-badge">
              <span className="participant-dot waiting-dot" />
              Waiting for partner...
            </div>
          )}
        </div>

        <button className="leave-btn" onClick={onLeaveRoom}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Leave
        </button>
      </div>

      {/* Auto-speak toggle */}
      <div className="call-controls">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={autoSpeak}
            onChange={onToggleAutoSpeak}
            className="toggle-input"
          />
          <span className="toggle-switch" />
          Auto-speak translations
        </label>
      </div>

      {/* Transcript area */}
      <div className="call-transcript">
        {transcript.length === 0 && !interimText ? (
          <div className="transcript-view empty">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p>{partner ? 'Start speaking! Translations will appear here.' : 'Share the room code and wait for your partner to join.'}</p>
            <p className="empty-hint">Both of you can speak at the same time</p>
          </div>
        ) : (
          <div className="transcript-view">
            {transcript.map((entry) => {
              const isMe = entry.senderId === myId;
              return (
                <div key={entry.id} className={`chat-bubble ${isMe ? 'mine' : 'theirs'}`}>
                  <div className="bubble-header">
                    <span className="bubble-sender">{entry.senderNickname}</span>
                    <time className="bubble-time">
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </div>
                  <div className="bubble-original">
                    <span className="lang-badge source">{langName(entry.sourceLang)}</span>
                    {entry.originalText}
                  </div>
                  {entry.sourceLang !== entry.targetLang && (
                    <div className="bubble-translated">
                      <span className="lang-badge target">{langName(entry.targetLang)}</span>
                      {entry.translatedText}
                    </div>
                  )}
                </div>
              );
            })}

            {interimText && (
              <div className="chat-bubble interim-bubble">
                <div className="bubble-header">
                  <span className="bubble-sender">{interimSender || '...'}</span>
                </div>
                <div className="bubble-original interim-content">
                  <span className="interim-dot" />
                  {interimText}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Mic button and actions */}
      <div className="call-bottom">
        <div className="mic-container">
          {isListening && <div className="mic-ripple" />}
          {isListening && <div className="mic-ripple delay" />}
          <button
            className={`mic-btn ${isListening ? 'recording' : ''}`}
            onClick={isListening ? onStopListening : onStartListening}
            disabled={!partner}
            aria-label={isListening ? 'Stop listening' : 'Start listening'}
          >
            {isListening ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>
        </div>

        <div className="panel-status">
          {isListening ? (
            <>
              <AudioWaveform isActive={true} barCount={7} />
              <span className="status-text recording-text">Listening... tap to stop</span>
            </>
          ) : (
            <span className="status-text">
              {partner ? 'Tap microphone to start speaking' : 'Waiting for partner to join...'}
            </span>
          )}
        </div>

        {transcript.length > 0 && (
          <button className="action-btn clear-btn" onClick={onClearTranscript}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Clear Chat
          </button>
        )}
      </div>
    </main>
  );
};
