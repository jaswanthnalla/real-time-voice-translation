import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// ── Types ──
interface SubtitleEntry {
  id: string;
  speaker: 'A' | 'B';
  originalText: string;
  translatedText: string;
  isFinal: boolean;
  sourceLanguage: string;
  targetLanguage: string;
  timestamp: number;
  latencyMs?: number;
}

type ConnectionStatus = 'disconnected' | 'connected' | 'active' | 'error' | 'mic_denied';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '\u{1F1FA}\u{1F1F8}' },
  { code: 'es', name: 'Spanish', flag: '\u{1F1EA}\u{1F1F8}' },
  { code: 'fr', name: 'French', flag: '\u{1F1EB}\u{1F1F7}' },
  { code: 'de', name: 'German', flag: '\u{1F1E9}\u{1F1EA}' },
  { code: 'it', name: 'Italian', flag: '\u{1F1EE}\u{1F1F9}' },
  { code: 'pt', name: 'Portuguese', flag: '\u{1F1E7}\u{1F1F7}' },
  { code: 'ru', name: 'Russian', flag: '\u{1F1F7}\u{1F1FA}' },
  { code: 'zh', name: 'Chinese', flag: '\u{1F1E8}\u{1F1F3}' },
  { code: 'ja', name: 'Japanese', flag: '\u{1F1EF}\u{1F1F5}' },
  { code: 'ko', name: 'Korean', flag: '\u{1F1F0}\u{1F1F7}' },
  { code: 'ar', name: 'Arabic', flag: '\u{1F1F8}\u{1F1E6}' },
  { code: 'hi', name: 'Hindi', flag: '\u{1F1EE}\u{1F1F3}' },
];

// In dev, connect through webpack proxy (same origin); in prod, use configured URL
const API_URL = process.env.REACT_APP_API_URL || window.location.origin;

