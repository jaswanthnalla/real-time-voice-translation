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
        <h1>Real-Time Voice Translation</h1>
        <div className="header-right">
          {isPlaying && (
            <span className="playing-indicator" title="Playing translated audio">
              <span className="speaker-icon">&#128266;</span>
            </span>
          )}
          <ConnectionStatus connected={isConnected} />
        </div>
      </header>

      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'translate' ? 'active' : ''}`}
          onClick={() => setActiveTab('translate')}
        >
          Live Translation
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
      </nav>

      {activeTab === 'translate' ? (
        <main className="app-main">
          <LanguageSelector
            sourceLang={sourceLang}
            targetLang={targetLang}
            onSourceChange={setSourceLang}
            onTargetChange={setTargetLang}
            disabled={isRecording}
          />

          {sameLang && (
            <div className="warning-banner">
              Source and target languages must be different
            </div>
          )}

          <TranslationPanel
            isRecording={isRecording}
            onStart={startRecording}
            onStop={stopRecording}
            disabled={!isConnected || sameLang}
          />

          {error && <div className="error-banner">{error}</div>}

          {interimText && (
            <div className="interim-text">
              <span className="interim-dot"></span>
              {interimText}
            </div>
          )}

          <TranscriptView entries={transcript} />

          {transcript.length > 0 && (
            <div className="transcript-actions">
              <button className="action-btn" onClick={() => exportTranscript(transcript, 'txt')}>
                Export TXT
              </button>
              <button className="action-btn" onClick={() => exportTranscript(transcript, 'json')}>
                Export JSON
              </button>
              <button className="action-btn clear-btn" onClick={clearTranscript}>
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
    </div>
  );
};
