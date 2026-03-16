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
 * Live phone-call translation hook.
 *
 * Cancel-and-replace model: when a new interim translation arrives,
 * cancel whatever is currently being spoken and immediately speak the
 * new version. This creates a continuous, overlapping feel — like a
 * simultaneous interpreter whispering in your ear while the other
 * person talks. Both users' mics stay on (full duplex).
 *
 * Final translations replace the last interim speech cleanly, and
 * the transcript entry is added only after the final speech finishes.
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

  // Track the current utterance so we can cancel it on new interim
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Keep refs in sync
  myLanguageRef.current = myLanguage;
  autoSpeakRef.current = autoSpeak;

  /**
   * Speak text immediately, cancelling any ongoing speech.
   * This is the core of the "cancel-and-replace" pattern:
   * each new interim chunk interrupts the previous one,
   * so the listener always hears the most up-to-date translation.
   */
  const speakNow = useCallback((text: string, lang: string, onEnd?: () => void) => {
    if (!('speechSynthesis' in window) || !text.trim()) {
      onEnd?.();
      return;
    }

    // Cancel whatever is playing — new speech takes priority
    window.speechSynthesis.cancel();
    currentUtteranceRef.current = null;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = SPEECH_LANG_MAP[lang] || lang;
    utterance.rate = 1.1; // Slightly faster for natural conversation pace
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      currentUtteranceRef.current = null;
      setIsSpeaking(false);
      onEnd?.();
    };

    utterance.onerror = () => {
      currentUtteranceRef.current = null;
      setIsSpeaking(false);
      onEnd?.();
    };

    currentUtteranceRef.current = utterance;
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

    /**
     * 'live_voice' — the core phone-call event.
     *
     * INTERIM (isFinal=false): cancel current speech, speak the new
     * interim translation immediately. This creates continuous streaming
     * — like hearing the interpreter adjust in real time.
     *
     * FINAL (isFinal=true): cancel interim speech, speak the clean
     * final translation. Add transcript entry after speech finishes.
     */
    socket.on('live_voice', (data: {
      senderId: string;
      senderNickname: string;
      text: string;
      translatedText: string;
      sourceLang: string;
      targetLang: string;
      isFinal: boolean;
    }) => {
      if (data.isFinal) {
        // Final translation — speak it cleanly and add to transcript after
        setInterimText(null);
        setInterimSender(null);

        if (autoSpeakRef.current && data.translatedText.trim()) {
          speakNow(data.translatedText, myLanguageRef.current, () => {
            // Transcript appears after speech ends — voice-first
            setTranscript(prev => [
              ...prev,
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                senderId: data.senderId,
                senderNickname: data.senderNickname,
                originalText: data.text,
                translatedText: data.translatedText,
                sourceLang: data.sourceLang,
                targetLang: data.targetLang,
                timestamp: Date.now(),
              },
            ]);
          });
        }
      } else {
        // Interim — show live text and speak it (cancel-and-replace)
        setInterimText(data.translatedText);
        setInterimSender(data.senderNickname);

        if (autoSpeakRef.current && data.translatedText.trim()) {
          speakNow(data.translatedText, myLanguageRef.current);
        }
      }
    });

    /**
     * 'translation_result' — transcript event sent to BOTH users.
     * The sender sees their own message in the transcript immediately.
     * The receiver already got the voice via 'live_voice' above,
     * so we only add the transcript for the sender here.
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
      const isMe = data.senderId === socket.id;

      if (isMe) {
        // Sender sees their own message immediately in transcript
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
      }
      // Receiver's transcript is added after live_voice final speech ends
    });

    socket.on('translation_error', (data: { message: string }) => {
      setError(data.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [speakNow]);

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
    currentUtteranceRef.current = null;

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
