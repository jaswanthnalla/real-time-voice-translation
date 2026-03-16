import { useState, useRef, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

// Web Speech API language code mapping (BCP 47 codes)
const SPEECH_LANG_MAP: Record<string, string> = {
  en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE',
  it: 'it-IT', pt: 'pt-BR', ru: 'ru-RU', zh: 'zh-CN',
  ja: 'ja-JP', ko: 'ko-KR', ar: 'ar-SA', hi: 'hi-IN',
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

/**
 * Voice-first translation hook.
 *
 * The core idea: when you receive a translation from the other person,
 * SPEAK it aloud first, then show the transcript after speech ends.
 * This makes it feel like a live interpreter — you hear the translation
 * in real time, and the text record appears afterward.
 *
 * Speech queue ensures translations don't overlap — they play in order.
 */
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
  const autoSpeakRef = useRef(autoSpeak);

  // Speech queue — translations are queued and spoken in order
  const speechQueueRef = useRef<Array<{
    text: string;
    lang: string;
    entry: TranscriptEntry;
  }>>([]);
  const isSpeakingRef = useRef(false);

  // Pending transcript entries that are waiting for speech to finish
  const pendingTranscriptsRef = useRef<Map<number, TranscriptEntry>>(new Map());

  // Keep refs in sync
  myLanguageRef.current = myLanguage;
  autoSpeakRef.current = autoSpeak;

  // Process the speech queue — speak the next item if idle
  const processSpeechQueue = useCallback(() => {
    if (isSpeakingRef.current) return;
    if (speechQueueRef.current.length === 0) return;
    if (!('speechSynthesis' in window)) return;

    const next = speechQueueRef.current.shift()!;
    isSpeakingRef.current = true;
    setIsSpeaking(true);

    // Cancel any stale speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(next.text);
    utterance.lang = SPEECH_LANG_MAP[next.lang] || next.lang;
    utterance.rate = 1.05; // Slightly faster for conversational feel
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onend = () => {
      isSpeakingRef.current = false;
      setIsSpeaking(false);

      // Now that speech is done, show the transcript entry
      setTranscript(prev => [...prev, next.entry]);

      // Remove from pending
      pendingTranscriptsRef.current.delete(next.entry.timestamp);

      // Process next in queue
      processSpeechQueue();
    };

    utterance.onerror = () => {
      isSpeakingRef.current = false;
      setIsSpeaking(false);

      // Show transcript even if speech failed
      setTranscript(prev => [...prev, next.entry]);
      pendingTranscriptsRef.current.delete(next.entry.timestamp);

      processSpeechQueue();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

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

    // Interim text — typing indicator (only shown to receiver)
    socket.on('interim_transcript', (data: {
      senderId: string;
      senderNickname: string;
      originalText: string;
      sourceLang: string;
    }) => {
      setInterimText(data.originalText);
      setInterimSender(data.senderNickname);
    });

    /**
     * 'speak_translation' — voice-priority event, sent to receiver only.
     * Queue this for immediate TTS. The transcript will arrive separately
     * via 'translation_result' and be held until speech finishes.
     */
    socket.on('speak_translation', (data: {
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

      if (!autoSpeakRef.current || !data.translatedText.trim()) return;

      const entry: TranscriptEntry = {
        id: `${data.timestamp}-${Math.random().toString(36).slice(2)}`,
        senderId: data.senderId,
        senderNickname: data.senderNickname,
        originalText: data.originalText,
        translatedText: data.translatedText,
        sourceLang: data.sourceLang,
        targetLang: data.targetLang,
        timestamp: data.timestamp,
      };

      // Mark this timestamp as pending (waiting for speech to finish)
      pendingTranscriptsRef.current.set(data.timestamp, entry);

      // Queue the speech
      speechQueueRef.current.push({
        text: data.translatedText,
        lang: myLanguageRef.current,
        entry,
      });

      processSpeechQueue();
    });

    /**
     * 'translation_result' — transcript event, sent to both users.
     *
     * For the SENDER: show transcript immediately (they said it, they know what it is).
     * For the RECEIVER: if this timestamp is pending (waiting for speech), skip —
     * the transcript will be added after TTS finishes. If autoSpeak is off or
     * if it's the same language, show immediately.
     */
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

      const isMe = data.senderId === socket.id;

      // If this is already pending in the speech queue, skip — it will be added after TTS
      if (!isMe && pendingTranscriptsRef.current.has(data.timestamp)) {
        return;
      }

      // Show transcript immediately (sender's own message, or autoSpeak is off)
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

      // If receiver, autoSpeak off, and different language — speak without delaying transcript
      if (!isMe && !autoSpeakRef.current && data.sourceLang !== myLanguageRef.current) {
        // No speech queuing in this case, just show text
      }
    });

    socket.on('translation_error', (data: { message: string }) => {
      setError(data.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [processSpeechQueue]);

  const createRoom = useCallback((nickname: string) => {
    socketRef.current?.emit('create_room', {
      language: myLanguageRef.current,
      nickname,
    });
  }, []);

  const joinRoom = useCallback((code: string, nickname: string) => {
    socketRef.current?.emit('join_room', {
      roomCode: code,
      language: myLanguageRef.current,
      nickname,
    });
  }, []);

  const leaveRoom = useCallback(() => {
    stopListening();
    window.speechSynthesis?.cancel();
    speechQueueRef.current = [];
    pendingTranscriptsRef.current.clear();
    isSpeakingRef.current = false;

    socketRef.current?.emit('leave_room');
    setRoomCode(null);
    setMyId(null);
    setParticipants([]);
    setTranscript([]);
    setInterimText(null);
    setInterimSender(null);
    setError(null);
    setIsSpeaking(false);
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

      if (interimTranscript) {
        socket.emit('speech_text', { text: interimTranscript, isFinal: false });
      }
      if (finalTranscript) {
        socket.emit('speech_text', { text: finalTranscript, isFinal: true });
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access and try again.');
      }
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening
      if (recognitionRef.current === recognition) {
        try { recognition.start(); } catch { /* already started or page closed */ }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
      setError(null);
    } catch {
      setError('Could not start speech recognition.');
    }
  }, [roomCode]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      try { recognition.stop(); } catch { /* already stopped */ }
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
