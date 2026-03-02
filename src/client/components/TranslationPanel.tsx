import React from 'react';

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
    <button
      className={`record-btn ${isRecording ? 'recording' : ''}`}
      onClick={isRecording ? onStop : onStart}
      disabled={disabled}
    >
      {isRecording ? 'Stop' : 'Start'} Translation
    </button>
    {isRecording && (
      <div className="recording-indicator">
        <span className="pulse" />
        Listening...
      </div>
    )}
  </div>
);
