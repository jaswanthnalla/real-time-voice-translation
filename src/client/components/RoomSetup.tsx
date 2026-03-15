import React, { useState } from 'react';
import { SUPPORTED_LANGUAGES } from '../../shared/constants';

const LANG_FLAGS: Record<string, string> = {
  en: '\uD83C\uDDFA\uD83C\uDDF8',
  es: '\uD83C\uDDEA\uD83C\uDDF8',
  fr: '\uD83C\uDDEB\uD83C\uDDF7',
  de: '\uD83C\uDDE9\uD83C\uDDEA',
  it: '\uD83C\uDDEE\uD83C\uDDF9',
  pt: '\uD83C\uDDE7\uD83C\uDDF7',
  ru: '\uD83C\uDDF7\uD83C\uDDFA',
  zh: '\uD83C\uDDE8\uD83C\uDDF3',
  ja: '\uD83C\uDDEF\uD83C\uDDF5',
  ko: '\uD83C\uDDF0\uD83C\uDDF7',
  ar: '\uD83C\uDDF8\uD83C\uDDE6',
  hi: '\uD83C\uDDEE\uD83C\uDDF3',
};

interface Props {
  myLanguage: string;
  onLanguageChange: (lang: string) => void;
  onCreateRoom: (nickname: string) => void;
  onJoinRoom: (code: string, nickname: string) => void;
  isConnected: boolean;
}

export const RoomSetup: React.FC<Props> = ({
  myLanguage,
  onLanguageChange,
  onCreateRoom,
  onJoinRoom,
  isConnected,
}) => {
  const [nickname, setNickname] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'choice' | 'create' | 'join'>('choice');

  const languages = Object.entries(SUPPORTED_LANGUAGES);

  const handleCreate = () => {
    onCreateRoom(nickname || 'User');
  };

  const handleJoin = () => {
    if (!joinCode.trim()) return;
    onJoinRoom(joinCode.trim(), nickname || 'User');
  };

  return (
    <main className="app-main">
      <div className="room-setup">
        <div className="setup-hero">
          <div className="hero-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h2>Start a Translation Call</h2>
          <p className="hero-subtitle">
            Speak in your language. The other person hears it in theirs. Real-time.
          </p>
        </div>

        {/* Language selection */}
        <div className="card">
          <label className="field-label">I speak</label>
          <div className="select-wrapper">
            <span className="select-flag">{LANG_FLAGS[myLanguage] || ''}</span>
            <select
              value={myLanguage}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="lang-full-select"
            >
              {languages.map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Nickname */}
        <div className="card">
          <label className="field-label">Your name (optional)</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="Enter your name"
            className="text-input"
            maxLength={20}
          />
        </div>

        {/* Mode selection */}
        {mode === 'choice' && (
          <div className="room-actions">
            <button
              className="room-btn create-btn"
              onClick={() => setMode('create')}
              disabled={!isConnected}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create Room
              <span className="btn-hint">Start a new call and share the code</span>
            </button>

            <div className="divider-row">
              <span className="divider-line" />
              <span className="divider-text">or</span>
              <span className="divider-line" />
            </div>

            <button
              className="room-btn join-btn"
              onClick={() => setMode('join')}
              disabled={!isConnected}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Join Room
              <span className="btn-hint">Enter a room code to join someone</span>
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="room-actions">
            <button className="room-btn create-btn primary" onClick={handleCreate} disabled={!isConnected}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72" />
              </svg>
              Start Call
            </button>
            <button className="back-link" onClick={() => setMode('choice')}>
              Back
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="room-actions">
            <div className="card">
              <label className="field-label">Room code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123"
                className="text-input code-input"
                maxLength={6}
                autoFocus
              />
            </div>
            <button
              className="room-btn join-btn primary"
              onClick={handleJoin}
              disabled={!isConnected || joinCode.trim().length < 4}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Join Call
            </button>
            <button className="back-link" onClick={() => setMode('choice')}>
              Back
            </button>
          </div>
        )}

        {!isConnected && (
          <div className="warning-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Connecting to server...
          </div>
        )}
      </div>
    </main>
  );
};