export default function App(): React.ReactElement {
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('es');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [avgLatency, setAvgLatency] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const subtitleEndRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // ── Socket.IO connection ──
  useEffect(() => {
    // Connect to same origin — in dev, webpack proxy forwards /socket.io to backend
    const socket = io({
      transports: ['polling', 'websocket'],
      path: '/socket.io',
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      setStatus('connected');
    });

    socket.on('disconnect', () => {
      setStatus('disconnected');
    });

    socket.on('connect_error', () => {
      setStatus('error');
    });

    // Receive live subtitles from server
    socket.on('subtitle', (data: SubtitleEntry) => {
      setSubtitles((prev) => {
        // Replace interim entries for the same speaker with the latest
        if (!data.isFinal) {
          const filtered = prev.filter(
            (s) => !(s.speaker === data.speaker && !s.isFinal),
          );
          return [...filtered, { ...data, id: `${data.speaker}-interim`, timestamp: Date.now() }];
        }

        // For final entries, remove the interim and append
        const filtered = prev.filter(
          (s) => !(s.speaker === data.speaker && !s.isFinal),
        );
        return [...filtered, { ...data, id: `${Date.now()}-${data.speaker}`, timestamp: Date.now() }];
      });
    });

    // Receive translated audio for playback
    socket.on('audio:translated', (data: {
      audioContent: string;
      encoding: string;
      sampleRate: number;
    }) => {
      playTranslatedAudio(data.audioContent, data.sampleRate);
    });

    // Session created
    socket.on('session:created', (data: { sessionId: string }) => {
      setSessionId(data.sessionId);
      setStatus('active');
    });

    // Pipeline result with latency
    socket.on('pipeline:result', (data: { totalLatencyMs: number }) => {
      setAvgLatency((prev) => Math.round((prev + data.totalLatencyMs) / 2));
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  // Auto-scroll subtitles
  useEffect(() => {
    subtitleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [subtitles]);

  // ── Audio Visualizer ──
  const drawVisualizer = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = (): void => {
      requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = '#111128';
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#6366f1';
      ctx.beginPath();

      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
    };

    draw();
  }, []);

  // ── Start Recording & Translation ──
  const startRecording = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      mediaStreamRef.current = stream;
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);

      // Analyser for visualizer
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Script processor to capture raw audio
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = (e: AudioProcessingEvent): void => {
        if (!socketRef.current || !sessionId) return;

        const inputData = e.inputBuffer.getChannelData(0);

        // Convert Float32 to 16-bit PCM then to base64
        const pcm16 = float32ToInt16(inputData);
        const base64Audio = arrayBufferToBase64(pcm16.buffer);

        socketRef.current.emit('audio:chunk', {
          sessionId,
          speaker: 'A',
          audio: base64Audio,
        });
      };

      // Start session on server
      socketRef.current?.emit('session:start', {
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
      });

      setIsRecording(true);
      drawVisualizer();
    } catch (err) {
      const isDenied = err instanceof DOMException &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      setStatus(isDenied ? 'mic_denied' : 'error');
    }
  };

  const stopRecording = (): void => {
    // Stop audio processing
    processorRef.current?.disconnect();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioContextRef.current?.close();

    // End session on server
    if (sessionId) {
      socketRef.current?.emit('session:end', sessionId);
    }

    setIsRecording(false);
    setSessionId(null);
    setStatus('connected');
  };

  const swapLanguages = (): void => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
  };

  return (
    <>
      {/* Header */}
      <div className="header">
        <h1>Real-Time Voice Translation</h1>
        <p>Speak naturally — hear the translation instantly</p>
      </div>

      {/* Status */}
      <div className="status-bar">
        <div className={`status-dot ${status}`} />
        <span>
          {status === 'disconnected' && 'Disconnected'}
          {status === 'connected' && 'Ready'}
          {status === 'active' && 'Translating...'}
          {status === 'error' && 'Connection error'}
          {status === 'mic_denied' && 'Microphone access denied — allow mic in browser settings'}
        </span>
        {avgLatency > 0 && (
          <span className="latency"> | Latency: <span>{avgLatency}ms</span></span>
        )}
      </div>

      {/* Language Selector */}
      <div className="language-selector">
        <select
          className="lang-select"
          value={sourceLang}
          onChange={(e) => setSourceLang(e.target.value)}
          disabled={isRecording}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag} {l.name}
            </option>
          ))}
        </select>

        <button className="swap-btn" onClick={swapLanguages} disabled={isRecording}>
          &#8644;
        </button>

        <select
          className="lang-select"
          value={targetLang}
          onChange={(e) => setTargetLang(e.target.value)}
          disabled={isRecording}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.flag} {l.name}
            </option>
          ))}
        </select>
      </div>

      {/* Main Content */}
      <div className="main">
        {/* Live Subtitles */}
        <div className="subtitle-panel">
          <div className="subtitle-panel-header">Live Translation</div>
          <div className="subtitle-entries">
            {subtitles.length === 0 ? (
              <div className="empty-state">
                <div className="icon">&#127911;</div>
                <p>Press the microphone to start translating</p>
              </div>
            ) : (
              subtitles.map((entry) => (
                <div
                  key={entry.id}
                  className={`subtitle-entry ${entry.isFinal ? '' : 'interim'}`}
                >
                  <div className={`speaker ${entry.speaker.toLowerCase()}`}>
                    Speaker {entry.speaker}
                    {' '}&middot;{' '}
                    {LANGUAGES.find((l) => l.code === entry.sourceLanguage)?.name}
                    {' '}&rarr;{' '}
                    {LANGUAGES.find((l) => l.code === entry.targetLanguage)?.name}
                  </div>
                  <div className="original">{entry.originalText}</div>
                  <div className="translated">{entry.translatedText}</div>
                  {entry.isFinal && entry.latencyMs && (
                    <div className="meta">{entry.latencyMs}ms</div>
                  )}
                </div>
              ))
            )}
            <div ref={subtitleEndRef} />
          </div>
        </div>

        {/* Audio Visualizer */}
        <div className="visualizer">
          <canvas ref={canvasRef} width={800} height={60} />
        </div>
      </div>

      {/* Controls */}
      <div className="controls">
        <button
          className={`mic-btn ${isRecording ? 'recording' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
        >
          {isRecording ? '\u23F9' : '\u{1F3A4}'}
        </button>
        <button
          className={`end-btn ${sessionId ? 'visible' : ''}`}
          onClick={stopRecording}
        >
          End Session
        </button>
      </div>

      <div className="latency">
        {isRecording && avgLatency > 0 && (
          <>Average pipeline latency: <span>{avgLatency}ms</span></>
        )}
      </div>
    </>
  );
}

// ── Audio Helpers ──

function float32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16Array;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Play translated audio through the browser speakers.
 * Decodes the base64 audio from TTS and plays it via Web Audio API.
 */
async function playTranslatedAudio(base64Audio: string, sampleRate: number): Promise<void> {
  try {
    const audioContext = new AudioContext({ sampleRate });
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // For LINEAR16, convert to Float32 for Web Audio API
    const float32 = new Float32Array(bytes.length / 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < float32.length; i++) {
      float32[i] = view.getInt16(i * 2, true) / 32768;
    }

    const audioBuffer = audioContext.createBuffer(1, float32.length, sampleRate);
    audioBuffer.copyToChannel(float32, 0);

    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    source.start();
  } catch (err) {
    console.error('Error playing translated audio:', err);
  }
}
