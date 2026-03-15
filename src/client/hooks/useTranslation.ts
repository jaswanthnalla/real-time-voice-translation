import { useState, useRef, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
// Web Speech API language code mapping (BCP 47 codes)
const SPEECH_LANG_MAP: Record<string, string> = {
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-BR',
  ru: 'ru-RU',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
  ar: 'ar-SA',
  hi: 'hi-IN',
};

export interface TranscriptEntry {
  id: string;
  senderId: string;
  senderNickname: string;
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
}

export interface Participant {
  id: string;
  nickname: string;
  language: string;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

export function useTranslation(myLanguage: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [interimText, setInterimText] = useState<string | null>(null);
  const [interimSender, setInterimSender] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);

  const socketRef = useRef<Socket | null>(null);
  const recognitionRef = useRef<any>(null);
  const myLanguageRef = useRef(myLanguage);

  // Keep ref in sync
  myLanguageRef.current = myLanguage;

  // Initialize Socket.IO connection
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

    socket.on('room_created', (data: { roomCode: string; userId: string }) => {
      setRoomCode(data.roomCode);
      setMyId(data.userId);
      setError(null);
    });

    socket.on('room_joined', (data: { roomCode: string; userId: string; participants: Participant[] }) => {
      setRoomCode(data.roomCode);
      setMyId(data.userId);
      setParticipants(data.participants);
      setError(null);
    });

    socket.on('room_error', (data: { message: string }) => {
      setError(data.message);
    });

    socket.on('participant_joined', (participant: Participant) => {
      setParticipants(prev => [...prev.filter(p => p.id !== participant.id), participant]);
    });

    socket.on('participant_left', (data: { id: string; nickname: string }) => {
      setParticipants(prev => prev.filter(p => p.id !== data.id));
    });

    socket.on('interim_transcript', (data: {
      senderId: string;
      senderNickname: string;
      originalText: string;
      sourceLang: string;
    }) => {
      setInterimText(data.originalText);
      setInterimSender(data.senderNickname);
    });

    socket.on('translation_result', (data: {
      senderId: string;
      senderNickname: string;
      originalText: string;
      translatedText: string;
      sourceLang: string;
      targetLang: string;
      timestamp: number;
    }) => {
      setInterimText(null);
      setInterimSender(null);

      setTranscript(prev => [
        ...prev,
        {
          id: `${data.timestamp}-${Math.random().toString(36).slice(2)}`,
          senderId: data.senderId,
          senderNickname: data.senderNickname,
          originalText: data.originalText,
          translatedText: data.translatedText,
          sourceLang: data.sourceLang,
          targetLang: data.targetLang,
          timestamp: data.timestamp,
        },
      ]);

      // Auto-speak translated text for the OTHER user (not the sender)
      if (data.senderId !== socket.id && data.sourceLang !== myLanguageRef.current) {
        speakText(data.translatedText, myLanguageRef.current);
      }
    });

    socket.on('translation_error', (data: { message: string }) => {
      setError(data.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  // Speak translated text using browser SpeechSynthesis
  const speakText = useCallback((text: string, lang: string) => {
    if (!autoSpeak || !text.trim()) return;
    if (!('speechSynthesis' in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LANG_MAP[lang] || lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [autoSpeak]);

  // Create a room
  const createRoom = useCallback((nickname: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit('create_room', {
      language: myLanguageRef.current,
      nickname,
    });
  }, []);

  // Join a room
  const joinRoom = useCallback((code: string, nickname: string) => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.emit('join_room', {
      roomCode: code,
      language: myLanguageRef.current,
      nickname,
    });
  }, []);

  // Leave current room
  const leaveRoom = useCallback(() => {
    stopListening();
    socketRef.current?.emit('leave_room');
    setRoomCode(null);
    setMyId(null);
    setParticipants([]);
    setTranscript([]);
    setInterimText(null);
    setInterimSender(null);
    setError(null);
  }, []);

  // Start listening (Web Speech API for STT)
  const startListening = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || !roomCode) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = SPEECH_LANG_MAP[myLanguageRef.current] || myLanguageRef.current;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;

        if (result.isFinal) {
          finalTranscript += text;
        } else {
          interimTranscript += text;
        }
      }

      // Send interim text for real-time display
      if (interimTranscript) {
        socket.emit('speech_text', { text: interimTranscript, isFinal: false });
      }

      // Send final text for translation
      if (finalTranscript) {
        socket.emit('speech_text', { text: finalTranscript, isFinal: true });
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') return; // Normal — user just isn't talking
      if (event.error === 'aborted') return; // We stopped it intentionally

      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access and try again.');
      }
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening
      if (recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          // Already started or page closed
        }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
      setError(null);
    } catch (err) {
      setError('Could not start speech recognition.');
    }
  }, [roomCode]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      const recognition = recognitionRef.current;
      recognitionRef.current = null; // Clear ref before stopping to prevent auto-restart
      try {
        recognition.stop();
      } catch {
        // Already stopped
      }
    }
    setIsListening(false);
    setInterimText(null);
    setInterimSender(null);
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript([]);
  }, []);

  return {
    isConnected,
    isListening,
    isSpeaking,
    roomCode,
    myId,
    participants,
    interimText,
    interimSender,
    transcript,
    error,
    autoSpeak,
    setAutoSpeak,
    createRoom,
    joinRoom,
    leaveRoom,
    startListening,
    stopListening,
    clearTranscript,
  };
}
