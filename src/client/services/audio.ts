export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private onDataCallback: ((data: Blob) => void) | null = null;

  async start(onData: (data: Blob) => void): Promise<void> {
    this.onDataCallback = onData;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: this.getSupportedMimeType(),
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.onDataCallback) {
        this.onDataCallback(event.data);
      }
    };

    this.mediaRecorder.start(250); // emit chunks every 250ms
  }

  stop(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.onDataCallback = null;
  }

  private getSupportedMimeType(): string {
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
  }
}

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private onPlayStart?: () => void;
  private onPlayEnd?: () => void;

  setCallbacks(onStart: () => void, onEnd: () => void): void {
    this.onPlayStart = onStart;
    this.onPlayEnd = onEnd;
  }

  async play(audioData: ArrayBuffer): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    const audioBuffer = await this.audioContext.decodeAudioData(audioData.slice(0));
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);
    this.onPlayStart?.();
    source.onended = () => {
      this.onPlayEnd?.();
    };
    source.start(0);
  }

  destroy(): void {
    this.audioContext?.close();
    this.audioContext = null;
  }
}
