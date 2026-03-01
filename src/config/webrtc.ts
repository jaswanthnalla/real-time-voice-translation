import config from './index';
import { ICEServerConfig } from '../types/webrtc';

export function getICEServers(): ICEServerConfig[] {
  const servers: ICEServerConfig[] = [
    { urls: config.webrtc.stunServer },
  ];

  if (config.webrtc.turnServer) {
    servers.push({
      urls: config.webrtc.turnServer,
      username: config.webrtc.turnUsername,
      credential: config.webrtc.turnCredential,
    });
  }

  return servers;
}
