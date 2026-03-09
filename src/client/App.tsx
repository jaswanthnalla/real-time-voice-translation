import React, { useState } from 'react';
import { TranslationPanel } from './components/TranslationPanel';
import { LanguageSelector } from './components/LanguageSelector';
import { TranscriptView } from './components/TranscriptView';
import { ConnectionStatus } from './components/ConnectionStatus';
import { SessionHistory } from './components/SessionHistory';
import { useTranslation } from './hooks/useTranslation';
import { exportTranscript } from './utils/export';

type Tab = 'translate' | 'history';

export const App: React.FC = () => {
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('es');
  const [activeTab, setActiveTab] = useState<Tab>('translate');

  const {
    isConnected,
    isRecording,
    isPlaying,
    interimText,
    transcript,
    error,
    startRecording,
    stopRecording,
    clearTranscript,
  } = useTranslation(sourceLang, targetLang);

  const sameLang = sourceLang === targetLang;

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
          {isPlaying && (
            <div className="playing-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              Playing
            </div>
          )}
          <ConnectionStatus connected={isConnected} />
        </div>
      </header>

      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'translate' ? 'active' : ''}`}
          onClick={() => setActiveTab('translate')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          </svg>
          Translate
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          History
        </button>
      </nav>

      {activeTab === 'translate' ? (
        <main className="app-main">
          <div className="card">
            <LanguageSelector
              sourceLang={sourceLang}
              targetLang={targetLang}
              onSourceChange={setSourceLang}
              onTargetChange={setTargetLang}
              disabled={isRecording}
            />
          </div>

          {sameLang && (
            <div className="warning-banner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Source and target languages must be different
            </div>
          )}

          <TranslationPanel
            isRecording={isRecording}
            onStart={startRecording}
            onStop={stopRecording}
            disabled={!isConnected || sameLang}
          />

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

          {interimText && (
            <div className="interim-text">
              <span className="interim-dot" />
              <span className="interim-content">{interimText}</span>
            </div>
          )}

          <TranscriptView entries={transcript} />

          {transcript.length > 0 && (
            <div className="transcript-actions">
              <button className="action-btn" onClick={() => exportTranscript(transcript, 'txt')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export TXT
              </button>
              <button className="action-btn" onClick={() => exportTranscript(transcript, 'json')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export JSON
              </button>
              <button className="action-btn clear-btn" onClick={clearTranscript}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Clear
              </button>
            </div>
          )}
        </main>
      ) : (
        <main className="app-main">
          <SessionHistory />
        </main>
      )}

      <footer className="app-footer">
        <span>VoiceTranslate v1.0</span>
        <span>12 languages supported</span>
      </footer>
    </div>
  );
};
