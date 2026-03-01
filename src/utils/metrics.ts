import client from 'prom-client';

const register = new client.Registry();

client.collectDefaultMetrics({ register });

export const callTotal = new client.Counter({
  name: 'voice_translate_calls_total',
  help: 'Total number of calls',
  labelNames: ['type', 'status'],
  registers: [register],
});

export const callActive = new client.Gauge({
  name: 'voice_translate_calls_active',
  help: 'Number of currently active calls',
  registers: [register],
});

export const callDuration = new client.Histogram({
  name: 'voice_translate_call_duration_seconds',
  help: 'Call duration in seconds',
  buckets: [30, 60, 120, 300, 600, 1800, 3600],
  registers: [register],
});

export const translationLatency = new client.Histogram({
  name: 'voice_translate_translation_latency_ms',
  help: 'Translation pipeline latency in milliseconds',
  labelNames: ['stage'],
  buckets: [50, 100, 200, 300, 500, 750, 1000, 1500, 2000],
  registers: [register],
});

export const audioChunksProcessed = new client.Counter({
  name: 'voice_translate_audio_chunks_processed_total',
  help: 'Total audio chunks processed',
  labelNames: ['direction'],
  registers: [register],
});

export const errorTotal = new client.Counter({
  name: 'voice_translate_errors_total',
  help: 'Total errors',
  labelNames: ['service', 'type'],
  registers: [register],
});

export const websocketConnections = new client.Gauge({
  name: 'voice_translate_websocket_connections',
  help: 'Number of active WebSocket connections',
  registers: [register],
});

export function getMetricsRegistry(): client.Registry {
  return register;
}
