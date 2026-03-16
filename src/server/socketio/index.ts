import http from 'http';
import { Server, Socket } from 'socket.io';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { websocketConnectionsGauge } from '../../utils/metrics';
import { freeTranslation } from '../services/free-translation.service';

interface RoomUser {
  socketId: string;
  language: string;
  nickname: string;
}

interface Room {
  code: string;
  users: Map<string, RoomUser>;
  createdAt: number;
}

const rooms = new Map<string, Room>();
const socketToRoom = new Map<string, string>();

// Per-socket interim state to avoid duplicate translations and manage debouncing.
// The `generation` counter prevents stale async translations from emitting
// after a final speech event has already been processed (race condition fix).
const interimState = new Map<string, {
  lastText: string;
  timer: ReturnType<typeof setTimeout> | null;
  generation: number;
}>();

// Per-socket deduplication for final speech events.
// The Web Speech API can fire multiple isFinal:true results for the
// same phrase (browser quirk). Without dedup, each one triggers a
// separate translation + TTS on the receiver, causing duplicate sentences.
const lastFinal = new Map<string, { text: string; timestamp: number }>();
const FINAL_DEDUP_WINDOW_MS = 3000;

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

function cleanupSocketState(socketId: string): void {
  const state = interimState.get(socketId);
  if (state) {
    if (state.timer) clearTimeout(state.timer);
    // Bump generation so any in-flight async translation is discarded
    state.generation++;
    // Don't delete — keep the bumped generation so the guard works
    state.lastText = '';
    state.timer = null;
  }
}

