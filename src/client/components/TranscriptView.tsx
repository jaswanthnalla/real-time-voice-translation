import React, { useRef, useEffect } from 'react';

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

  if (entries.length === 0) {
    return (
      <div className="transcript-view empty">
        <p>Transcript will appear here once you start translating.</p>
      </div>
    );
  }

  return (
    <div className="transcript-view">
      {entries.map((entry) => (
        <div key={entry.id} className="transcript-entry">
          <div className="original">
            <span className="lang-badge">{entry.sourceLang}</span>
            {entry.originalText}
          </div>
          <div className="translated">
            <span className="lang-badge">{entry.targetLang}</span>
            {entry.translatedText}
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
