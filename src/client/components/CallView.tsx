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
  const autoStartedRef = useRef(false);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimText]);

  // Auto-start listening when partner joins
  useEffect(() => {
    if (partner && !isListening && !autoStartedRef.current) {
      autoStartedRef.current = true;
      const timer = setTimeout(() => onStartListening(), 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [partner, isListening, onStartListening]);

  const langName = (code: string) => SUPPORTED_LANGUAGES[code] || code.toUpperCase();

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode).catch(() => {});
  };

  return (
    <main className="call">
      {/* Room info bar */}
      <div className="call-bar">
        <div className="room-tag">
          <span className="room-tag-label">Room</span>
          <button className="room-tag-code" onClick={copyCode} title="Copy room code">
            {roomCode}
          </button>
        </div>

        <div className="partner-info">
          {partner ? (
            <>
              <span className="partner-dot online" />
              <span className="partner-name">{partner.nickname} ({langName(partner.language)})</span>
            </>
          ) : (
            <>
              <span className="partner-dot waiting" />
              <span className="partner-name">Waiting for partner...</span>
            </>
          )}
        </div>

        <button className="leave-btn" onClick={onLeaveRoom}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Leave
        </button>
      </div>

      {/* Auto-speak toggle */}
      <div className="toggle-row">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={autoSpeak}
            onChange={onToggleAutoSpeak}
            className="toggle-checkbox"
          />
          <span className="toggle-track" />
          Auto-speak translations
        </label>
      </div>

      {/* Transcript area */}
      <div className="transcript">
        {transcript.length === 0 && !interimText ? (
          <div className="transcript-empty">
            <div className="transcript-empty-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p>{partner ? 'Just start talking — translations will appear here after you hear them.' : 'Share the room code and wait for your partner.'}</p>
            <p className="hint">{partner ? 'Your mic is on. Both of you can speak freely.' : 'Mic starts automatically when they join.'}</p>
          </div>
        ) : (
          <>
            {transcript.map((entry) => {
              const isMe = entry.senderId === myId;
              return (
                <div key={entry.id} className={`bubble ${isMe ? 'mine' : 'theirs'}`}>
                  <div className="bubble-head">
                    <span className="bubble-who">{entry.senderNickname}</span>
                    <time className="bubble-when">
                      {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </time>
                  </div>
                  <div className="bubble-orig">
                    <span className="lang-tag src">{langName(entry.sourceLang)}</span>
                    {entry.originalText}
                  </div>
                  {entry.sourceLang !== entry.targetLang && (
                    <div className="bubble-trans">
                      <span className="lang-tag tgt">{langName(entry.targetLang)}</span>
                      {entry.translatedText}
                    </div>
                  )}
                </div>
              );
            })}

            {interimText && (
              <div className="bubble interim">
                <div className="bubble-head">
                  <span className="bubble-who">{interimSender || '...'}</span>
                </div>
                <div className="bubble-orig">
                  <span className="interim-dot" />
                  {interimText}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Mic button and status */}
      <div className="call-controls">
        <div className="mic-area">
          {isListening && <div className="mic-ring" />}
          {isListening && <div className="mic-ring d" />}
          <button
            className={`mic-btn ${isListening ? 'active' : ''}`}
            onClick={isListening ? onStopListening : onStartListening}
            disabled={!partner}
            aria-label={isListening ? 'Stop listening' : 'Start listening'}
          >
            {isListening ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>
        </div>

        <div className="mic-status">
          {isListening ? (
            <>
              <AudioWaveform isActive={true} barCount={7} />
              <span className="mic-status-text recording">Listening... tap to stop</span>
            </>
          ) : (
            <span className="mic-status-text">
              {partner ? 'Tap microphone to speak' : 'Waiting for partner...'}
            </span>
          )}
        </div>

        {transcript.length > 0 && (
          <button className="clear-btn" onClick={onClearTranscript}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Clear
          </button>
        )}
      </div>
    </main>
  );
};
