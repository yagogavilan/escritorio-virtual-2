import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

interface UserPayload {
  id: string;
  email: string;
  role: string;
}

// Track online users: Map<userId, Set<socketId>>
const onlineUsers = new Map<string, Set<string>>();

export async function setupWebSocket(io: Server) {
  // Reset all users to offline on server start
  // This ensures stale "online" statuses are cleared
  await prisma.user.updateMany({
    data: { status: 'offline', currentRoomId: null },
  });
  console.log('All users set to offline on server start');
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const secret = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';
      const payload = jwt.verify(token, secret) as UserPayload;
      socket.userId = payload.id;
      socket.userRole = payload.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    console.log(`User ${userId} connected`);

    // Track user connection
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId)!.add(socket.id);

    // Update user status to online
    await prisma.user.update({
      where: { id: userId },
      data: { status: 'online' },
    });

    // Broadcast user online
    socket.broadcast.emit('user:online', { userId });

    // Join user's personal room
    socket.join(`user:${userId}`);

    // --- PRESENCE EVENTS ---

    socket.on('user:status_change', async (data: { status: string; statusMessage?: string }) => {
      await prisma.user.update({
        where: { id: userId },
        data: {
          status: data.status as any,
          statusMessage: data.statusMessage,
        },
      });

      io.emit('user:status_changed', {
        userId,
        status: data.status,
        statusMessage: data.statusMessage,
      });
    });

    // --- ROOM EVENTS ---

    socket.on('room:join', async (data: { roomId: string }) => {
      const room = await prisma.room.findUnique({
        where: { id: data.roomId },
        include: { participants: true },
      });

      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      if (room.participants.length >= room.capacity) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }

      // Leave previous room if any
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.currentRoomId) {
        socket.leave(`room:${user.currentRoomId}`);
        io.to(`room:${user.currentRoomId}`).emit('room:user_left', {
          roomId: user.currentRoomId,
          userId,
        });
      }

      // Join new room
      await prisma.user.update({
        where: { id: userId },
        data: { currentRoomId: data.roomId, status: 'in_meeting' },
      });

      socket.join(`room:${data.roomId}`);
      io.emit('room:user_joined', {
        roomId: data.roomId,
        userId,
      });
      io.emit('user:status_changed', {
        userId,
        status: 'in_meeting',
        currentRoomId: data.roomId,
      });
    });

    socket.on('room:leave', async (data: { roomId: string }) => {
      await prisma.user.update({
        where: { id: userId },
        data: { currentRoomId: null, status: 'online' },
      });

      socket.leave(`room:${data.roomId}`);
      io.emit('room:user_left', {
        roomId: data.roomId,
        userId,
      });
      io.emit('user:status_changed', {
        userId,
        status: 'online',
        currentRoomId: null,
      });
    });

    socket.on('room:knock', async (data: { roomId: string }) => {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, avatar: true },
      });

      io.to(`room:${data.roomId}`).emit('room:knocked', {
        roomId: data.roomId,
        user,
      });
    });

    // --- CHAT EVENTS ---

    socket.on('chat:message', async (data: { channelId: string; text: string; mentions?: string[] }) => {
      const message = await prisma.chatMessage.create({
        data: {
          text: data.text,
          mentions: data.mentions || [],
          senderId: userId,
          channelId: data.channelId,
        },
        include: {
          sender: { select: { id: true, name: true, avatar: true } },
        },
      });

      // Update channel timestamp
      await prisma.chatChannel.update({
        where: { id: data.channelId },
        data: { updatedAt: new Date() },
      });

      // Get channel members
      const members = await prisma.channelMember.findMany({
        where: { channelId: data.channelId },
        select: { userId: true },
      });

      // Emit to all channel members
      members.forEach((member) => {
        io.to(`user:${member.userId}`).emit('chat:new_message', {
          channelId: data.channelId,
          message: {
            id: message.id,
            text: message.text,
            senderId: message.senderId,
            sender: message.sender,
            timestamp: message.createdAt,
            mentions: message.mentions,
            readBy: [userId],
          },
        });
      });
    });

    socket.on('chat:typing', (data: { channelId: string; isTyping: boolean }) => {
      socket.to(`channel:${data.channelId}`).emit('chat:typing', {
        channelId: data.channelId,
        userId,
        isTyping: data.isTyping,
      });
    });

    // --- TASK EVENTS ---

    socket.on('task:created', (data: { task: any }) => {
      io.emit('task:created', { task: data.task, createdBy: userId });
    });

    socket.on('task:updated', (data: { task: any }) => {
      io.emit('task:updated', { task: data.task, updatedBy: userId });
    });

    socket.on('task:assigned', (data: { taskId: string; assigneeId: string }) => {
      io.to(`user:${data.assigneeId}`).emit('task:assigned', {
        taskId: data.taskId,
        assignedBy: userId,
      });
    });

    // --- ANNOUNCEMENT EVENTS ---

    socket.on('announcement:new', (data: { announcement: any }) => {
      const { recipients } = data.announcement;

      if (!recipients || recipients.length === 0) {
        // Broadcast to all
        io.emit('announcement:new', { announcement: data.announcement });
      } else {
        // Send to specific users
        recipients.forEach((recipientId: string) => {
          io.to(`user:${recipientId}`).emit('announcement:new', {
            announcement: data.announcement,
          });
        });
      }
    });

    // --- CALL EVENTS ---

    socket.on('call:initiate', (data: { targetUserId: string; type: 'audio' | 'video' }) => {
      io.to(`user:${data.targetUserId}`).emit('call:incoming', {
        callerId: userId,
        type: data.type,
      });
    });

    socket.on('call:accept', (data: { callerId: string }) => {
      io.to(`user:${data.callerId}`).emit('call:accepted', {
        acceptedBy: userId,
      });
    });

    socket.on('call:reject', (data: { callerId: string }) => {
      io.to(`user:${data.callerId}`).emit('call:rejected', {
        rejectedBy: userId,
      });
    });

    socket.on('call:end', (data: { participantIds: string[] }) => {
      data.participantIds.forEach((participantId) => {
        io.to(`user:${participantId}`).emit('call:ended', {
          endedBy: userId,
        });
      });
    });

    // --- DISCONNECT ---

    socket.on('disconnect', async () => {
      console.log(`User ${userId} disconnected`);

      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);

        // If no more connections, set user offline
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);

          // Leave room if in one
          const user = await prisma.user.findUnique({ where: { id: userId } });
          if (user?.currentRoomId) {
            io.emit('room:user_left', {
              roomId: user.currentRoomId,
              userId,
            });
          }

          await prisma.user.update({
            where: { id: userId },
            data: { status: 'offline', currentRoomId: null },
          });

          io.emit('user:offline', { userId });
        }
      }
    });
  });
}
