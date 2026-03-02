import React, { useState } from 'react';
import { TranslationPanel } from './components/TranslationPanel';
import { LanguageSelector } from './components/LanguageSelector';
import { TranscriptView } from './components/TranscriptView';
import { ConnectionStatus } from './components/ConnectionStatus';
import { useTranslation } from './hooks/useTranslation';

export const App: React.FC = () => {
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('es');

  const {
    isConnected,
    isRecording,
    transcript,
    startRecording,
    stopRecording,
  } = useTranslation(sourceLang, targetLang);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Real-Time Voice Translation</h1>
        <ConnectionStatus connected={isConnected} />
      </header>

      <main className="app-main">
        <LanguageSelector
          sourceLang={sourceLang}
          targetLang={targetLang}
          onSourceChange={setSourceLang}
          onTargetChange={setTargetLang}
          disabled={isRecording}
        />

        <TranslationPanel
          isRecording={isRecording}
          onStart={startRecording}
          onStop={stopRecording}
          disabled={!isConnected}
        />

        <TranscriptView entries={transcript} />
      </main>
    </div>
  );
};
