import { useState, useRef, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

// Web Speech API language code mapping (BCP 47 codes)
const SPEECH_LANG_MAP: Record<string, string> = {
  en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE',
  it: 'it-IT', pt: 'pt-BR', ru: 'ru-RU', zh: 'zh-CN',
  ja: 'ja-JP', ko: 'ko-KR', ar: 'ar-SA', hi: 'hi-IN',
  te: 'te-IN', ta: 'ta-IN', kn: 'kn-IN', ml: 'ml-IN',
  bn: 'bn-IN', mr: 'mr-IN', gu: 'gu-IN', pa: 'pa-IN',
  ur: 'ur-PK', th: 'th-TH', vi: 'vi-VN', tr: 'tr-TR',
  nl: 'nl-NL', pl: 'pl-PL', sv: 'sv-SE', id: 'id-ID',
  ms: 'ms-MY',
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
 * Voice translation hook — phone-call feel.
 *
 * How it works:
 * - Partner speaks → you see live translated subtitles updating in real-time
 * - Partner pauses → final translation is spoken aloud through your speaker
 * - After speech finishes → transcript entry appears (voice-first)
 * - Both mics stay on — full duplex, simultaneous conversation
 *
 * TTS uses a queue to prevent overlapping speech. Interim text is
 * visual-only (subtitles) because partial speech recognition is too
 * inaccurate for TTS.
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

  // Speech queue — final translations are queued and spoken in order
  // This prevents overlapping TTS and ensures clean, sequential playback
  const speechQueueRef = useRef<Array<{
    text: string;
    lang: string;
    onDone: () => void;
  }>>([]);
  const isSpeakingRef = useRef(false);

  // When TTS is playing, we mute the mic to prevent the speaker audio
  // from being picked up and re-transcribed (echo/feedback loop).
  // This is the #1 cause of phantom transcriptions.
  const micMutedRef = useRef(false);

  // Keep refs in sync
  myLanguageRef.current = myLanguage;
  autoSpeakRef.current = autoSpeak;

  /**
   * Process the speech queue — speak the next item if idle.
   * Each item is spoken fully before moving to the next.
   *
   * Chrome workaround: Chrome's speechSynthesis can silently fail
   * if there's stale state or voices aren't loaded. We cancel any
   * stuck synthesis before starting a new utterance, and use a
   * safety timeout to recover if onend/onerror never fire.
   */
  const processQueue = useCallback(() => {
    if (isSpeakingRef.current) return;
    if (speechQueueRef.current.length === 0) return;
    if (!('speechSynthesis' in window)) return;

    const synth = window.speechSynthesis;

    // Chrome fix: cancel any stuck/stale synthesis state
    synth.cancel();

    const next = speechQueueRef.current.shift()!;
    isSpeakingRef.current = true;
    setIsSpeaking(true);

    // MUTE mic while TTS plays — prevents speaker audio from being
    // picked up by the mic and re-transcribed as phantom speech
    micMutedRef.current = true;

    const utterance = new SpeechSynthesisUtterance(next.text);
    utterance.lang = SPEECH_LANG_MAP[next.lang] || next.lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Safety timeout: if onend/onerror never fire (Chrome bug with
    // long utterances or when synthesis silently fails), recover
    // after a generous timeout based on text length
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (safetyTimer) clearTimeout(safetyTimer);

      isSpeakingRef.current = false;
      setIsSpeaking(false);
      next.onDone();

      // Keep mic muted for 300ms after TTS ends — the mic can still
      // pick up the tail-end echo of the speaker audio
      setTimeout(() => {
        if (speechQueueRef.current.length === 0) {
          micMutedRef.current = false;
        }
        processQueue();
      }, 300);
    };

    utterance.onend = finish;
    utterance.onerror = finish;

    // Estimate max speech time: ~150ms per character + 3s buffer
    const maxMs = Math.max(5000, next.text.length * 150 + 3000);
    safetyTimer = setTimeout(() => {
      if (!finished) {
        console.warn('TTS safety timeout — speech may have silently failed');
        synth.cancel();
        finish();
      }
    }, maxMs);

    // Chrome fix: sometimes speechSynthesis needs a tiny delay
    // after cancel() before speak() will work
    setTimeout(() => {
      if (!finished) {
        synth.speak(utterance);
      }
    }, 50);
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
     * 'live_subtitle' — interim translated text from the server.
     * Shown as a live updating subtitle so the receiver can read
     * along in their own language while the partner is still speaking.
     * NOT spoken aloud (interim STT is too inaccurate for TTS).
     */
    socket.on('live_subtitle', (data: {
      senderId: string;
      senderNickname: string;
      originalText: string;
      translatedText: string;
      sourceLang: string;
      targetLang: string;
    }) => {
      setInterimText(data.translatedText);
      setInterimSender(data.senderNickname);
    });

    /**
     * 'final_voice' — clean final translation, sent to receiver only.
     * Queue for TTS. The transcript will arrive via 'translation_result'
     * but we hold it until after TTS finishes (voice-first).
     */
    socket.on('final_voice', (data: {
      senderId: string;
      senderNickname: string;
      originalText: string;
      translatedText: string;
      sourceLang: string;
      targetLang: string;
      timestamp: number;
    }) => {
      // Clear live subtitle — final translation replaces it
      setInterimText(null);
      setInterimSender(null);

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

      // If autoSpeak is off or text is empty, just add transcript
      if (!autoSpeakRef.current || !data.translatedText.trim()) {
        setTranscript(prev => [...prev, entry]);
        return;
      }

      // Queue for TTS — transcript added after speech finishes (voice-first)
      speechQueueRef.current.push({
        text: data.translatedText,
        lang: myLanguageRef.current,
        onDone: () => {
          setTranscript(prev => [...prev, entry]);
        },
      });

      processQueue();
    });

    /**
     * 'translation_result' — transcript event sent to SENDER only.
     * Show immediately — the sender said it, they know what they said.
     * The receiver's transcript comes from final_voice → onDone.
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
    });

    socket.on('translation_error', (data: { message: string }) => {
      setError(data.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [processQueue]);

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
    isSpeakingRef.current = false;
    micMutedRef.current = false;

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
      // DROP all speech while TTS is playing — this is the main fix
      // for phantom transcriptions. The mic picks up the speaker output
      // and sends it back as "speech", creating a feedback loop.
      if (micMutedRef.current) return;

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const confidence = result[0].confidence;
        const text = result[0].transcript.trim();

        // Skip empty or very short results (noise, breathing)
        if (text.length < 2) continue;

        // Skip low-confidence results — these are usually background
        // noise, ambient sounds, or mic artifacts. The threshold 0.5
        // filters out most garbage while keeping real speech.
        // (confidence is 0-1, but can be 0 for interim results in
        // some browsers, so we only filter finals by confidence)
        if (result.isFinal) {
          if (confidence > 0 && confidence < 0.5) continue;
          finalTranscript += text + ' ';
        } else {
          interimTranscript += text;
        }
      }

      interimTranscript = interimTranscript.trim();
      finalTranscript = finalTranscript.trim();

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
