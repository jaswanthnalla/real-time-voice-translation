import React from 'react';

interface Props {
  connected: boolean;
}

export const ConnectionStatus: React.FC<Props> = ({ connected }) => (
  <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
    <span className="status-dot" />
    {connected ? 'Connected' : 'Disconnected'}
  </div>
);
