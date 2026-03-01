import { EventEmitter } from 'events';

export class AudioBuffer extends EventEmitter {
  private buffer: Buffer[] = [];
  private totalBytes = 0;
  private readonly flushThresholdBytes: number;
  private readonly flushTimeoutMs: number;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(flushThresholdBytes = 4096, flushTimeoutMs = 250) {
    super();
    this.flushThresholdBytes = flushThresholdBytes;
    this.flushTimeoutMs = flushTimeoutMs;
  }

  append(chunk: Buffer): void {
    this.buffer.push(chunk);
    this.totalBytes += chunk.length;

    if (this.totalBytes >= this.flushThresholdBytes) {
      this.doFlush();
    } else if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.doFlush(), this.flushTimeoutMs);
    }
  }

  flush(): Buffer | null {
    return this.doFlush();
  }

  private doFlush(): Buffer | null {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.buffer.length === 0) return null;
    const result = Buffer.concat(this.buffer);
    this.buffer = [];
    this.totalBytes = 0;
    this.emit('flush', result);
    return result;
  }

  reset(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    this.buffer = [];
    this.totalBytes = 0;
  }

  get size(): number {
    return this.totalBytes;
  }
}
