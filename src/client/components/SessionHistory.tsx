import React, { useState, useEffect } from 'react';

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
    if (!ms) return '-';
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    return mins > 0 ? `${mins}m ${secs % 60}s` : `${secs}s`;
  }

  if (loading) {
    return <div className="session-history loading">Loading sessions...</div>;
  }

  if (error) {
    return <div className="session-history error">{error}</div>;
  }

  if (sessions.length === 0) {
    return (
      <div className="session-history empty">
        No previous sessions found. Start a translation to create one.
      </div>
    );
  }

  return (
    <div className="session-history">
      <h3>Session History</h3>
      <div className="session-list">
        {sessions.map((session) => (
          <div key={session.id} className={`session-item ${session.status}`}>
            <div className="session-info">
              <span className="session-langs">
                {session.sourceLang.toUpperCase()} → {session.targetLang.toUpperCase()}
              </span>
              <span className={`session-status ${session.status}`}>{session.status}</span>
            </div>
            <div className="session-meta">
              <span>{new Date(session.createdAt).toLocaleString()}</span>
              <span>{formatDuration(session.duration)}</span>
              <span>{session.transcriptCount} entries</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
