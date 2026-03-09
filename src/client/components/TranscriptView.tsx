import React, { useRef, useEffect, useCallback } from 'react';
import { SUPPORTED_LANGUAGES } from '../../shared/constants';

interface TranscriptEntry {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
}

interface Props {
  entries: TranscriptEntry[];
}

export const TranscriptView: React.FC<Props> = ({ entries }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const copyText = useCallback((text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  }, []);

  const langName = (code: string) =>
    SUPPORTED_LANGUAGES[code] || code.toUpperCase();

  if (entries.length === 0) {
    return (
      <div className="transcript-view empty">
        <div className="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p>Your translations will appear here</p>
        <p className="empty-hint">Start speaking to see real-time translations</p>
      </div>
    );
  }

  return (
    <div className="transcript-view">
      {entries.map((entry) => (
        <div key={entry.id} className="transcript-entry">
          <div className="entry-row original">
            <span className="lang-badge source">{langName(entry.sourceLang)}</span>
            <span className="entry-text">{entry.originalText}</span>
            <button
              className="copy-btn"
              onClick={() => copyText(entry.originalText)}
              title="Copy original text"
              aria-label="Copy original text"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>
          <div className="entry-row translated">
            <span className="lang-badge target">{langName(entry.targetLang)}</span>
            <span className="entry-text">{entry.translatedText}</span>
            <button
              className="copy-btn"
              onClick={() => copyText(entry.translatedText)}
              title="Copy translated text"
              aria-label="Copy translated text"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>
          <time className="entry-time">
            {new Date(entry.timestamp).toLocaleTimeString()}
          </time>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};
