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
    <main className="setup">
      <div className="setup-intro">
        <h2>Speak freely across languages</h2>
        <p>
          You speak in your language. They hear it in theirs. Real-time translation for voice calls.
        </p>
      </div>

      {/* Pipeline visualization */}
      <div className="pipeline">
        <div className="pipeline-step">
          <div className="pipeline-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
          </div>
          <span className="pipeline-label">You speak</span>
        </div>

        <svg className="pipeline-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>

        <div className="pipeline-step">
          <div className="pipeline-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </div>
          <span className="pipeline-label">Translate</span>
        </div>

        <svg className="pipeline-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>

        <div className="pipeline-step">
          <div className="pipeline-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            </svg>
          </div>
          <span className="pipeline-label">They hear</span>
        </div>
      </div>

      {/* Language selection */}
      <div className="field">
        <label className="field-label">I speak</label>
        <div className="select-wrap">
          <span className="select-flag">{LANG_FLAGS[myLanguage] || ''}</span>
          <select
            value={myLanguage}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="lang-select"
          >
            {languages.map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Nickname */}
      <div className="field">
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
        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={() => setMode('create')}
            disabled={!isConnected}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Room
          </button>

          <div className="divider">
            <span className="divider-line" />
            <span className="divider-label">or</span>
            <span className="divider-line" />
          </div>

          <button
            className="btn"
            onClick={() => setMode('join')}
            disabled={!isConnected}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Join Room
          </button>
        </div>
      )}

      {mode === 'create' && (
        <div className="actions">
          <button className="btn btn-primary" onClick={handleCreate} disabled={!isConnected}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72" />
            </svg>
            Start Call
          </button>
          <button className="btn btn-text" onClick={() => setMode('choice')}>
            Back
          </button>
        </div>
      )}

      {mode === 'join' && (
        <div className="actions">
          <div className="field">
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
            className="btn btn-primary"
            onClick={handleJoin}
            disabled={!isConnected || joinCode.trim().length < 4}
          >
            Join Call
          </button>
          <button className="btn btn-text" onClick={() => setMode('choice')}>
            Back
          </button>
        </div>
      )}

      {!isConnected && (
        <div className="connecting-notice">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          Connecting to server...
        </div>
      )}
    </main>
  );
};