export function setupSocketIOServer(server: http.Server): Server {
  const rawOrigin = config.cors.origin.trim().replace(/^["']|["']$/g, '');
  const corsOrigin = rawOrigin && /^https?:\/\//.test(rawOrigin) ? rawOrigin : '*';

  const io = new Server(server, {
    cors: { origin: corsOrigin, methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    websocketConnectionsGauge.inc();
    logger.info('Client connected', { socketId: socket.id });

    socket.on('create_room', (payload: { language: string; nickname: string }) => {
      handleLeaveRoom(socket, io);
      const { language, nickname } = payload;
      const code = generateRoomCode();
      const room: Room = { code, users: new Map(), createdAt: Date.now() };
      const user: RoomUser = { socketId: socket.id, language, nickname: nickname || 'User 1' };
      room.users.set(socket.id, user);
      rooms.set(code, room);
      socketToRoom.set(socket.id, code);
      socket.join(code);
      socket.emit('room_created', { roomCode: code, userId: socket.id });
      logger.info('Room created', { code, language, nickname });
    });

    socket.on('join_room', (payload: { roomCode: string; language: string; nickname: string }) => {
      handleLeaveRoom(socket, io);
      const { roomCode, language, nickname } = payload;
      const code = roomCode.toUpperCase().trim();
      const room = rooms.get(code);
      if (!room) {
        socket.emit('room_error', { message: 'Room not found. Check the code and try again.' });
        return;
      }
      if (room.users.size >= 2) {
        socket.emit('room_error', { message: 'Room is full. Only 2 participants allowed.' });
        return;
      }
      const user: RoomUser = { socketId: socket.id, language, nickname: nickname || 'User 2' };
      room.users.set(socket.id, user);
      socketToRoom.set(socket.id, code);
      socket.join(code);
      const otherUsers = Array.from(room.users.values()).filter(u => u.socketId !== socket.id);
      socket.emit('room_joined', {
        roomCode: code, userId: socket.id,
        participants: otherUsers.map(u => ({ id: u.socketId, nickname: u.nickname, language: u.language })),
      });
      socket.to(code).emit('participant_joined', {
        id: socket.id, nickname: user.nickname, language: user.language,
      });
      logger.info('User joined room', { code, language, nickname });
    });

    /**
     * Voice translation pipeline — designed for phone-call feel.
     *
     * INTERIM speech (isFinal=false):
     *   Debounce 500ms, then translate and send as 'live_subtitle'
     *   to the receiver. Shown as a live updating subtitle in their
     *   language. NOT spoken aloud (interim STT is too inaccurate
     *   for TTS — causes glitchy/wrong audio).
     *
     * FINAL speech (isFinal=true):
     *   Translate immediately, send as 'final_voice' to receiver
     *   (for TTS) and 'translation_result' to both (for transcript).
     *   Receiver speaks the translation aloud, then shows transcript.
     *
     * Both users can speak at the same time (full duplex).
     */
    socket.on('speech_text', async (payload: { text: string; isFinal: boolean }) => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;
      const room = rooms.get(roomCode);
      if (!room) return;
      const sender = room.users.get(socket.id);
      if (!sender) return;
      const { text, isFinal } = payload;
      if (!text.trim()) return;

      const otherUser = Array.from(room.users.values()).find(u => u.socketId !== socket.id);
      if (!otherUser) return;

      const sourceLang = sender.language;
      const targetLang = otherUser.language;
      const sameLang = sourceLang === targetLang;

      if (!isFinal) {
        // --- INTERIM: debounced live subtitle (translated) ---
        let state = interimState.get(socket.id);
        if (!state) {
          state = { lastText: '', timer: null, generation: 0 };
          interimState.set(socket.id, state);
        }

        // Skip duplicate text
        if (state.lastText === text) return;
        state.lastText = text;

        // Clear previous debounce timer
        if (state.timer) clearTimeout(state.timer);

        // Bump generation — any in-flight async translation from a
        // previous timer with a lower generation will be discarded
        state.generation++;
        const currentGen = state.generation;

        // Debounce: wait 300ms before translating to reduce API spam
        state.timer = setTimeout(async () => {
          const subtitleText = sameLang ? text : await translateSafe(text, sourceLang, targetLang);

          // RACE CONDITION GUARD: if a final speech arrived while we
          // were translating, our generation was reset. Don't emit
          // a stale subtitle that would overwrite the final result.
          const nowState = interimState.get(socket.id);
          if (!nowState || nowState.generation !== currentGen) return;

          io.to(otherUser.socketId).emit('live_subtitle', {
            senderId: socket.id,
            senderNickname: sender.nickname,
            originalText: text,
            translatedText: subtitleText,
            sourceLang,
            targetLang,
          });
        }, 300);

        return;
      }

      // --- FINAL: translate and send for TTS + transcript ---

      // DEDUP: The Web Speech API often fires the same final text
      // multiple times (browser quirk), sometimes with slight variations
      // like added/removed punctuation or capitalization changes.
      // Normalize before comparing to catch these near-duplicates.
      const now = Date.now();
      const normalized = text.toLowerCase().replace(/[.,!?;:]+$/g, '').trim();
      const prev = lastFinal.get(socket.id);
      if (prev && prev.text === normalized && now - prev.timestamp < FINAL_DEDUP_WINDOW_MS) {
        return;
      }
      lastFinal.set(socket.id, { text: normalized, timestamp: now });

      // Cancel any pending interim translation for this socket
      cleanupSocketState(socket.id);

      try {
        const timestamp = Date.now();
        let translatedText = text;
        if (!sameLang) {
          const result = await freeTranslation.translate(text, sourceLang, targetLang);
          translatedText = result.translatedText;
        }

        // Send to RECEIVER for TTS — they hear this spoken aloud.
        // Receiver's transcript entry is added after TTS finishes
        // (voice-first) inside the final_voice handler's onDone callback.
        io.to(otherUser.socketId).emit('final_voice', {
          senderId: socket.id,
          senderNickname: sender.nickname,
          originalText: text,
          translatedText,
          sourceLang,
          targetLang,
          timestamp,
        });

        // Send transcript to SENDER only — they said it, show immediately.
        // Previously this was sent to the whole room, causing duplicates:
        // the receiver could process translation_result before final_voice,
        // adding the entry twice (once here, once in final_voice onDone).
        socket.emit('translation_result', {
          senderId: socket.id,
          senderNickname: sender.nickname,
          originalText: text,
          translatedText,
          sourceLang,
          targetLang,
          timestamp,
        });

        logger.debug('Translation sent', {
          roomCode, from: sourceLang, to: targetLang,
          original: text.substring(0, 50),
        });
      } catch (error) {
        logger.error('Translation error', { error: (error as Error).message });
        socket.emit('translation_error', { message: 'Translation failed. Please try again.' });
      }
    });

    socket.on('leave_room', () => handleLeaveRoom(socket, io));

    socket.on('disconnect', () => {
      websocketConnectionsGauge.dec();
      cleanupSocketState(socket.id);
      lastFinal.delete(socket.id);
      handleLeaveRoom(socket, io);
      logger.info('Client disconnected', { socketId: socket.id });
    });
  });

  // Clean up stale empty rooms every 5 minutes
  setInterval(() => {
    const now = Date.now();
    const staleThreshold = 30 * 60 * 1000;
    for (const [code, room] of rooms) {
      if (room.users.size === 0 && now - room.createdAt > staleThreshold) {
        rooms.delete(code);
      }
    }
  }, 5 * 60 * 1000);

  logger.info('Socket.IO server attached');
  return io;
}

/**
 * Safe translation wrapper — returns original text on failure
 * so the subtitle still shows something useful.
 */
async function translateSafe(text: string, sourceLang: string, targetLang: string): Promise<string> {
  try {
    const result = await freeTranslation.translate(text, sourceLang, targetLang);
    return result.translatedText;
  } catch {
    return text;
  }
}

function handleLeaveRoom(socket: Socket, _io: Server): void {
  const roomCode = socketToRoom.get(socket.id);
  if (!roomCode) return;
  const room = rooms.get(roomCode);
  if (room) {
    const user = room.users.get(socket.id);
    room.users.delete(socket.id);
    socket.to(roomCode).emit('participant_left', {
      id: socket.id, nickname: user?.nickname || 'Unknown',
    });
    if (room.users.size === 0) {
      rooms.delete(roomCode);
    }
  }
  socket.leave(roomCode);
  socketToRoom.delete(socket.id);
}
