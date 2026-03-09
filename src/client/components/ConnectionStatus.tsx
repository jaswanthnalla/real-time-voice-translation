import React from 'react';

interface Props {
  connected: boolean;
}

export const ConnectionStatus: React.FC<Props> = ({ connected }) => (
  <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
    <span className="status-dot" />
    <span className="status-label">{connected ? 'Live' : 'Offline'}</span>
  </div>
);
