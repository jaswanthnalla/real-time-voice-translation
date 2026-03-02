import client from 'prom-client';
import { config } from '../config';

if (config.metrics.enabled) {
  client.collectDefaultMetrics({ prefix: 'voice_translation_' });
}

export const translationCounter = new client.Counter({
  name: 'voice_translation_translations_total',
  help: 'Total number of translations processed',
  labelNames: ['source_lang', 'target_lang', 'status'] as const,
});

export const translationDuration = new client.Histogram({
  name: 'voice_translation_pipeline_duration_seconds',
  help: 'Translation pipeline duration in seconds',
  labelNames: ['stage'] as const,
  buckets: [0.1, 0.25, 0.5, 1, 1.5, 2, 5],
});

export const activeSessionsGauge = new client.Gauge({
  name: 'voice_translation_active_sessions',
  help: 'Number of active translation sessions',
});

export const websocketConnectionsGauge = new client.Gauge({
  name: 'voice_translation_websocket_connections',
  help: 'Number of active WebSocket connections',
});

export const metricsRegistry = client.register;
