import React from 'react';
import { AudioWaveform } from './AudioWaveform';

interface Props {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
  disabled: boolean;
}

export const TranslationPanel: React.FC<Props> = ({
  isRecording,
  onStart,
  onStop,
  disabled,
}) => (
  <div className="translation-panel">
    <div className="mic-container">
      {isRecording && <div className="mic-ripple" />}
      {isRecording && <div className="mic-ripple delay" />}
      <button
        className={`mic-btn ${isRecording ? 'recording' : ''}`}
        onClick={isRecording ? onStop : onStart}
        disabled={disabled}
        aria-label={isRecording ? 'Stop translation' : 'Start translation'}
      >
        {isRecording ? (
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
      {isRecording ? (
        <>
          <AudioWaveform isActive={true} barCount={7} />
          <span className="status-text recording-text">Listening... tap to stop</span>
        </>
      ) : (
        <span className="status-text">Tap microphone to start translating</span>
      )}
    </div>
  </div>
);
