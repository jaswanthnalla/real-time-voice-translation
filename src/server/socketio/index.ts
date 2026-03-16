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
  // Sanitize CORS origin the same way app.ts does
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
        roomCode: code,
        userId: socket.id,
        participants: otherUsers.map(u => ({ id: u.socketId, nickname: u.nickname, language: u.language })),
      });

      socket.to(code).emit('participant_joined', {
        id: socket.id,
        nickname: user.nickname,
        language: user.language,
      });

      logger.info('User joined room', { code, language, nickname });
    });

    /**
     * Voice-first translation pipeline:
     *
     * 1. Client STT (Web Speech API) sends interim/final text
     * 2. For interim: show typing indicator to receiver only
     * 3. For final: translate, then send TWO events:
     *    a) 'speak_translation' → receiver only (speaks aloud immediately)
     *    b) 'translation_result' → both users (sender sees transcript instantly,
     *        receiver delays showing transcript until speech finishes)
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

      // Interim text — typing indicator to the other user only
      if (!isFinal) {
        if (otherUser) {
          io.to(otherUser.socketId).emit('interim_transcript', {
            senderId: socket.id,
            senderNickname: sender.nickname,
            originalText: text,
            sourceLang: sender.language,
          });
        }
        return;
      }

      // Final — translate and deliver voice-first
      try {
        const sourceLang = sender.language;
        const targetLang = otherUser?.language || sourceLang;
        const timestamp = Date.now();

        let translatedText = text;
        if (sourceLang !== targetLang) {
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

        // Phase 1: Voice — send to receiver only so they hear it first
        if (otherUser && sourceLang !== targetLang) {
          io.to(otherUser.socketId).emit('speak_translation', msg);
        }

        // Phase 2: Transcript — send to both
        // Sender sees it immediately; receiver shows it after speech ends
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
        logger.debug('Cleaned up stale room', { code });
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
      id: socket.id,
      nickname: user?.nickname || 'Unknown',
    });
    if (room.users.size === 0) {
      rooms.delete(roomCode);
      logger.debug('Room deleted (empty)', { code: roomCode });
    }
  }

  socket.leave(roomCode);
  socketToRoom.delete(socket.id);
}
