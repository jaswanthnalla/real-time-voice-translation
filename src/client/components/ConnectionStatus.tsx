import React from 'react';

interface Props {
  connected: boolean;
}

export const ConnectionStatus: React.FC<Props> = ({ connected }) => (
  <div className={`conn-status ${connected ? 'online' : 'offline'}`}>
    <span className="conn-dot" />
    <span>{connected ? 'Live' : 'Offline'}</span>
  </div>
);
