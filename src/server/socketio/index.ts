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

// Track last interim text per socket to avoid duplicate sends
const lastInterimText = new Map<string, string>();

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
     * INTERIM text: forward raw text as live subtitle (no translation,
     *   no TTS) — partial speech recognition is often inaccurate, so
     *   translating/speaking it produces glitchy results.
     *
     * FINAL text: translate and send as 'live_voice' (isFinal=true)
     *   → receiver speaks the clean final translation aloud
     *   → transcript entry added for both users via 'translation_result'
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
        // Interim — forward raw text as live subtitle (no translation)
        // Skip if same text as last interim to avoid spamming
        if (lastInterimText.get(socket.id) === text) return;
        lastInterimText.set(socket.id, text);

        io.to(otherUser.socketId).emit('live_voice', {
          senderId: socket.id,
          senderNickname: sender.nickname,
          text,
          translatedText: text, // raw untranslated — just for subtitle display
          sourceLang,
          targetLang,
          isFinal: false,
        });
        return;
      }

      // FINAL — translate and send for TTS
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

        // Send final translated voice to receiver for TTS
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
