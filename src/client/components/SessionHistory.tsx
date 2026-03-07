import React, { useState, useEffect } from 'react';
import { SUPPORTED_LANGUAGES } from '../../shared/constants';

interface SessionSummary {
  id: string;
  sourceLang: string;
  targetLang: string;
  status: string;
  createdAt: string;
  duration?: number;
  transcriptCount: number;
}

export const SessionHistory: React.FC = () => {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions(): Promise<void> {
    try {
      setLoading(true);
      const res = await fetch('/api/sessions');
      const data = await res.json();
      if (data.success) {
        setSessions(data.data || []);
      }
    } catch (err) {
      setError('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }

  function formatDuration(ms?: number): string {
    if (!ms) return '--:--';
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  }

  const langName = (code: string) =>
    SUPPORTED_LANGUAGES[code] || code.toUpperCase();

  if (loading) {
    return (
      <div className="session-history loading">
        <div className="spinner" />
        <span>Loading sessions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="session-history error-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <p>{error}</p>
        <button className="retry-btn" onClick={fetchSessions}>Try again</button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="session-history empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <p>No sessions yet</p>
        <p className="empty-hint">Your translation sessions will appear here</p>
      </div>
    );
  }

  return (
    <div className="session-history">
      <div className="session-header">
        <h3>Recent Sessions</h3>
        <span className="session-count">{sessions.length} sessions</span>
      </div>
      <div className="session-list">
        {sessions.map((session) => (
          <div key={session.id} className={`session-item ${session.status}`}>
            <div className="session-info">
              <span className="session-langs">
                {langName(session.sourceLang)} &rarr; {langName(session.targetLang)}
              </span>
              <span className={`session-status ${session.status}`}>{session.status}</span>
            </div>
            <div className="session-meta">
              <span className="meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                {formatDuration(session.duration)}
              </span>
              <span className="meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                {session.transcriptCount} entries
              </span>
              <span className="meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                {new Date(session.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
