import { useState, useRef, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { AudioRecorder, AudioPlayer } from '../services/audio';

interface TranscriptEntry {
  id: string;
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
}

export function useTranslation(sourceLang: string, targetLang: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ['polling', 'websocket'],
    });

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('translation_result', (data: {
      originalText: string;
      translatedText: string;
      sourceLang: string;
      targetLang: string;
      audioData?: string;
    }) => {
      setTranscript((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          originalText: data.originalText,
          translatedText: data.translatedText,
          sourceLang: data.sourceLang,
          targetLang: data.targetLang,
          timestamp: Date.now(),
        },
      ]);

      // Play translated audio if available
      if (data.audioData && playerRef.current) {
        playTranslatedAudio(data.audioData);
      }
    });

    socket.on('error_message', (data: { message: string }) => {
      setError(data.message);
    });

    socketRef.current = socket;
    playerRef.current = new AudioPlayer();

    return () => {
      socket.disconnect();
      playerRef.current?.destroy();
    };
  }, []);

  async function playTranslatedAudio(base64Audio: string): Promise<void> {
    try {
      const binaryStr = atob(base64Audio);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      await playerRef.current?.play(bytes.buffer);
    } catch (err) {
      // Audio playback is best-effort; don't break the UI
      console.warn('Audio playback failed:', err);
    }
  }

  const startRecording = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit('join_session', { sourceLang, targetLang });

    try {
      const recorder = new AudioRecorder();
      recorderRef.current = recorder;

      await recorder.start((audioBlob: Blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          socket.emit('audio_chunk', {
            audioData: base64,
            sourceLang,
            targetLang,
          });
        };
        reader.readAsDataURL(audioBlob);
      });

      setIsRecording(true);
      setError(null);
    } catch (err) {
      const message = (err as Error).name === 'NotAllowedError'
        ? 'Microphone access denied'
        : 'Could not start recording';
      setError(message);
    }
  }, [sourceLang, targetLang]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    socketRef.current?.emit('leave_session');
    setIsRecording(false);
  }, []);

  return {
    isConnected,
    isRecording,
    transcript,
    error,
    startRecording,
    stopRecording,
  };
}
