import React, { useState } from 'react';
import { ConnectionStatus } from './components/ConnectionStatus';
import { RoomSetup } from './components/RoomSetup';
import { CallView } from './components/CallView';
import { useTranslation } from './hooks/useTranslation';

export const App: React.FC = () => {
  const [myLanguage, setMyLanguage] = useState('en');

  const {
    isConnected,
    isListening,
    isSpeaking,
    roomCode,
    myId,
    participants,
    interimText,
    interimSender,
    transcript,
    error,
    autoSpeak,
    setAutoSpeak,
    createRoom,
    joinRoom,
    leaveRoom,
    startListening,
    stopListening,
    clearTranscript,
  } = useTranslation(myLanguage);

  const inRoom = roomCode !== null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <div>
            <h1>VoiceTranslate</h1>
            <span className="brand-tagline">Real-time voice translation</span>
          </div>
        </div>
        <div className="header-right">
          {isSpeaking && (
            <div className="playing-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              Speaking
            </div>
          )}
          <ConnectionStatus connected={isConnected} />
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}

      {!inRoom ? (
        <RoomSetup
          myLanguage={myLanguage}
          onLanguageChange={setMyLanguage}
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
          isConnected={isConnected}
        />
      ) : (
        <CallView
          roomCode={roomCode}
          myId={myId!}
          participants={participants}
          isListening={isListening}
          interimText={interimText}
          interimSender={interimSender}
          transcript={transcript}
          autoSpeak={autoSpeak}
          onToggleAutoSpeak={() => setAutoSpeak(!autoSpeak)}
          onStartListening={startListening}
          onStopListening={stopListening}
          onLeaveRoom={leaveRoom}
          onClearTranscript={clearTranscript}
        />
      )}

      <footer className="app-footer">
        <span>VoiceTranslate v2.0</span>
        <span>12 languages supported</span>
      </footer>
    </div>
  );
};
