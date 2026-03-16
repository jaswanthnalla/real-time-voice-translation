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

// Track last interim translation per socket to avoid duplicate API calls
const lastInterimText = new Map<string, string>();

// Debounce timers for interim translation
const interimTimers = new Map<string, ReturnType<typeof setTimeout>>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  if (rooms.has(code)) return generateRoomCode();
  return code;
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
     * Live interpreter pipeline:
     *
     * INTERIM text: debounce 300ms, then translate and send as 'live_voice'
     *   → receiver speaks it immediately (replacing any ongoing interim speech)
     *   → feels like a simultaneous interpreter whispering in your ear
     *
     * FINAL text: translate and send as 'translation_result'
     *   → receiver speaks the final clean translation
     *   → transcript entry added for both users
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
        // Debounced interim translation — translate partial speech and speak it
        // to the other user in near real-time (like a simultaneous interpreter)

        // Clear any pending interim timer for this socket
        const existingTimer = interimTimers.get(socket.id);
        if (existingTimer) clearTimeout(existingTimer);

        // Skip if same text as last interim (avoid duplicate API calls)
        if (lastInterimText.get(socket.id) === text) return;

        // Debounce: wait 300ms of silence before translating interim
        const timer = setTimeout(async () => {
          lastInterimText.set(socket.id, text);

          if (sameLang) {
            // Same language — just forward the live text for display
            io.to(otherUser.socketId).emit('live_voice', {
              senderId: socket.id,
              senderNickname: sender.nickname,
              text,
              translatedText: text,
              sourceLang,
              targetLang,
              isFinal: false,
            });
            return;
          }

          try {
            const result = await freeTranslation.translate(text, sourceLang, targetLang);
            io.to(otherUser.socketId).emit('live_voice', {
              senderId: socket.id,
              senderNickname: sender.nickname,
              text,
              translatedText: result.translatedText,
              sourceLang,
              targetLang,
              isFinal: false,
            });
          } catch {
            // Interim translation failed — not critical, skip
          }
        }, 300);

        interimTimers.set(socket.id, timer);
        return;
      }

      // FINAL — clean up interim state and send definitive translation
      const pendingTimer = interimTimers.get(socket.id);
      if (pendingTimer) clearTimeout(pendingTimer);
      interimTimers.delete(socket.id);
      lastInterimText.delete(socket.id);

      try {
        const timestamp = Date.now();
        let translatedText = text;
        if (!sameLang) {
          const result = await freeTranslation.translate(text, sourceLang, targetLang);
          translatedText = result.translatedText;
        }

        const msg = {
          senderId: socket.id,
          senderNickname: sender.nickname,
          originalText: text,
          translatedText,
          sourceLang,
          targetLang,
          timestamp,
        };

        // Send final translated voice to receiver — this replaces any interim speech
        io.to(otherUser.socketId).emit('live_voice', {
          senderId: socket.id,
          senderNickname: sender.nickname,
          text,
          translatedText,
          sourceLang,
          targetLang,
          isFinal: true,
        });

        // Send transcript to both users
        io.to(roomCode).emit('translation_result', msg);

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
      // Clean up interim state
      const timer = interimTimers.get(socket.id);
      if (timer) clearTimeout(timer);
      interimTimers.delete(socket.id);
      lastInterimText.delete(socket.id);
      handleLeaveRoom(socket, io);
      logger.info('Client disconnected', { socketId: socket.id });
    });
  });

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
