import { useState, useRef, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { AudioRecorder } from '../services/audio';

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

  const socketRef = useRef<Socket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);

  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ['websocket'],
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('translation_result', (data: {
      originalText: string;
      translatedText: string;
      sourceLang: string;
      targetLang: string;
    }) => {
      setTranscript((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          ...data,
          timestamp: Date.now(),
        },
      ]);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  const startRecording = useCallback(async () => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit('join_session', { sourceLang, targetLang });

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
    startRecording,
    stopRecording,
  };
}
