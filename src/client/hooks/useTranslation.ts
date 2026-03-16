import { useState, useRef, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

// Build version — visible in console to verify deployments
const BUILD_VERSION = '2026-03-16-v5';

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

// Debug logger — helps trace issues in production
function dbg(tag: string, ...args: unknown[]) {
  console.log(`[VT:${tag}]`, ...args);
}

/**
 * Warm up SpeechSynthesis — Chrome blocks TTS until the first call
 * happens during a user gesture. We call this on the first user click
 * (create/join room) to "unlock" the synthesis engine.
 */
let ttsWarmedUp = false;
function warmUpTTS() {
  if (ttsWarmedUp) return;
  if (!('speechSynthesis' in window)) return;
  ttsWarmedUp = true;
  const synth = window.speechSynthesis;
  const silent = new SpeechSynthesisUtterance('');
  silent.volume = 0;
  synth.speak(silent);
  synth.cancel();
  dbg('TTS', 'Warmed up speechSynthesis');
}

/**
 * Voice translation hook — phone-call feel.
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

  // Speech queue — final translations spoken in order, no overlap
  const speechQueueRef = useRef<Array<{
    text: string;
    lang: string;
    onDone: () => void;
  }>>([]);
  const isSpeakingRef = useRef(false);

  // Mic mute during TTS — prevents echo feedback loop
  const micMutedRef = useRef(false);

  // Client-side dedup — last transcript IDs to prevent duplicates
  const recentTranscriptIds = useRef<Set<string>>(new Set());

  // Keep refs in sync
  myLanguageRef.current = myLanguage;
  autoSpeakRef.current = autoSpeak;

  // Log version on mount
  useEffect(() => {
    dbg('INIT', `Voice Translation ${BUILD_VERSION}`);
  }, []);

  /**
   * Process the speech queue — speak the next item.
   */
  const processQueue = useCallback(() => {
    if (isSpeakingRef.current) return;
    if (speechQueueRef.current.length === 0) return;
    if (!('speechSynthesis' in window)) {
      dbg('TTS', 'speechSynthesis not available');
      // Still add transcripts even if TTS unavailable
      while (speechQueueRef.current.length > 0) {
        speechQueueRef.current.shift()!.onDone();
      }
      return;
    }

    const synth = window.speechSynthesis;

    // Clear any stale state
    synth.cancel();

    const next = speechQueueRef.current.shift()!;
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    micMutedRef.current = true;

    dbg('TTS', `Speaking: "${next.text.substring(0, 40)}..." lang=${next.lang}`);

    const utterance = new SpeechSynthesisUtterance(next.text);
    utterance.lang = SPEECH_LANG_MAP[next.lang] || next.lang;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    let finished = false;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (reason: string) => {
      if (finished) return;
      finished = true;
      if (safetyTimer) clearTimeout(safetyTimer);

      dbg('TTS', `Finished: ${reason}`);
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      next.onDone();

      // Keep mic muted 500ms after TTS to avoid echo pickup
      setTimeout(() => {
        if (speechQueueRef.current.length === 0) {
          micMutedRef.current = false;
          dbg('MIC', 'Unmuted');
        }
        processQueue();
      }, 500);
    };

    utterance.onend = () => finish('onend');
    utterance.onerror = (e) => {
      dbg('TTS', 'Error:', (e as any).error || e);
      finish('onerror');
    };

    // Safety timeout: recover if events never fire
    const maxMs = Math.max(8000, next.text.length * 150 + 5000);
    safetyTimer = setTimeout(() => {
      dbg('TTS', `Safety timeout after ${maxMs}ms`);
      synth.cancel();
      finish('timeout');
    }, maxMs);

    // Chrome needs a small delay after cancel() before speak() works
    setTimeout(() => {
      if (!finished) {
        try {
          synth.speak(utterance);

          // Chrome bug: long utterances get auto-paused after ~15s.
          // Workaround: periodically resume.
          const resumeInterval = setInterval(() => {
            if (finished) {
              clearInterval(resumeInterval);
              return;
            }
            if (synth.paused) {
              dbg('TTS', 'Resuming paused synthesis');
              synth.resume();
            }
          }, 5000);
        } catch (err) {
          dbg('TTS', 'speak() threw:', err);
          finish('exception');
        }
      }
    }, 80);
  }, []);

  // Initialize Socket.IO connection
  useEffect(() => {
    const socket = io(window.location.origin, {
      transports: ['polling', 'websocket'],
    });

    socket.on('connect', () => {
      dbg('SOCKET', 'Connected:', socket.id);
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      dbg('SOCKET', 'Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('room_created', (data: { roomCode: string; userId: string }) => {
      dbg('ROOM', 'Created:', data.roomCode);
      setRoomCode(data.roomCode);
      setMyId(data.userId);
      setError(null);
    });

    socket.on('room_joined', (data: { roomCode: string; userId: string; participants: Participant[] }) => {
      dbg('ROOM', 'Joined:', data.roomCode, 'participants:', data.participants.length);
      setRoomCode(data.roomCode);
      setMyId(data.userId);
      setParticipants(data.participants);
      setError(null);
    });

    socket.on('room_error', (data: { message: string }) => {
      dbg('ROOM', 'Error:', data.message);
      setError(data.message);
    });

    socket.on('participant_joined', (participant: Participant) => {
      dbg('ROOM', 'Partner joined:', participant.nickname);
      setParticipants(prev => [...prev.filter(p => p.id !== participant.id), participant]);
    });

    socket.on('participant_left', (data: { id: string; nickname: string }) => {
      dbg('ROOM', 'Partner left:', data.nickname);
      setParticipants(prev => prev.filter(p => p.id !== data.id));
    });

    /**
     * 'live_subtitle' — interim translated text, visual only.
     */
    socket.on('live_subtitle', (data: {
      senderId: string;
      senderNickname: string;
      originalText: string;
      translatedText: string;
      sourceLang: string;
      targetLang: string;
    }) => {
      dbg('SUB', `Subtitle: "${data.translatedText.substring(0, 30)}..."`);
      setInterimText(data.translatedText);
      setInterimSender(data.senderNickname);
    });

    /**
     * 'final_voice' — final translation for the RECEIVER.
     * Queue for TTS, add transcript after speech finishes.
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
      dbg('VOICE', `Final voice: "${data.translatedText.substring(0, 40)}..."`);

      // Clear live subtitle
      setInterimText(null);
      setInterimSender(null);

      // Dedup key based on timestamp + sender
      const dedupKey = `${data.senderId}-${data.timestamp}`;
      if (recentTranscriptIds.current.has(dedupKey)) {
        dbg('VOICE', 'Skipped duplicate final_voice');
        return;
      }
      recentTranscriptIds.current.add(dedupKey);
      // Clean old keys after 10s
      setTimeout(() => recentTranscriptIds.current.delete(dedupKey), 10000);

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

      // If autoSpeak off or empty text, just add transcript immediately
      if (!autoSpeakRef.current || !data.translatedText.trim()) {
        dbg('VOICE', 'autoSpeak off or empty, adding transcript directly');
        setTranscript(prev => [...prev, entry]);
        return;
      }

      // Queue for TTS — transcript added after speech finishes (voice-first)
      speechQueueRef.current.push({
        text: data.translatedText,
        lang: myLanguageRef.current,
        onDone: () => {
          dbg('VOICE', 'TTS done, adding transcript');
          setTranscript(prev => [...prev, entry]);
        },
      });

      processQueue();
    });

    /**
     * 'translation_result' — transcript for the SENDER only.
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
      dbg('TRANS', `My transcript: "${data.originalText.substring(0, 30)}..."`);

      // Dedup
      const dedupKey = `${data.senderId}-${data.timestamp}`;
      if (recentTranscriptIds.current.has(dedupKey)) {
        dbg('TRANS', 'Skipped duplicate translation_result');
        return;
      }
      recentTranscriptIds.current.add(dedupKey);
      setTimeout(() => recentTranscriptIds.current.delete(dedupKey), 10000);

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
      dbg('ERR', data.message);
      setError(data.message);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [processQueue]);

  const createRoom = useCallback((nickname: string) => {
    warmUpTTS(); // Unlock TTS on user gesture
    socketRef.current?.emit('create_room', {
      language: myLanguageRef.current,
      nickname,
    });
  }, []);

  const joinRoom = useCallback((code: string, nickname: string) => {
    warmUpTTS(); // Unlock TTS on user gesture
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
    recentTranscriptIds.current.clear();

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

    warmUpTTS(); // Extra safety — ensure TTS is unlocked

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
      // DROP all speech while TTS is playing — prevents echo feedback loop
      if (micMutedRef.current) return;

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const confidence = result[0].confidence;
        const text = result[0].transcript.trim();

        // Skip empty or very short results (noise, breathing)
        if (text.length < 2) continue;

        if (result.isFinal) {
          // Skip low-confidence finals (noise, ambient sounds)
          if (confidence > 0 && confidence < 0.5) {
            dbg('STT', `Skipped low-confidence final: "${text}" (${confidence})`);
            continue;
          }
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
        dbg('STT', `Final: "${finalTranscript}"`);
        socket.emit('speech_text', { text: finalTranscript, isFinal: true });
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      dbg('STT', 'Error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access and try again.');
      }
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening
      if (recognitionRef.current === recognition) {
        dbg('STT', 'Recognition ended, auto-restarting');
        try { recognition.start(); } catch { /* already started or page closed */ }
      }
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
      setError(null);
      dbg('STT', `Started listening in ${recognition.lang}`);
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
    dbg('STT', 'Stopped listening');
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript([]);
    recentTranscriptIds.current.clear();
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
